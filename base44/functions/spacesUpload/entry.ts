/**
 * DigitalOcean Spaces Upload Backend Function
 *
 * Handles file uploads/deletes via S3-compatible API.
 * Supports two upload modes:
 *   1. JSON body with base64 (images / small files) — action: "upload"
 *   2. multipart/form-data (videos / large files)   — no action field needed; detected by content-type
 *   3. delete — action: "delete", url in JSON body
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// ── Config ─────────────────────────────────────────────────────────────────
const REGION     = Deno.env.get("DO_SPACES_REGION")  || "";
const BUCKET     = Deno.env.get("DO_SPACES_BUCKET")  || "";
const ACCESS_KEY = Deno.env.get("DO_SPACES_KEY")     || "";
const SECRET_KEY = Deno.env.get("DO_SPACES_SECRET")  || "";
const CDN_URL    = (Deno.env.get("DO_SPACES_CDN_URL") || "").replace(/\/$/, "");
const ENDPOINT   = `https://${REGION}.digitaloceanspaces.com`;

// Max file size: 500 MB
const MAX_BYTES = 500 * 1024 * 1024;

// Allowed MIME types
const ALLOWED_TYPES = new Set([
  "image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif",
  "video/mp4", "video/webm", "video/quicktime", "video/mov", "video/avi", "video/x-msvideo",
  "application/pdf",
  "application/octet-stream",
]);

// ── Helpers ────────────────────────────────────────────────────────────────

function sanitizeFilename(name) {
  const ext = name.includes(".") ? "." + name.split(".").pop().toLowerCase().replace(/[^a-z0-9]/g, "") : "";
  const base = name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80);
  return base + ext;
}

function buildKey(folder, filename) {
  const unique = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const safe = sanitizeFilename(filename);
  return `${folder}/${unique}_${safe}`;
}

function urlToKey(url) {
  if (!url) return null;
  if (CDN_URL && url.startsWith(CDN_URL)) {
    return url.slice(CDN_URL.length).replace(/^\//, "");
  }
  const endpointWithBucket = `https://${BUCKET}.${REGION}.digitaloceanspaces.com/`;
  if (url.startsWith(endpointWithBucket)) {
    return url.slice(endpointWithBucket.length);
  }
  return null;
}

async function hmacSha256(key, data) {
  const keyData = typeof key === "string" ? new TextEncoder().encode(key) : key;
  const cryptoKey = await crypto.subtle.importKey(
    "raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(data));
  return new Uint8Array(sig);
}

async function sha256(data) {
  const buf = typeof data === "string" ? new TextEncoder().encode(data) : data;
  const hash = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function toHex(buf) {
  return Array.from(buf).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function signV4(method, key, contentType, bodyBytes, dateStr, amzDate) {
  const host = `${BUCKET}.${REGION}.digitaloceanspaces.com`;
  const canonicalUri = `/${key}`;
  const payloadHash = await sha256(bodyBytes);

  const canonicalHeaders =
    `content-type:${contentType}\n` +
    `host:${host}\n` +
    `x-amz-acl:public-read\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${amzDate}\n`;

  const signedHeaders = "content-type;host;x-amz-acl;x-amz-content-sha256;x-amz-date";

  const canonicalRequest =
    `${method}\n${canonicalUri}\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;

  const credentialScope = `${dateStr}/us-east-1/s3/aws4_request`;
  const stringToSign =
    `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${await sha256(canonicalRequest)}`;

  const kDate    = await hmacSha256(`AWS4${SECRET_KEY}`, dateStr);
  const kRegion  = await hmacSha256(kDate, "us-east-1");
  const kService = await hmacSha256(kRegion, "s3");
  const kSigning = await hmacSha256(kService, "aws4_request");
  const signature = toHex(await hmacSha256(kSigning, stringToSign));

  return `AWS4-HMAC-SHA256 Credential=${ACCESS_KEY}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
}

async function signV4Delete(key, dateStr, amzDate) {
  const host = `${BUCKET}.${REGION}.digitaloceanspaces.com`;
  const canonicalUri = `/${key}`;
  const emptyHash = await sha256(new Uint8Array(0));

  const canonicalHeaders =
    `host:${host}\n` +
    `x-amz-content-sha256:${emptyHash}\n` +
    `x-amz-date:${amzDate}\n`;

  const signedHeaders = "host;x-amz-content-sha256;x-amz-date";

  const canonicalRequest =
    `DELETE\n${canonicalUri}\n\n${canonicalHeaders}\n${signedHeaders}\n${emptyHash}`;

  const credentialScope = `${dateStr}/us-east-1/s3/aws4_request`;
  const stringToSign =
    `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${await sha256(canonicalRequest)}`;

  const kDate    = await hmacSha256(`AWS4${SECRET_KEY}`, dateStr);
  const kRegion  = await hmacSha256(kDate, "us-east-1");
  const kService = await hmacSha256(kRegion, "s3");
  const kSigning = await hmacSha256(kService, "aws4_request");
  const signature = toHex(await hmacSha256(kSigning, stringToSign));

  return `AWS4-HMAC-SHA256 Credential=${ACCESS_KEY}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
}

async function doUpload(fileBytes, mimeType, filename, folder) {
  const normalizedMime = mimeType.toLowerCase();
  const isAllowed = ALLOWED_TYPES.has(normalizedMime) ||
    normalizedMime.startsWith("image/") ||
    normalizedMime.startsWith("video/");

  if (!isAllowed) {
    return { error: `Unsupported file type: ${mimeType}`, status: 400 };
  }

  if (fileBytes.length > MAX_BYTES) {
    return { error: `File too large. Max ${MAX_BYTES / 1024 / 1024}MB`, status: 400 };
  }

  const key = buildKey(folder, filename);

  const now = new Date();
  const amzDate = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const dateStr = amzDate.slice(0, 8);

  const authorization = await signV4("PUT", key, normalizedMime, fileBytes, dateStr, amzDate);
  const payloadHash = await sha256(fileBytes);

  const uploadUrl = `https://${BUCKET}.${REGION}.digitaloceanspaces.com/${key}`;

  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": normalizedMime,
      "x-amz-acl": "public-read",
      "x-amz-date": amzDate,
      "x-amz-content-sha256": payloadHash,
      "Authorization": authorization,
      "Host": `${BUCKET}.${REGION}.digitaloceanspaces.com`,
      "Content-Length": String(fileBytes.length),
    },
    body: fileBytes,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { error: `Upload failed: ${res.status}`, detail: text, status: 500 };
  }

  const cdnUrl = CDN_URL
    ? `${CDN_URL}/${key}`
    : `https://${BUCKET}.${REGION}.digitaloceanspaces.com/${key}`;

  return { file_url: cdnUrl, key, file_size_bytes: fileBytes.length };
}

// ── Deno.serve ─────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  const base44 = createClientFromRequest(req);

  const user = await base44.auth.me().catch(() => null);
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!ACCESS_KEY || !SECRET_KEY || !BUCKET || !REGION) {
    return Response.json({ error: "Spaces not configured" }, { status: 500 });
  }

  const contentType = req.headers.get("content-type") || "";

  // ── MULTIPART upload (for videos / large files) ───────────────────────────
  if (contentType.includes("multipart/form-data")) {
    let formData;
    try {
      formData = await req.formData();
    } catch (e) {
      return Response.json({ error: "Failed to parse multipart form data", detail: e.message }, { status: 400 });
    }

    const file = formData.get("file");
    const folder = formData.get("folder") || "uploads";

    if (!file || typeof file === "string") {
      return Response.json({ error: "Missing file in form data" }, { status: 400 });
    }

    const fileBytes = new Uint8Array(await file.arrayBuffer());
    const mimeType = file.type || "application/octet-stream";
    const filename = file.name || "upload";

    const result = await doUpload(fileBytes, mimeType, filename, folder);
    if (result.error) {
      return Response.json({ error: result.error, detail: result.detail }, { status: result.status || 500 });
    }
    return Response.json(result);
  }

  // ── JSON body (base64 for images / delete) ────────────────────────────────
  const body = await req.json().catch(() => ({}));
  const { action } = body;

  // DELETE
  if (action === "delete") {
    const { url } = body;
    if (!url) return Response.json({ error: "Missing url" }, { status: 400 });

    const key = urlToKey(url);
    if (!key) {
      return Response.json({ deleted: false, reason: "not_spaces_url" });
    }

    const now = new Date();
    const amzDate = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const dateStr = amzDate.slice(0, 8);

    const authorization = await signV4Delete(key, dateStr, amzDate);
    const deleteUrl = `https://${BUCKET}.${REGION}.digitaloceanspaces.com/${key}`;
    const emptyHash = await sha256(new Uint8Array(0));

    const res = await fetch(deleteUrl, {
      method: "DELETE",
      headers: {
        "Host": `${BUCKET}.${REGION}.digitaloceanspaces.com`,
        "x-amz-date": amzDate,
        "x-amz-content-sha256": emptyHash,
        "Authorization": authorization,
      },
    });

    if (!res.ok && res.status !== 204 && res.status !== 404) {
      const text = await res.text().catch(() => "");
      return Response.json({ error: `Delete failed: ${res.status}`, detail: text }, { status: 500 });
    }

    return Response.json({ deleted: true, key });
  }

  // UPLOAD via base64 JSON (images / small files)
  if (action === "upload") {
    const { fileBase64, mimeType, filename, folder } = body;

    if (!fileBase64 || !mimeType || !filename || !folder) {
      return Response.json({ error: "Missing required fields: fileBase64, mimeType, filename, folder" }, { status: 400 });
    }

    let fileBytes;
    try {
      const base64Data = fileBase64.replace(/^data:[^;]+;base64,/, "");
      const binaryStr = atob(base64Data);
      fileBytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        fileBytes[i] = binaryStr.charCodeAt(i);
      }
    } catch {
      return Response.json({ error: "Invalid base64 data" }, { status: 400 });
    }

    const result = await doUpload(fileBytes, mimeType, filename, folder);
    if (result.error) {
      return Response.json({ error: result.error, detail: result.detail }, { status: result.status || 500 });
    }
    return Response.json(result);
  }

  return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
});