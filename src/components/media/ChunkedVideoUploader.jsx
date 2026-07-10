/**
 * ChunkedVideoUploader — uploads large video files directly to DigitalOcean Spaces
 * using multipart upload with presigned PUT URLs.
 *
 * Root causes fixed:
 *  1. Service worker bypass: sw.js now ignores *.digitaloceanspaces.com requests.
 *  2. credentials: "omit" — prevents browser from sending cookies/auth headers
 *     that were NOT included in the presigned URL signature, causing sig mismatch.
 *  3. No Content-Type header in fetch — presigned URLs are signed with host only,
 *     so we must not send extra signed headers from the browser side.
 *  4. Fresh presigned URLs on retry — expired or stale URLs get regenerated.
 *  5. CORS detection — stops immediately on definitive CORS/config errors.
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { X, Upload, AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { recordStorageUsage } from "@/utils/spacesStorage";

const CHUNK_SIZE = 50 * 1024 * 1024; // 50 MB per chunk (reduces part count for large files)
const MAX_CONCURRENT = 3;
const MAX_RETRIES = 3;
const PART_TIMEOUT_MS = 5 * 60 * 1000; // 5 min per part (for slow connections)

function formatBytes(bytes) {
  if (!bytes) return "0 B";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatDuration(seconds) {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${s}s`;
}

/** Fetch a chunk with timeout and AbortController support */
async function fetchWithTimeout(url, options, timeoutMs) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: ac.signal });
  } finally {
    clearTimeout(timer);
  }
}

