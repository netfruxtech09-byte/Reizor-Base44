import { useState, useEffect } from "react";
import { Search, Pencil, Music } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";
import { toast } from "sonner";
import MediaApprovalBadge from "@/components/media/MediaApprovalBadge";
import EditPostModal from "@/components/artist/EditPostModal";

export default function AdminArtistPosts() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const all = await base44.entities.ArtistPost.filter({}, "-created_date", 200);
        setPosts(all);
      } catch {
        toast.error("Failed to load posts");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = posts.filter(p => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      (p.caption || "").toLowerCase().includes(q) ||
      (p.artist_name || "").toLowerCase().includes(q);
    const matchStatus = statusFilter === "all" || p.approval_status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display font-black text-2xl sm:text-3xl tracking-tight">ARTIST POSTS</h1>
        <p className="text-xs text-muted-foreground mt-1">View and edit posts from all artists.</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search caption or artist…"
            className="pl-9 bg-card border-border/50"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="rounded-xl bg-card border border-border/50 px-3 py-2 text-sm"
        >
          <option value="all">All statuses</option>
          <option value="approved">Approved</option>
          <option value="pending_review">Pending</option>
          <option value="rejected">Rejected</option>
          <option value="blocked">Blocked</option>
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-card rounded-xl border border-border/50 text-center">
          <Music className="w-8 h-8 text-muted-foreground/40 mb-2" />
          <p className="text-sm text-muted-foreground">No posts found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(post => {
            const firstType = post.media_types?.[0];
            const firstUrl = post.media_urls?.[0];
            const isVideo = firstType === "video" || firstType === "video360";
            const previewSrc = post.cover_image || (!isVideo ? firstUrl : null);
            return (
              <div key={post.id} className="rounded-xl bg-card border border-border/50 overflow-hidden flex flex-col">
                {(previewSrc || isVideo) && (
                  <div className="w-full aspect-video bg-black overflow-hidden">
                    {isVideo ? (
                      <video src={firstUrl} className="w-full h-full object-cover" muted playsInline preload="metadata" />
                    ) : (
                      <img src={previewSrc} alt="" className="w-full h-full object-cover" />
                    )}
                  </div>
                )}
                <div className="p-4 flex-1 flex flex-col">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-mono text-muted-foreground truncate">{post.artist_name || "Unknown artist"}</span>
                    <MediaApprovalBadge status={post.approval_status} />
                  </div>
                  <p className="text-sm line-clamp-3 flex-1">
                    {post.caption || <span className="text-muted-foreground italic">No caption</span>}
                  </p>
                  {post.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {post.tags.slice(0, 4).map((t, i) => (
                        <span key={i} className="text-[10px] font-mono text-primary bg-primary/10 px-2 py-0.5 rounded-full">#{t}</span>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/30">
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {format(new Date(post.created_date), "MMM d, yyyy")}
                    </span>
                    <Button size="sm" variant="outline" className="gap-1.5 h-8" onClick={() => setEditing(post)}>
                      <Pencil className="w-3.5 h-3.5" /> Edit
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <EditPostModal
        open={!!editing}
        post={editing}
        isAdmin
        onClose={() => setEditing(null)}
        onUpdated={(updated) => { setPosts(prev => prev.map(p => p.id === updated.id ? updated : p)); }}
      />
    </div>
  );
}