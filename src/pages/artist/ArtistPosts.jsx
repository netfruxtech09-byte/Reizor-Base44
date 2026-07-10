import { useState, useEffect } from "react";
import { Plus, Trash2, Music, Video, FileAudio, Calendar, Image as ImageIcon, Heart, MessageCircle, RefreshCw, Loader2, Eye, Pencil } from "lucide-react";
import MediaApprovalBadge from "@/components/media/MediaApprovalBadge";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";
import { toast } from "sonner";
import CreatePostModal from "@/components/artist/CreatePostModal";
import EditPostModal from "@/components/artist/EditPostModal";

const POST_TYPE_LABELS = {
  media: "Media",
  event: "Event",
  ticket: "Ticket",
  raffle: "Raffle",
  text: "Text",
};

const POST_TYPE_COLORS = {
  media: "text-purple-400 bg-purple-400/10",
  event: "text-accent bg-accent/10",
  ticket: "text-green-400 bg-green-400/10",
  raffle: "text-yellow-400 bg-yellow-400/10",
  text: "text-muted-foreground bg-muted",
};

function PostMediaPreview({ post }) {
  const urls = post.media_urls || [];
  const types = post.media_types || [];
  if (urls.length === 0) return null;

  const first = urls[0];
  const firstType = types[0] || "image";
  const isVideo = firstType === "video" || firstType === "video360";
  const isAudio = firstType === "audio";
  const rest = urls.length - 1;

  return (
    <div className="relative w-full rounded-lg overflow-hidden bg-black aspect-video mt-2">
      {isVideo ? (
        <video src={first} className="w-full h-full object-cover" muted playsInline preload="metadata" />
      ) : isAudio ? (
        <div className="w-full h-full flex items-center justify-center bg-secondary">
          <FileAudio className="w-8 h-8 text-primary" />
        </div>
      ) : (
        <img
          src={first}
          alt=""
          className="w-full h-full object-cover"
          onError={e => { e.target.style.display = "none"; e.target.nextSibling?.style && (e.target.nextSibling.style.display = "flex"); }}
        />
      )}
      {/* Fallback for broken images */}
      <div className="hidden w-full h-full absolute inset-0 items-center justify-center bg-secondary">
        <ImageIcon className="w-8 h-8 text-muted-foreground/40" />
      </div>
      {/* Type badge */}
      <div className="absolute top-2 left-2 flex gap-1">
        {isVideo && (
          <span className="bg-black/70 text-white text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full flex items-center gap-1">
            <Video className="w-2.5 h-2.5" /> {firstType === "video360" ? "360°" : "Video"}
          </span>
        )}
      </div>
      {/* +N more badge */}
      {rest > 0 && (
        <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs font-mono font-bold px-2 py-0.5 rounded-full">
          +{rest} more
        </div>
      )}
    </div>
  );
}