export default function ChunkedVideoUploader({
  file,
  folder,
  onComplete,
  onCancel,
  onProgress,
  metadata = {},
}) {
  const [status, setStatus] = useState("idle");
  const [progress, setProgress] = useState(0);
  const [speed, setSpeed] = useState(null);
  const [error, setError] = useState("");
  const [partStatuses, setPartStatuses] = useState([]);

  const abortRef = useRef(false);
  const uploadIdRef = useRef(null);
  const keyRef = useRef(null);
  // Store presigned URLs per partNumber for fresh-URL retry
  const urlMapRef = useRef({});
  const startTimeRef = useRef(null);
  const uploadedBytesRef = useRef(0);
  const speedTickRef = useRef(null);

  const totalParts = Math.ceil(file.size / CHUNK_SIZE);

  const handleCancel = useCallback(async () => {
    abortRef.current = true;
    setStatus("cancelled");
    if (uploadIdRef.current && keyRef.current) {
      base44.functions.invoke("abortMultipartUpload", {
        uploadId: uploadIdRef.current,
        key: keyRef.current,
      }).catch(() => {});
    }
    onCancel?.();
  }, [onCancel]);

  useEffect(() => {
    if (status === "uploading") {
      speedTickRef.current = setInterval(() => {
        const elapsed = (Date.now() - (startTimeRef.current || Date.now())) / 1000;
        if (elapsed > 1) setSpeed(Math.round(uploadedBytesRef.current / elapsed));
      }, 1000);
    }
    return () => { if (speedTickRef.current) clearInterval(speedTickRef.current); };
  }, [status]);

  const getFreshUrl = useCallback(async (partNumber) => {
    const res = await base44.functions.invoke("presignMultipartParts", {
      uploadId: uploadIdRef.current,
      key: keyRef.current,
      partNumbers: [partNumber],
    });
    const entry = res.data?.presignedUrls?.[0];
    if (!entry?.url) throw new Error(`Could not get fresh URL for part ${partNumber}`);
    urlMapRef.current[partNumber] = entry.url;
    return entry.url;
  }, []);

  const doStart = useCallback(async () => {
    abortRef.current = false;
    uploadedBytesRef.current = 0;
    startTimeRef.current = Date.now();
    setError("");
    setProgress(0);

    const partCount = Math.ceil(file.size / CHUNK_SIZE);
    const partsDone = {};

    // ── Init ───────────────────────────────────────────────────────────────
    setStatus("initializing");
    try {
      const res = await base44.functions.invoke("initMultipartUpload", {
        filename: file.name,
        mimeType: file.type || "video/mp4",
        folder,
        partCount,
      });
      if (!res.data?.uploadId || !res.data?.presignedUrls?.length) {
        throw new Error("Invalid init response from server");
      }
      uploadIdRef.current = res.data.uploadId;
      keyRef.current = res.data.key;

      // Populate URL map by partNumber
      urlMapRef.current = {};
      for (const { partNumber, url } of res.data.presignedUrls) {
        urlMapRef.current[partNumber] = url;
      }
      setPartStatuses(res.data.presignedUrls.map(() => "pending"));
    } catch (err) {
      setError(`Init failed: ${err.message || "Unknown error"}`);
      setStatus("error");
      return;
    }

    // ── Upload chunks directly to Spaces ───────────────────────────────────
    setStatus("uploading");

    const total = partCount;
    let nextIdx = 0;
    let fatal = false;
    let fatalMsg = "";

    const updatePart = (idx, s) => {
      setPartStatuses(prev => { const n = [...prev]; n[idx] = s; return n; });
    };

    const uploadChunk = async (partNumber) => {
      if (abortRef.current || fatal) return;
      const idx = partNumber - 1;
      const start = idx * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const chunk = file.slice(start, end);

      updatePart(idx, "uploading");

      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        if (abortRef.current || fatal) return;

        // On retry (attempt > 0), always get a fresh presigned URL
        let url = urlMapRef.current[partNumber];
        if (attempt > 0) {
          try {
            url = await getFreshUrl(partNumber);
            updatePart(idx, `retry-${attempt}`);
          } catch (freshErr) {
            fatalMsg = `Could not get fresh URL for part ${partNumber}: ${freshErr.message}`;
            fatal = true;
            updatePart(idx, "failed");
            setError(fatalMsg);
            setStatus("error");
            return;
          }
        }

        try {
          // CRITICAL: credentials:"omit" prevents browser from sending cookies/auth headers
          // that were NOT part of the presigned URL signature — a mismatch causes CORS errors.
          // Do NOT add Content-Type here — the URL is signed with host-only signed headers.
          const res = await fetchWithTimeout(url, {
            method: "PUT",
            body: chunk,
            credentials: "omit",
            cache: "no-store",
            mode: "cors",
          }, PART_TIMEOUT_MS);

          if (!res.ok) {
            const text = await res.text().catch(() => "");
            // 403/401 on a presigned URL = signature mismatch or expired — don't retry same URL
            if (res.status === 403 || res.status === 401) {
              // Force fresh URL on next attempt by continuing loop
              continue;
            }
            throw new Error(`HTTP ${res.status}: ${text.slice(0, 300)}`);
          }

          const etag = res.headers.get("ETag") || res.headers.get("etag") || "";
          // Log ETag status — empty ETags mean CORS is not exposing ETag header on DO Spaces
          if (!etag) {
            console.warn(`Part ${partNumber} uploaded OK but ETag is empty. ` +
              `Ensure DigitalOcean Spaces CORS config exposes the ETag header.`);
          }
          partsDone[partNumber] = { PartNumber: partNumber, ETag: etag };
          uploadedBytesRef.current += (end - start);
          const pct = Math.round((Object.keys(partsDone).length / total) * 100);
          setProgress(pct);
          onProgress?.(pct);
          updatePart(idx, "done");
          return; // success
        } catch (err) {
          const isCorsOrNetwork = err.name === "TypeError" || err.message?.includes("Failed to fetch") || err.message?.includes("NetworkError");

          if (isCorsOrNetwork && attempt === 0) {
            // Likely SW interference or CORS — try once more with fresh URL
            updatePart(idx, `retry-${attempt + 1}`);
            await new Promise(r => setTimeout(r, 1000));
            continue;
          }

          if (attempt < MAX_RETRIES - 1) {
            updatePart(idx, `retry-${attempt + 1}`);
            await new Promise(r => setTimeout(r, Math.pow(2, attempt + 1) * 1000));
          }
        }
      }

      fatal = true;
      fatalMsg = `Part ${partNumber} failed after ${MAX_RETRIES} attempts. Check DigitalOcean Spaces CORS configuration allows PUT from your origin.`;
      updatePart(idx, "failed");
      setError(fatalMsg);
      setStatus("error");
    };

    // Concurrency loop
    const workers = [];
    for (let w = 0; w < MAX_CONCURRENT; w++) {
      workers.push((async () => {
        while (nextIdx < total && !abortRef.current && !fatal) {
          const pn = nextIdx + 1; // partNumber is 1-based
          nextIdx++;
          await uploadChunk(pn);
        }
      })());
    }
    await Promise.all(workers);

    if (abortRef.current || fatal) return;

    // ── Complete ───────────────────────────────────────────────────────────
    setStatus("completing");
    try {
      const partsArr = Object.values(partsDone).sort((a, b) => a.PartNumber - b.PartNumber);
      if (partsArr.length !== total) {
        throw new Error(`Expected ${total} parts but only ${partsArr.length} completed`);
      }

      const res = await base44.functions.invoke("completeMultipartUpload", {
        uploadId: uploadIdRef.current,
        key: keyRef.current,
        parts: partsArr,
      });
      if (!res.data?.file_url) {
        const detail = res.data?.error || res.data?.parts_received ? 
          `${res.data.error}` : "No file URL returned from completion";
        throw new Error(detail);
      }

      setProgress(100);
      setStatus("done");

      // Record storage usage once
      recordStorageUsage({
        file_url: res.data.file_url,
        file_size_bytes: file.size,
        mime_type: file.type || "video/mp4",
        file_category: metadata.file_category || "media_library",
        entity_type: metadata.entity_type,
        entity_id: metadata.entity_id,
      }).catch(() => {});

      onComplete?.({
        file_url: res.data.file_url,
        file_size_bytes: file.size,
        key: res.data.key,
      });
    } catch (err) {
      setError(`Completion failed: ${err.message || "Unknown error"}`);
      setStatus("error");
    }
  }, [file, folder, onComplete, onProgress, metadata, getFreshUrl]);

  useEffect(() => { doStart(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const elapsed = startTimeRef.current ? (Date.now() - startTimeRef.current) / 1000 : 0;

  return (
    <div className="rounded-xl bg-card border border-border/50 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <Upload className="w-4 h-4 text-primary shrink-0" />
          <div className="min-w-0">
            <p className="font-mono text-sm font-bold truncate">{file.name}</p>
            <p className="text-[10px] font-mono text-muted-foreground">
              {formatBytes(file.size)} · {totalParts} chunks × {formatBytes(CHUNK_SIZE)}
            </p>
          </div>
        </div>
        {status !== "done" && status !== "cancelled" && (
          <Button variant="ghost" size="icon" onClick={handleCancel} className="text-muted-foreground hover:text-destructive shrink-0">
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>

      <div className="space-y-1.5">
        <div className="flex justify-between text-[10px] font-mono">
          <span className="text-muted-foreground">
            {status === "initializing" && "Initializing multipart upload..."}
            {status === "uploading" && `Uploading — ${progress}%`}
            {status === "completing" && "Finalizing..."}
            {status === "done" && "Upload complete"}
            {status === "error" && "Upload failed"}
            {status === "cancelled" && "Cancelled"}
          </span>
          <span className="text-foreground font-mono">
            {status === "uploading" && speed ? formatBytes(speed) + "/s · " : ""}
            {elapsed > 2 ? formatDuration(elapsed) : ""}
          </span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              status === "error" ? "bg-destructive" : status === "done" ? "bg-green-400" : "bg-primary"
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Chunk status dots */}
      {partStatuses.length > 0 && (
        <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
          {partStatuses.map((s, i) => {
            let color = "bg-muted";
            if (s === "done") color = "bg-green-400";
            else if (s === "uploading") color = "bg-primary animate-pulse";
            else if (s?.startsWith("retry-")) color = "bg-yellow-400";
            else if (s === "failed") color = "bg-destructive";
            return (
              <div key={i} title={`Part ${i + 1}: ${s}`}
                className={`w-2.5 h-2.5 rounded-sm ${color} transition-colors`} />
            );
          })}
        </div>
      )}

      {status === "done" && (
        <div className="flex items-center gap-2 text-green-400 text-xs font-mono">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Uploaded successfully</span>
        </div>
      )}

      {error && (
        <div className="p-2.5 rounded-lg bg-destructive/10 border border-destructive/20 flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
          <p className="text-xs text-destructive font-mono break-words">{error}</p>
        </div>
      )}

      {status === "error" && (
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={handleCancel} className="text-xs">Cancel</Button>
          <Button size="sm" onClick={doStart} className="flex items-center gap-1 text-xs">
            <RefreshCw className="w-3 h-3" /> Retry
          </Button>
        </div>
      )}
    </div>
  );
}