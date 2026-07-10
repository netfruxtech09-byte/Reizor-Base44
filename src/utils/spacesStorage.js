/**
 * DigitalOcean Spaces Storage Utility (Frontend)
 *
 * All uploads/deletes go through backend functions so secrets are never exposed.
 *
 * ChunkedVideoUploader is used for large video files (≥100 MB).
 * Smaller files use the original uploadToSpaces / uploadMultipart path.
 */

import { base44 } from "@/api/base44Client";

const MULTIPART_THRESHOLD_BYTES = 4 * 1024 * 1024; // 4 MB
const CHUNKED_THRESHOLD_BYTES = 100 * 1024 * 1024; // 100 MB — use chunked uploader
const VIDEO_MIME_PREFIXES = ["video/"];

function isLargeOrVideo(file) {
  if (!file) return false;
  const mime = (file.type || "").toLowerCase();
  if (VIDEO_MIME_PREFIXES.some(p => mime.startsWith(p))) return true;
  if (file.size > MULTIPART_THRESHOLD_BYTES) return true;
  return false;
}

/**
 * Whether to use the chunked multipart uploader (≥100 MB files).
 */
export function shouldUseChunkedUpload(file) {
  return file && file.size >= CHUNKED_THRESHOLD_BYTES;
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

async function uploadMultipart(file, folder) {
  const formData = new FormData();
  formData.append("file", file, file.name || "upload");
  formData.append("folder", folder);

  const appId = import.meta.env.VITE_BASE44_APP_ID || "";
  const appBaseUrl = import.meta.env.VITE_BASE44_APP_BASE_URL || "https://api.base44.app";
  const funcUrl = `${appBaseUrl}/api/apps/${appId}/functions/spacesUpload`;

  const token = localStorage.getItem("base44_access_token") || "";

  const res = await fetch(funcUrl, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Upload failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  if (!data?.file_url) {
    throw new Error(data?.error || "Upload failed — no URL returned");
  }
  return data;
}

export async function uploadToSpaces(file, folder, opts = {}) {
  if (!file) throw new Error("No file provided");
  if (!folder) throw new Error("No folder specified");

  let data;

  if (isLargeOrVideo(file)) {
    data = await uploadMultipart(file, folder);
  } else {
    const fileBase64 = await fileToBase64(file);
    const response = await base44.functions.invoke("spacesUpload", {
      action: "upload",
      fileBase64,
      mimeType: file.type || "application/octet-stream",
      filename: file.name || "upload",
      folder,
      file_category: opts.file_category,
      event_id: opts.event_id,
    });
    data = response?.data;
  }

  if (!data?.file_url) {
    throw new Error(data?.error || "Upload failed — no URL returned");
  }

  return {
    file_url: data.file_url,
    file_size_bytes: data.file_size_bytes || file.size || 0,
  };
}

export async function uploadAndRecord(file, folder, meta = {}) {
  const { file_url, file_size_bytes } = await uploadToSpaces(file, folder);
  recordStorageUsage({
    file_url,
    file_size_bytes,
    mime_type: file.type || "application/octet-stream",
    file_category: meta.file_category || "other",
    entity_type: meta.entity_type,
    entity_id: meta.entity_id,
  }).catch(() => {});
  return file_url;
}

export async function recordStorageUsage(opts = {}) {
  if (!opts.file_url || opts.file_size_bytes === undefined) return;
  await base44.functions.invoke("trackStorageUsage", {
    action: "record",
    file_url: opts.file_url,
    file_size_bytes: opts.file_size_bytes,
    mime_type: opts.mime_type || "application/octet-stream",
    file_category: opts.file_category || "other",
    entity_type: opts.entity_type || "",
    entity_id: opts.entity_id || "",
  }).catch(() => {});
}

export async function deleteStorageRecord(url) {
  if (!url) return;
  await base44.functions.invoke("trackStorageUsage", {
    action: "delete",
    file_url: url,
  }).catch(() => {});
}

export async function deleteFromSpaces(url) {
  if (!url) return;
  try {
    await base44.functions.invoke("spacesUpload", {
      action: "delete",
      url,
    });
  } catch {
    console.warn("[spacesStorage] Delete skipped or failed for:", url);
  }
}

export async function uploadManyToSpaces(files, folder) {
  const results = await Promise.all(files.map(f => uploadToSpaces(f, folder)));
  return results.map(r => (typeof r === 'string' ? r : r.file_url));
}