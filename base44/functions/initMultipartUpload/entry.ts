/**
 * initMultipartUpload — initiates a DigitalOcean Spaces multipart upload
 * and returns presigned PUT URLs for each part.
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { S3Client, CreateMultipartUploadCommand } from 'npm:@aws-sdk/client-s3@3.750.0';
import { getSignedUrl } from 'npm:@aws-sdk/s3-request-presigner@3.750.0';
import { UploadPartCommand } from 'npm:@aws-sdk/client-s3@3.750.0';

const REGION     = Deno.env.get("DO_SPACES_REGION")  || "";
const BUCKET     = Deno.env.get("DO_SPACES_BUCKET")  || "";
const ACCESS_KEY = Deno.env.get("DO_SPACES_KEY")     || "";
const SECRET_KEY = Deno.env.get("DO_SPACES_SECRET")  || "";

const s3 = new S3Client({
  region: "us-east-1",
  endpoint: `https://${REGION}.digitaloceanspaces.com`,
  credentials: { accessKeyId: ACCESS_KEY, secretAccessKey: SECRET_KEY },
  forcePathStyle: false,
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
});

function sanitizeFilename(name) {
  const ext = name.includes(".") ? "." + name.split(".").pop().toLowerCase().replace(/[^a-z0-9]/g, "") : "";
  const base = name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80);
  return base + ext;
}
function buildKey(folder, filename) {
  const unique = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  return `${folder}/${unique}_${sanitizeFilename(filename)}`;
}

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
    const { filename, mimeType, folder, partCount } = body;
    if (!filename || !mimeType || !folder || !partCount) {
      return Response.json({ error: "Missing required fields" }, { status: 400 });
    }
    if (partCount < 1 || partCount > 10000) {
      return Response.json({ error: "partCount must be between 1 and 10000" }, { status: 400 });
    }

    const key = buildKey(folder, filename);

    // Step 1: Initiate multipart upload
    const createCmd = new CreateMultipartUploadCommand({
      Bucket: BUCKET,
      Key: key,
      ContentType: mimeType,
      ACL: "public-read",
    });
    const initResult = await s3.send(createCmd);
    const uploadId = initResult.UploadId;
    if (!uploadId) {
      return Response.json({ error: "Failed to get UploadId" }, { status: 500 });
    }

    // Step 2: Generate presigned PUT URLs for each part
    const presignedUrls = [];
    for (let i = 1; i <= partCount; i++) {
      const partCmd = new UploadPartCommand({
        Bucket: BUCKET,
        Key: key,
        PartNumber: i,
        UploadId: uploadId,
      });

      // 1-hour expiry for presigned URLs
      const url = await getSignedUrl(s3, partCmd, { expiresIn: 3600 });

      presignedUrls.push({
        partNumber: i,
        url,
      });
    }

    return Response.json({ uploadId, key, presignedUrls });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});