function PostCard({ post, onDelete, deleting, onEdit }) {
  const typeLabel = POST_TYPE_LABELS[post.type] || post.type;
  const typeColor = POST_TYPE_COLORS[post.type] || POST_TYPE_COLORS.text;

  return (
    <div className="rounded-xl bg-card border border-border/50 overflow-hidden">
      {post.cover_image && (
        <div className="w-full aspect-video bg-black overflow-hidden">
          <img src={post.cover_image} alt="" className="w-full h-full object-cover" />
        </div>
      )}
      <PostMediaPreview post={post} />
      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex flex-wrap items-center gap-1.5 min-w-0">
            <span className={`font-mono text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${typeColor}`}>
              {typeLabel}
            </span>
            <MediaApprovalBadge status={post.approval_status} />
          </div>
          <span className="font-mono text-[10px] text-muted-foreground whitespace-nowrap shrink-0">
            {format(new Date(post.created_date), "MMM d, yyyy")}
          </span>
        </div>

        {/* Caption */}
        {post.caption && (
          <p className="text-sm text-foreground leading-snug line-clamp-3">{post.caption}</p>
        )}

        {/* Tags */}
        {post.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {post.tags.map((t, i) => (
              <span key={i} className="text-[10px] font-mono text-primary bg-primary/10 px-2 py-0.5 rounded-full">#{t}</span>
            ))}
          </div>
        )}

        {/* Event info */}
        {post.event_title && (
          <p className="text-xs font-mono text-accent mt-1.5 flex items-center gap-1">
            <Calendar className="w-3 h-3 shrink-0" />
            {post.event_title}
            {post.event_date ? ` · ${format(new Date(post.event_date), "MMM d")}` : ""}
          </p>
        )}

        {/* Ticket price */}
        {post.ticket_price != null && (
          <p className="text-xs font-mono mt-1.5">
            🎟 ${Number(post.ticket_price).toFixed(2)}
            {post.ticket_original_price != null && Number(post.ticket_original_price) > Number(post.ticket_price) && (
              <span className="line-through text-muted-foreground ml-2">${Number(post.ticket_original_price).toFixed(2)}</span>
            )}
          </p>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/30">
          <div className="flex items-center gap-3 text-xs text-muted-foreground font-mono">
            <span className="flex items-center gap-1"><Heart className="w-3 h-3" />{post.like_count || 0}</span>
            <span className="flex items-center gap-1"><MessageCircle className="w-3 h-3" />{post.comment_count || 0}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-3 gap-1.5"
            onClick={() => onEdit(post)}
          >
            <Pencil className="w-3.5 h-3.5" />
            <span className="text-xs">Edit</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-3 text-destructive hover:bg-destructive/10 hover:text-destructive gap-1.5"
            onClick={() => onDelete(post.id)}
            disabled={deleting === post.id}
          >
            {deleting === post.id ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Trash2 className="w-3.5 h-3.5" />
            )}
            <span className="text-xs">Delete</span>
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function ArtistPosts() {
  const [artist, setArtist] = useState(null);
  const [posts, setPosts] = useState([]);
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    base44.auth.me().then(async (user) => {
      const artists = await base44.entities.Artist.filter({ user_email: user.email }, null, 1);
      if (!artists[0]) { setLoading(false); return; }
      setArtist(artists[0]);
      const [p, e] = await Promise.all([
        base44.entities.ArtistPost.filter({ artist_id: artists[0].id }, "-created_date", 50),
        base44.entities.Event.filter({ organizer_id: user.id }, "-date", 50),
      ]);
      setPosts(p);
      setEvents(e);
      setLoading(false);
    });
  }, []);

  const refreshPosts = async () => {
    if (!artist) return;
    setRefreshing(true);
    const p = await base44.entities.ArtistPost.filter({ artist_id: artist.id }, "-created_date", 50);
    setPosts(p);
    setRefreshing(false);
    toast.success("Posts refreshed");
  };

  const handleDelete = async (id) => {
    setDeleting(id);
    await base44.entities.ArtistPost.delete(id);
    setPosts(p => p.filter(x => x.id !== id));
    setDeleting(null);
    toast.success("Post deleted");
  };

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display font-black text-2xl sm:text-3xl tracking-tight">MY POSTS</h1>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={refreshPosts}
            disabled={refreshing}
            className="gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <Button onClick={() => setOpen(true)} size="sm" className="glow-lime font-display font-bold gap-1.5">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">New Post</span>
            <span className="sm:hidden">Post</span>
          </Button>
        </div>
      </div>

      {/* Post count */}
      {posts.length > 0 && (
        <p className="text-xs font-mono text-muted-foreground">{posts.length} post{posts.length !== 1 ? "s" : ""}</p>
      )}

      {/* Empty state */}
      {posts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-card rounded-xl border border-border/50 text-center px-6">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Music className="w-8 h-8 text-primary/60" />
          </div>
          <h3 className="font-display font-bold text-lg mb-1">No posts yet</h3>
          <p className="text-muted-foreground text-sm mb-5">Share your music, photos, events and more with your fans.</p>
          <Button onClick={() => setOpen(true)} className="glow-lime font-display font-bold gap-2">
            <Plus className="w-4 h-4" /> Create First Post
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              onDelete={handleDelete}
              deleting={deleting}
              onEdit={(p) => setEditing(p)}
            />
          ))}
        </div>
      )}

      <CreatePostModal
        open={open}
        onClose={() => setOpen(false)}
        artist={artist}
        events={events}
        onPostCreated={(post) => { setPosts(p => [post, ...p]); }}
      />

      <EditPostModal
        open={!!editing}
        post={editing}
        isAdmin={false}
        onClose={() => setEditing(null)}
        onUpdated={(updated) => { setPosts(p => p.map(x => x.id === updated.id ? updated : x)); }}
      />
    </div>
  );
}