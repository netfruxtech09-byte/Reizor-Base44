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
    const { mux_asset_id, media_post_id } = body;

    if (!mux_asset_id) {
      return Response.json({ error: "Missing mux_asset_id" }, { status: 400 });
    }

    if (!MUX_TOKEN_ID || !MUX_TOKEN_SECRET) {
      return Response.json({ error: "Mux not configured" }, { status: 500 });
    }

    const auth = btoa(`${MUX_TOKEN_ID}:${MUX_TOKEN_SECRET}`);

    const res = await fetch(`https://api.mux.com/video/v1/assets/${mux_asset_id}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${auth}`,
      },
    });

    const assetData = await res.json();

    if (!res.ok) {
      return Response.json({ error: `Mux API error: ${res.status}` }, { status: 500 });
    }

    const status = assetData?.data?.status || "unknown";
    const playbackId = assetData?.data?.playback_ids?.[0]?.id;
    const playbackUrl = playbackId ? `https://stream.mux.com/${playbackId}.m3u8` : null;
    const errors = assetData?.data?.errors;
    const errorMsg = errors?.messages?.join("; ") || null;

    console.log(`Mux asset ${mux_asset_id} status: ${status}`);

    // Update the media post if ID provided
    if (media_post_id) {
      const updateData = {
        mux_status: status,
        mux_error_message: errorMsg,
      };
      if (playbackId) updateData.mux_playback_id = playbackId;
      if (playbackUrl) updateData.mux_playback_url = playbackUrl;

      await base44.entities.OrganizerMediaPost.update(media_post_id, updateData);
    }

    return Response.json({
      mux_asset_id,
      mux_status: status,
      mux_playback_id: playbackId,
      mux_playback_url: playbackUrl,
      mux_error_message: errorMsg,
    });
  } catch (error) {
    console.error("checkMuxAssetStatus error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});