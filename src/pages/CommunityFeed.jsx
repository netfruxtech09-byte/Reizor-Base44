import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import BackButton from "@/components/shared/BackButton";
import { uploadToSpaces, recordStorageUsage, deleteStorageRecord } from "@/utils/spacesStorage";
import { Heart, MessageCircle, Send, Image, Calendar, Type, X, Upload, Trash2, Users, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import PageMeta from "@/components/seo/PageMeta";
import MediaVideoPlayer from "@/components/media/MediaVideoPlayer";

const ROLE_BADGE = {
  admin: { label: "Admin", color: "text-red-400 bg-red-400/10" },
  organizer: { label: "Organizer", color: "text-accent bg-accent/10" },
  artist: { label: "Artist", color: "text-primary bg-primary/10" },
  whitelabel: { label: "Partner", color: "text-yellow-400 bg-yellow-400/10" },
  user: { label: "Fan", color: "text-muted-foreground bg-muted" },
};

function Avatar({ src, name, size = "w-9 h-9" }) {
  if (src) return <img src={src} alt={name} className={`${size} rounded-full object-cover shrink-0`} />;
  return (
    <div className={`${size} rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary shrink-0 text-sm`}>
      {(name || "?")[0].toUpperCase()}
    </div>
  );
}

function PostCard({ post, user, onLike, onDelete, onCommentAdded, likeRecord, likeCount, commentCount }) {
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [liking, setLiking] = useState(false);
  const liked = !!likeRecord;

  const loadComments = async () => {
    if (showComments) { setShowComments(false); return; }
    setLoadingComments(true);
    const data = await base44.entities.CommunityComment.filter({ post_id: post.id }, "created_date", 100);
    setComments(data);
    setShowComments(true);
    setLoadingComments(false);
  };

  const submitComment = async () => {
    if (!newComment.trim()) return;
    if (!user) {
      base44.auth.redirectToLogin(window.location.pathname);
      return;
    }
    setSubmitting(true);
    const c = await base44.entities.CommunityComment.create({
      post_id: post.id,
      author_email: user.email,
      author_name: user.full_name || user.email,
      author_image: user.profile_image || "",
      author_role: user.role || "user",
      content: newComment.trim(),
    }).catch((err) => { toast.error("Failed to post comment. Please try again."); setSubmitting(false); return null; });
    if (!c) return;
    setComments(prev => [...prev, c]);
    onCommentAdded(post.id);
    setNewComment("");
    setSubmitting(false);
  };

  const roleMeta = ROLE_BADGE[post.author_role] || ROLE_BADGE.user;

  return (
    <div className="rounded-2xl bg-card border border-border/50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 pb-3">
        <Avatar src={post.author_image} name={post.author_name} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-sm">{post.author_name}</span>
            <span className={`text-[10px] font-mono font-bold uppercase px-1.5 py-0.5 rounded ${roleMeta.color}`}>{roleMeta.label}</span>
          </div>
          <p className="text-[10px] text-muted-foreground font-mono">
            {post.created_date ? formatDistanceToNow(new Date(post.created_date), { addSuffix: true }) : ""}
          </p>
        </div>
        {user?.email === post.author_email && (
          <button onClick={() => onDelete(post.id)} className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-destructive transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Content */}
      {post.content && <p className="px-4 pb-3 text-sm leading-relaxed">{post.content}</p>}

      {/* Photo — only show if approved (or no approval_status yet for legacy posts) */}
      {post.media_url && (!post.media_approval_status || post.media_approval_status === "approved") && (
        <div className="relative">
          {post.media_type === "video" ? (
            post.is_playable !== false ? (
              <MediaVideoPlayer src={post.media_url} className="w-full max-h-80 object-cover" controls autoPlay={false} trackingVideoId={post.id} trackingOwnerType="organizer" />
            ) : (
              <div className="w-full h-40 flex flex-col items-center justify-center bg-black/80 gap-2">
                <AlertTriangle className="w-5 h-5 text-muted-foreground/50" />
                <p className="text-xs text-muted-foreground font-mono">This video is currently unavailable due to streaming limits.</p>
              </div>
            )
          ) : (
            <img src={post.media_url} alt={post.media_title || ""} className="w-full max-h-80 object-cover" />
          )}
          {(post.media_title || post.media_date) && (
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
              {post.media_title && <p className="text-white font-bold text-sm">{post.media_title}</p>}
              {post.media_date && <p className="text-white/70 text-xs font-mono">{format(new Date(post.media_date), "MMM dd, yyyy")}</p>}
            </div>
          )}
        </div>
      )}
      {/* Show pending notice to the post author */}
      {post.media_url && post.media_approval_status === "pending_review" && user?.email === post.author_email && (
        <div className="mx-4 mb-2 px-3 py-2 rounded-lg bg-yellow-400/10 border border-yellow-400/20">
          <p className="text-xs text-yellow-400 font-mono">📸 Your media is pending admin approval and is not yet visible publicly.</p>
        </div>
      )}

      {/* Event Share */}
      {post.type === "event_share" && post.event_title && (
        <Link to={post.event_id ? `/events/${post.event_id}` : "#"}
          className="mx-4 mb-3 flex gap-3 p-3 rounded-xl bg-secondary border border-border/50 hover:border-accent/40 transition-all">
          <Calendar className="w-8 h-8 text-accent shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="font-bold text-sm truncate">{post.event_title}</p>
            {post.event_venue && <p className="text-xs text-muted-foreground font-mono truncate">{post.event_venue}{post.event_city ? `, ${post.event_city}` : ""}</p>}
            {post.event_date && <p className="text-xs text-accent font-mono mt-0.5 font-bold">{format(new Date(post.event_date), "EEE MMM dd, yyyy")}</p>}
          </div>
        </Link>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1 px-3 py-2 border-t border-border/30">
        <button onClick={() => onLike(post, likeRecord)} disabled={liking} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-mono transition-all ${liked ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-primary hover:bg-primary/5"}`}>
          <Heart className={`w-4 h-4 ${liked ? "fill-primary" : ""}`} />
          {likeCount}
        </button>
        <button onClick={loadComments} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-mono transition-all ${showComments ? "text-accent bg-accent/10" : "text-muted-foreground hover:text-accent hover:bg-accent/5"}`}>
          <MessageCircle className="w-4 h-4" />
          {commentCount}
        </button>
      </div>

      {/* Comments */}
      {showComments && (
        <div className="border-t border-border/30 p-4 space-y-3 bg-background/30">
          {loadingComments ? (
            <div className="flex justify-center py-3"><div className="w-5 h-5 border-2 border-muted border-t-primary rounded-full animate-spin" /></div>
          ) : (
            <>
              {comments.map(c => (
                <div key={c.id} className="flex gap-2.5">
                  <Avatar src={c.author_image} name={c.author_name} size="w-7 h-7" />
                  <div className="flex-1 bg-secondary rounded-xl px-3 py-2">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-xs font-bold">{c.author_name}</span>
                      <span className={`text-[9px] font-mono font-bold uppercase px-1 py-0.5 rounded ${(ROLE_BADGE[c.author_role] || ROLE_BADGE.user).color}`}>{(ROLE_BADGE[c.author_role] || ROLE_BADGE.user).label}</span>
                    </div>
                    <p className="text-xs text-foreground/90">{c.content}</p>
                  </div>
                </div>
              ))}
              {user ? (
                <div className="flex gap-2.5 pt-1">
                  <Avatar src={user.profile_image} name={user.full_name || user.email} size="w-7 h-7" />
                  <div className="flex-1 flex gap-2">
                    <input
                      value={newComment}
                      onChange={e => setNewComment(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && !e.shiftKey && submitComment()}
                      placeholder="Write a comment..."
                      className="flex-1 rounded-xl bg-secondary border border-border/50 px-3 py-1.5 text-xs"
                    />
                    <button onClick={submitComment} disabled={submitting || !newComment.trim()}
                      className="p-2 rounded-xl bg-primary text-primary-foreground disabled:opacity-40 hover:bg-primary/90 transition-colors">
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => base44.auth.redirectToLogin(window.location.pathname)}
                  className="w-full text-xs text-muted-foreground hover:text-primary font-mono py-2 px-3 rounded-xl bg-secondary border border-border/50 text-left transition-colors"
                >
                  Log in to comment →
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function PostComposer({ user, events, onPost }) {
  const [type, setType] = useState("text");
  const [content, setContent] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaType, setMediaType] = useState("image");
  const [mediaTitle, setMediaTitle] = useState("");
  const [mediaDate, setMediaDate] = useState(new Date().toISOString().slice(0, 10));
  const [uploading, setUploading] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [eventSearch, setEventSearch] = useState("");
  const [eventLinkInput, setEventLinkInput] = useState("");
  const [saving, setSaving] = useState(false);
  const fileRef = useRef();

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const folder = user?.id ? `community/${user.id}` : "community/general";
      const { file_url, file_size_bytes } = await uploadToSpaces(file, folder);
      const isVideo = file.type.startsWith("video");
      setMediaUrl(file_url);
      setMediaType(isVideo ? "video" : "image");
      // Track storage usage (fire-and-forget)
      recordStorageUsage({
        file_url,
        file_size_bytes,
        mime_type: file.type || "image/jpeg",
        file_category: isVideo ? "community_video" : "community_image",
        entity_type: "community_post",
        entity_id: user?.id || "",
      }).catch(() => {});
    } catch {
      toast.error("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!content.trim() && !mediaUrl && !selectedEvent) return;
    setSaving(true);
    const isAdmin = user.role === 'admin';
    // Media approval: admin = approved immediately, others = pending
    const mediaApprovalStatus = mediaUrl ? (isAdmin ? 'approved' : 'pending_review') : 'approved';
    const post = await base44.entities.CommunityPost.create({
      author_email: user.email,
      author_name: user.full_name || user.email,
      author_role: user.role || "user",
      author_image: user.profile_image || "",
      type,
      content: content.trim(),
      media_url: mediaUrl,
      media_type: mediaUrl ? mediaType : undefined,
      media_title: mediaTitle,
      media_date: mediaDate,
      media_approval_status: mediaApprovalStatus,
      event_id: selectedEvent?.id || "",
      event_title: selectedEvent?.title || "",
      event_date: selectedEvent?.date || "",
      event_venue: selectedEvent?.venue_name || "",
      event_city: selectedEvent?.city || "",
      like_count: 0,
      comment_count: 0,
      liked_by: [],
    });
    onPost(post);
    setContent(""); setMediaUrl(""); setMediaTitle(""); setSelectedEvent(null); setEventSearch(""); setEventLinkInput("");
    setMediaDate(new Date().toISOString().slice(0, 10)); setType("text");
    setSaving(false);
    if (mediaUrl && !isAdmin) {
      toast.success("Post shared! Your media is pending admin approval and will appear after review.");
    } else {
      toast.success("Post shared!");
    }
  };

  const filteredEvents = events.filter(e =>
    e.title?.toLowerCase().includes(eventSearch.toLowerCase()) && e.status === "published"
  ).slice(0, 5);

  return (
    <div className="rounded-2xl bg-card border border-border/50 p-4 space-y-4">
      <div className="flex items-center gap-3">
        <Avatar src={user.profile_image} name={user.full_name || user.email} />
        <span className="font-bold text-sm">{user.full_name || user.email}</span>
        <span className={`text-[10px] font-mono font-bold uppercase px-1.5 py-0.5 rounded ml-auto ${(ROLE_BADGE[user.role] || ROLE_BADGE.user).color}`}>
          {(ROLE_BADGE[user.role] || ROLE_BADGE.user).label}
        </span>
      </div>

      {/* Type tabs */}
      <div className="flex gap-2">
        {[
          { value: "text", icon: Type, label: "Update" },
          { value: "photo", icon: Image, label: "Photo/Video" },
          { value: "event_share", icon: Calendar, label: "Share Event" },
        ].map(({ value, icon: Icon, label }) => (
          <button key={value} onClick={() => setType(value)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all ${type === value ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}>
            <Icon className="w-3.5 h-3.5" /> {label}
          </button>
        ))}
      </div>

      <textarea
        value={content}
        onChange={e => setContent(e.target.value)}
        rows={3}
        placeholder={type === "event_share" ? "Say something about this event..." : type === "photo" ? "Caption your photo..." : "What's happening? Share with the community..."}
        className="w-full rounded-xl bg-secondary border border-border/50 px-3 py-2 text-sm resize-none"
      />

      {/* Photo upload */}
      {type === "photo" && (
        <div className="space-y-2">
          {mediaUrl ? (
            <div className="relative rounded-xl overflow-hidden">
              {mediaType === "video" ? (
                <video src={mediaUrl} className="w-full max-h-48 object-cover rounded-xl" />
              ) : (
                <img src={mediaUrl} alt="" className="w-full max-h-48 object-cover rounded-xl" />
              )}
              <button onClick={() => setMediaUrl("")} className="absolute top-2 right-2 p-1 rounded-full bg-black/60 text-white hover:bg-black/80">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-border/50 hover:border-primary/40 rounded-xl p-6 cursor-pointer transition-all" onClick={() => fileRef.current?.click()}>
              <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleUpload} />
              <Upload className="w-6 h-6 text-muted-foreground mb-1" />
              <span className="text-sm text-muted-foreground">{uploading ? "Uploading..." : "Click to upload photo or video"}</span>
            </label>
          )}
          {mediaUrl && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Title</label>
                <input value={mediaTitle} onChange={e => setMediaTitle(e.target.value)} placeholder="e.g. Main stage at Berghain"
                  className="mt-1 w-full rounded-lg bg-secondary border border-border/50 px-2.5 py-1.5 text-xs font-mono" />
              </div>
              <div>
                <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Date</label>
                <input type="date" value={mediaDate} onChange={e => setMediaDate(e.target.value)}
                  className="mt-1 w-full rounded-lg bg-secondary border border-border/50 px-2.5 py-1.5 text-xs font-mono" />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Event share */}
      {type === "event_share" && (
        <div className="space-y-3">
          {/* Search by name */}
          <div>
            <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Search by name</label>
            <input
              value={eventSearch}
              onChange={e => { setEventSearch(e.target.value); setEventLinkInput(""); }}
              placeholder="Search events by name..."
              className="mt-1 w-full rounded-xl bg-secondary border border-border/50 px-3 py-2 text-sm"
            />
          </div>
          {eventSearch && filteredEvents.length > 0 && !selectedEvent && (
            <div className="rounded-xl bg-secondary border border-border/50 overflow-hidden">
              {filteredEvents.map(e => (
                <button key={e.id} onClick={() => { setSelectedEvent(e); setEventSearch(e.title); setEventLinkInput(""); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-muted transition-colors border-b border-border/30 last:border-0">
                  <Calendar className="w-4 h-4 text-accent shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-bold truncate">{e.title}</p>
                    <p className="text-xs text-muted-foreground font-mono">{e.venue_name}, {e.city} · {e.date ? format(new Date(e.date), "MMM dd") : ""}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Paste event link */}
          {!selectedEvent && (
            <div>
              <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Or paste event link</label>
              <div className="flex gap-2 mt-1">
                <input
                  value={eventLinkInput}
                  onChange={e => { setEventLinkInput(e.target.value); setEventSearch(""); }}
                  placeholder="https://..."
                  className="flex-1 rounded-xl bg-secondary border border-border/50 px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={() => {
                    const match = eventLinkInput.match(/\/events\/([a-zA-Z0-9]+)/);
                    if (match) {
                      const found = events.find(e => e.id === match[1]);
                      if (found) { setSelectedEvent(found); setEventLinkInput(""); }
                      else toast.error("Event not found for this link");
                    } else toast.error("Invalid event link");
                  }}
                  className="px-3 py-2 rounded-xl bg-accent text-accent-foreground text-xs font-mono font-bold hover:opacity-90 transition-opacity"
                >
                  Add
                </button>
              </div>
            </div>
          )}

          {/* Upload flyer */}
          {!selectedEvent && (
            <div>
              <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Or upload event flyer</label>
              <label className="mt-1 flex items-center gap-2 px-3 py-2.5 rounded-xl border border-dashed border-border/50 hover:border-primary/40 cursor-pointer transition-all">
                <Upload className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">{uploading ? "Uploading flyer..." : "Upload flyer image"}</span>
                <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setUploading(true);
                  try {
                    const folder = user?.id ? `community/${user.id}` : "community/general";
                    const { file_url, file_size_bytes } = await uploadToSpaces(file, folder);
                    setMediaUrl(file_url);
                    setMediaType("image");
                    setType("photo");
                    // Track storage usage (fire-and-forget)
                    recordStorageUsage({
                      file_url,
                      file_size_bytes,
                      mime_type: file.type || "image/jpeg",
                      file_category: "community_image",
                      entity_type: "community_post",
                      entity_id: user?.id || "",
                    }).catch(() => {});
                    toast.success("Flyer uploaded — sharing as photo post");
                  } catch {
                    toast.error("Upload failed. Please try again.");
                  } finally {
                    setUploading(false);
                  }
                }} />
              </label>
            </div>
          )}

          {selectedEvent && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-accent/10 border border-accent/30">
              <Calendar className="w-5 h-5 text-accent shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm truncate">{selectedEvent.title}</p>
                <p className="text-xs text-muted-foreground font-mono">{selectedEvent.venue_name}, {selectedEvent.city}</p>
              </div>
              <button onClick={() => { setSelectedEvent(null); setEventSearch(""); setEventLinkInput(""); }} className="text-muted-foreground hover:text-destructive">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      )}

      <Button onClick={handleSubmit} disabled={saving || uploading || (!content.trim() && !mediaUrl && !selectedEvent)}
        className="w-full glow-lime font-display font-bold">
        {saving ? "Sharing..." : "Share with Community"}
      </Button>
    </div>
  );
}

export default function CommunityFeed() {
  const [user, setUser] = useState(null);
  const [posts, setPosts] = useState([]);
  const [events, setEvents] = useState([]);
  const [likes, setLikes] = useState({});
  const [comments, setComments] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const [u, p, e] = await Promise.all([
        base44.auth.me().catch(() => null),
        base44.entities.CommunityPost.list("-created_date", 50),
        base44.entities.Event.filter({ status: "published" }, "-date", 100),
      ]);
      setUser(u);
      setPosts(p);
      setEvents(e);

      // Fetch all likes and comments for these posts
      if (p.length > 0) {
        const [allLikes, allComments] = await Promise.all([
          base44.entities.CommunityPostLike.list(null, 1000),
          base44.entities.CommunityComment.list(null, 1000),
        ]);
        const likesMap = {};
        const commentsMap = {};
        p.forEach(post => {
          likesMap[post.id] = allLikes.filter(l => l.post_id === post.id);
          commentsMap[post.id] = allComments.filter(c => c.post_id === post.id);
        });
        setLikes(likesMap);
        setComments(commentsMap);
      }

      setLoading(false);
    };
    load();
  }, []);

  const handleLike = async (post, likeRecord) => {
    if (!user) {
      base44.auth.redirectToLogin(window.location.pathname);
      return;
    }

    const postLikes = likes[post.id] || [];
    if (likeRecord) {
      // Unlike: optimistic delete
      setLikes(prev => ({
        ...prev,
        [post.id]: prev[post.id].filter(l => l.id !== likeRecord.id),
      }));
      base44.entities.CommunityPostLike.delete(likeRecord.id).catch(() => {
        setLikes(prev => ({
          ...prev,
          [post.id]: [...prev[post.id], likeRecord],
        }));
        toast.error("Failed to unlike. Please try again.");
      });
    } else {
      // Like: check for duplicate, then create
      const exists = postLikes.some(l => l.user_email === user.email);
      if (exists) { toast.info("Already liked"); return; }
      const newLike = { post_id: post.id, user_email: user.email };
      setLikes(prev => ({
        ...prev,
        [post.id]: [...(prev[post.id] || []), newLike],
      }));
      base44.entities.CommunityPostLike.create(newLike).catch(() => {
        setLikes(prev => ({
          ...prev,
          [post.id]: prev[post.id].slice(0, -1),
        }));
        toast.error("Failed to like. Please try again.");
      });
    }
  };

  const handleDelete = async (postId) => {
    const post = posts.find(p => p.id === postId);
    await base44.entities.CommunityPost.delete(postId);
    // Soft-delete storage record if post had media
    if (post?.media_url) deleteStorageRecord(post.media_url).catch(() => {});
    setPosts(prev => prev.filter(p => p.id !== postId));
    setLikes(prev => { const copy = { ...prev }; delete copy[postId]; return copy; });
    setComments(prev => { const copy = { ...prev }; delete copy[postId]; return copy; });
    toast.success("Post deleted");
  };

  const handleCommentAdded = (postId) => {
    setComments(prev => ({
      ...prev,
      [postId]: [...(prev[postId] || []), {}], // Placeholder, will be filled from list
    }));
  };

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 space-y-6">
      <PageMeta
        title="Community Feed — REIZOR"
        description="Share concert moments, event flyers, and connect with the music scene. Join the Reizor community and discover events through fellow fans."
        canonical="https://reizor.com/community"
      />
      {/* Header */}
      <div>
        <BackButton to="/" label="Home" />
        <div className="flex items-center gap-2 mb-1 mt-2">
          <Users className="w-5 h-5 text-primary" />
          <span className="font-mono text-xs text-primary tracking-[0.3em] uppercase">★ Community</span>
        </div>
        <h1 className="font-display font-black text-4xl tracking-tight">COMMUNITY FEED</h1>
        <p className="text-sm text-muted-foreground mt-1">Share events, concert moments & connect with the scene</p>
      </div>

      {/* Composer */}
      {user ? (
        <PostComposer user={user} events={events} onPost={post => setPosts(prev => [post, ...prev])} />
      ) : (
        <div className="p-5 rounded-2xl bg-card border border-border/50 text-center">
          <p className="text-muted-foreground text-sm mb-3">Sign in to post and comment</p>
          <Button onClick={() => base44.auth.redirectToLogin()} className="glow-lime font-display font-bold">Sign In</Button>
        </div>
      )}

      {/* Feed */}
      {posts.length === 0 ? (
        <div className="py-16 text-center rounded-2xl bg-card border border-border/50">
          <Users className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground">No posts yet — be the first to share!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map(post => {
            const postLikes = likes[post.id] || [];
            const postComments = comments[post.id] || [];
            const userLike = postLikes.find(l => l.user_email === user?.email);
            return (
              <PostCard
                key={post.id}
                post={post}
                user={user}
                onLike={handleLike}
                onDelete={handleDelete}
                onCommentAdded={handleCommentAdded}
                likeRecord={userLike}
                likeCount={postLikes.length}
                commentCount={postComments.length}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}