import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * togglePostLike — atomically toggle a community post like for the current user.
 * Prevents duplicate likes: checks for an existing like before creating.
 *
 * Payload: { post_id: string, action: "like" | "unlike" }
 * Returns: { liked: boolean, likeCount: number }
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const postId = body?.post_id;
    const action = body?.action; // "like" | "unlike"

    if (!postId || !action) {
      return Response.json({ error: 'post_id and action are required' }, { status: 400 });
    }

    // Check for an existing like by this user on this post (duplicate prevention)
    const existing = await base44.entities.CommunityPostLike.filter(
      { post_id: postId, user_email: user.email }, null, 1
    ).catch(() => []);

    if (action === "like") {
      // Already liked — don't create a duplicate
      if (existing.length > 0) {
        const count = await base44.entities.CommunityPostLike.filter(
          { post_id: postId }, null, 500
        ).catch(() => []);
        return Response.json({ liked: true, likeCount: count.length, alreadyLiked: true });
      }
      await base44.entities.CommunityPostLike.create({
        post_id: postId,
        user_email: user.email,
      });
    } else if (action === "unlike") {
      // Remove any existing like(s) by this user (idempotent)
      if (existing.length > 0) {
        await base44.entities.CommunityPostLike.deleteMany(
          { post_id: postId, user_email: user.email }
        ).catch(() => {});
      }
    } else {
      return Response.json({ error: 'action must be "like" or "unlike"' }, { status: 400 });
    }

    // Return the fresh count
    const allLikes = await base44.entities.CommunityPostLike.filter(
      { post_id: postId }, null, 500
    ).catch(() => []);

    return Response.json({
      liked: action === "like",
      likeCount: allLikes.length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});