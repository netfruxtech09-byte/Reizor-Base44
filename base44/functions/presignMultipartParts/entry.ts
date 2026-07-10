/**
 * presignMultipartParts — generates fresh presigned PUT URLs for specific parts
 * of an existing multipart upload. Used when retrying failed parts.
 */

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';
import { S3Client } from 'npm:@aws-sdk/client-s3@3.750.0';
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
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!ACCESS_KEY || !SECRET_KEY || !BUCKET || !REGION) {
    return Response.json({ error: "Spaces not configured" }, { status: 500 });
  }

  try {
    const body = await req.json();
    const { uploadId, key, partNumbers } = body;

    if (!uploadId || !key || !Array.isArray(partNumbers) || partNumbers.length === 0) {
      return Response.json({ error: "Missing required fields: uploadId, key, partNumbers" }, { status: 400 });
    }

    const presignedUrls = [];
    for (const partNumber of partNumbers) {
      const cmd = new UploadPartCommand({
        Bucket: BUCKET,
        Key: key,
        PartNumber: partNumber,
        UploadId: uploadId,
      });
      const url = await getSignedUrl(s3, cmd, { expiresIn: 3600 });
      presignedUrls.push({ partNumber, url });
    }

    return Response.json({ presignedUrls });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});