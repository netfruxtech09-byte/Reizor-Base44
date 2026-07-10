import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const MUX_TOKEN_ID = Deno.env.get("MUX_TOKEN_ID") || "";
const MUX_TOKEN_SECRET = Deno.env.get("MUX_TOKEN_SECRET") || "";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { video_url, media_post_id } = body;

    if (!video_url) {
      return Response.json({ error: "Missing video_url" }, { status: 400 });
    }

    if (!MUX_TOKEN_ID || !MUX_TOKEN_SECRET) {
      return Response.json({ error: "Mux not configured" }, { status: 500 });
    }

    console.log(`Creating Mux asset for: ${video_url}`);

    // Create Mux asset via direct upload from URL
    const auth = btoa(`${MUX_TOKEN_ID}:${MUX_TOKEN_SECRET}`);

    const createRes = await fetch("https://api.mux.com/video/v1/assets", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${auth}`,
      },
      body: JSON.stringify({
        input: [{ url: video_url }],
        playback_policy: ["public"],
        mp4_support: "none",
        encoding_tier: "smart",
        max_resolution_tier: "2160p",
      }),
    });

    const assetData = await createRes.json();

    if (!createRes.ok) {
      const errMsg = assetData?.error?.message || assetData?.message || `HTTP ${createRes.status}`;
      console.error("Mux create asset failed:", JSON.stringify(assetData));
      return Response.json({ error: `Mux create failed: ${errMsg}` }, { status: 500 });
    }

    const assetId = assetData?.data?.id;
    const playbackId = assetData?.data?.playback_ids?.[0]?.id;
    const playbackUrl = playbackId ? `https://stream.mux.com/${playbackId}.m3u8` : null;
    const status = assetData?.data?.status || "preparing";

    console.log(`Mux asset created: ${assetId}, status: ${status}, playback: ${playbackId}`);

    // If media_post_id provided, update the record with Mux data
    if (media_post_id) {
      await base44.entities.OrganizerMediaPost.update(media_post_id, {
        mux_asset_id: assetId,
        mux_playback_id: playbackId,
        mux_playback_url: playbackUrl,
        mux_status: status,
        mux_error_message: null,
      });
    }

    return Response.json({
      success: true,
      mux_asset_id: assetId,
      mux_playback_id: playbackId,
      mux_playback_url: playbackUrl,
      mux_status: status,
    });
  } catch (error) {
    console.error("createMuxAsset error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});