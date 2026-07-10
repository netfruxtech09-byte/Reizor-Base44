/**
 * cleanupArtistMedia — One-time admin-only cleanup function
 * Deletes ALL ArtistPost, ArtistAlbum, and MediaItem records associated with artists.
 * Does NOT delete artists themselves or any other data.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();

  if (!user || user.role !== 'admin') {
    return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
  }

  const results = {
    artistPosts: 0,
    artistAlbums: 0,
    mediaItems: 0,
    errors: [],
  };

  // 1. Delete all ArtistPost records (gallery posts / spotlight content)
  const posts = await base44.asServiceRole.entities.ArtistPost.list(null, 2000).catch(() => []);
  for (const post of posts) {
    const ok = await base44.asServiceRole.entities.ArtistPost.delete(post.id).catch(e => { results.errors.push(`ArtistPost ${post.id}: ${e.message}`); return null; });
    if (ok !== null) results.artistPosts++;
  }

  // 2. Delete all ArtistAlbum records
  const albums = await base44.asServiceRole.entities.ArtistAlbum.list(null, 2000).catch(() => []);
  for (const album of albums) {
    const ok = await base44.asServiceRole.entities.ArtistAlbum.delete(album.id).catch(e => { results.errors.push(`ArtistAlbum ${album.id}: ${e.message}`); return null; });
    if (ok !== null) results.artistAlbums++;
  }

  // 3. Delete all MediaItem records (used in homepage ★ MEDIA / Artist Spotlight sections)
  const mediaItems = await base44.asServiceRole.entities.MediaItem.list(null, 2000).catch(() => []);
  for (const item of mediaItems) {
    const ok = await base44.asServiceRole.entities.MediaItem.delete(item.id).catch(e => { results.errors.push(`MediaItem ${item.id}: ${e.message}`); return null; });
    if (ok !== null) results.mediaItems++;
  }

  console.log(`[cleanupArtistMedia] Done — ArtistPosts: ${results.artistPosts}, ArtistAlbums: ${results.artistAlbums}, MediaItems: ${results.mediaItems}, Errors: ${results.errors.length}`);

  return Response.json({
    success: true,
    deleted: results,
    errors: results.errors,
  });
});