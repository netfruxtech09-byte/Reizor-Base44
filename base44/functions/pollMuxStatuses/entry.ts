import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const MUX_TOKEN_ID = Deno.env.get("MUX_TOKEN_ID") || "";
const MUX_TOKEN_SECRET = Deno.env.get("MUX_TOKEN_SECRET") || "";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    if (!MUX_TOKEN_ID || !MUX_TOKEN_SECRET) {
      return Response.json({ error: "Mux not configured" }, { status: 500 });
    }

    // Find all media posts with Mux assets that are still preparing/idle
    const pending = await base44.asServiceRole.entities.OrganizerMediaPost.filter(
      { mux_status: "preparing" },
      "-created_date",
      50
    );

    // Also check idle ones
    const idle = await base44.asServiceRole.entities.OrganizerMediaPost.filter(
      { mux_status: "idle" },
      "-created_date",
      10
    );

    const allPending = [...pending, ...idle];
    if (allPending.length === 0) {
      return Response.json({ message: "No pending Mux assets", checked: 0 });
    }

    const auth = btoa(`${MUX_TOKEN_ID}:${MUX_TOKEN_SECRET}`);
    const results = [];

    for (const post of allPending) {
      if (!post.mux_asset_id) continue;

      try {
        const res = await fetch(`https://api.mux.com/video/v1/assets/${post.mux_asset_id}`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Basic ${auth}`,
          },
        });

        if (!res.ok) continue;

        const assetData = await res.json();
        const status = assetData?.data?.status || "unknown";
        const playbackId = assetData?.data?.playback_ids?.[0]?.id;
        const playbackUrl = playbackId ? `https://stream.mux.com/${playbackId}.m3u8` : null;
        const errors = assetData?.data?.errors;
        const errorMsg = errors?.messages?.join("; ") || null;

        const updateData = { mux_status: status, mux_error_message: errorMsg };
        if (playbackId) updateData.mux_playback_id = playbackId;
        if (playbackUrl) updateData.mux_playback_url = playbackUrl;

        // Mark processing as complete or failed
        if (status === 'ready') {
          updateData.processing_status = 'complete';
        } else if (status === 'errored') {
          updateData.processing_status = 'failed';
        }

        await base44.asServiceRole.entities.OrganizerMediaPost.update(post.id, updateData);

        // When encoding completes, trigger AI moderation to start the approval flow.
        // Only trigger once: aiModerateMedia skips records already approved/rejected.
        if (status === 'ready' && post.processing_status !== 'complete') {
          await base44.asServiceRole.functions.invoke('aiModerateMedia', {
            entity_type: 'OrganizerMediaPost',
            entity_id: post.id,
          }).catch(e => console.error(`Failed to trigger AI moderation for post ${post.id}:`, e.message));
        }

        results.push({ post_id: post.id, mux_asset_id: post.mux_asset_id, status });
        console.log(`Updated post ${post.id}: status=${status}`);
      } catch (e) {
        console.error(`Failed to check post ${post.id}:`, e.message);
      }
    }

    return Response.json({ message: `Checked ${allPending.length} assets`, results });
  } catch (error) {
    console.error("pollMuxStatuses error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});