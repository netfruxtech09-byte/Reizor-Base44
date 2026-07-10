/**
 * completeMultipartUpload — completes a DigitalOcean Spaces multipart upload.
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { S3Client, CompleteMultipartUploadCommand } from 'npm:@aws-sdk/client-s3@3.750.0';

const REGION     = Deno.env.get("DO_SPACES_REGION")  || "";
const BUCKET     = Deno.env.get("DO_SPACES_BUCKET")  || "";
const ACCESS_KEY = Deno.env.get("DO_SPACES_KEY")     || "";
const SECRET_KEY = Deno.env.get("DO_SPACES_SECRET")  || "";
const CDN_URL    = (Deno.env.get("DO_SPACES_CDN_URL") || "").replace(/\/$/, "");

const s3 = new S3Client({
  region: "us-east-1",
  endpoint: `https://${REGION}.digitaloceanspaces.com`,
  credentials: { accessKeyId: ACCESS_KEY, secretAccessKey: SECRET_KEY },
  forcePathStyle: false,
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization" },
    });
  }

  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me().catch(() => null);
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!ACCESS_KEY || !SECRET_KEY || !BUCKET || !REGION) {
    return Response.json({ error: "Spaces not configured" }, { status: 500 });
  }

  try {
    const body = await req.json();
    const { uploadId, key, parts } = body;

    if (!uploadId || !key || !parts || !Array.isArray(parts) || parts.length === 0) {
      return Response.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Sort parts by PartNumber and ensure ETags are quoted
    const sortedParts = [...parts]
      .sort((a, b) => (a.PartNumber || a.partNumber) - (b.PartNumber || b.partNumber))
      .map(p => ({
        PartNumber: p.PartNumber || p.partNumber,
        ETag: (p.ETag || p.etag || ""),
      }));

    // Validate that all ETags are present — empty ETags cause DO to reject completion
    const missingEtags = sortedParts.filter(p => !p.ETag || p.ETag === '""' || p.ETag === "");
    if (missingEtags.length > 0) {
      return Response.json({
        error: `Missing ETags for parts: ${missingEtags.map(p => p.PartNumber).join(", ")}. ` +
               `DigitalOcean Spaces CORS must expose the ETag header. ` +
               `Add 'ETag' to CORS AllowedHeaders/ExposedHeaders in your Spaces bucket settings.`,
        parts_received: sortedParts,
      }, { status: 400 });
    }

    console.log(`Completing upload ${uploadId} with ${sortedParts.length} parts:`, JSON.stringify(sortedParts));

    const completeCmd = new CompleteMultipartUploadCommand({
      Bucket: BUCKET,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: { Parts: sortedParts },
    });

    let result;
    try {
      result = await s3.send(completeCmd);
    } catch (s3err) {
      console.error("S3 complete error:", s3err.name, s3err.message, s3err.$metadata);
      return Response.json({
        error: `S3 completion failed: ${s3err.name} — ${s3err.message}`,
        metadata: s3err.$metadata,
      }, { status: 500 });
    }

    const cdnUrl = CDN_URL ? `${CDN_URL}/${key}` : `https://${BUCKET}.${REGION}.digitaloceanspaces.com/${key}`;

    return Response.json({ file_url: cdnUrl, key, location: result.Location });
  } catch (error) {
    console.error("Complete multipart error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});