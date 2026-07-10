/**
 * abortMultipartUpload — aborts an in-progress DigitalOcean Spaces multipart upload.
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { S3Client, AbortMultipartUploadCommand } from 'npm:@aws-sdk/client-s3@3.750.0';

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
    const { uploadId, key } = body;
    if (!uploadId || !key) {
      return Response.json({ error: "Missing required fields" }, { status: 400 });
    }

    const cmd = new AbortMultipartUploadCommand({
      Bucket: BUCKET,
      Key: key,
      UploadId: uploadId,
    });

    await s3.send(cmd);

    return Response.json({ aborted: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});