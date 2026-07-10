import { useState, useEffect, useRef, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, Star, Trash2, Edit2, Image, Video, X, Check, DollarSign, ChevronDown, ChevronUp, View } from "lucide-react";
import Video360Player from "@/components/media/Video360Player";
import MediaVideoPlayer from "@/components/media/MediaVideoPlayer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { format } from "date-fns";
import MediaApprovalBadge from "@/components/media/MediaApprovalBadge";
import { uploadToSpaces, recordStorageUsage, deleteStorageRecord, shouldUseChunkedUpload } from "@/utils/spacesStorage";
import ChunkedVideoUploader from "@/components/media/ChunkedVideoUploader";
import VideoBudgetManager from "@/components/video/VideoBudgetManager";
import VideoUploadErrorPanel from "@/components/media/VideoUploadErrorPanel";
import VideoThumbnailPicker from "@/components/media/VideoThumbnailPicker";
import MuxStatusBadge from "@/components/media/MuxStatusBadge";
import PostInteractionBar from "@/components/media/PostInteractionBar";
import PostInteractionsSheet from "@/components/media/PostInteractionsSheet";

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];
const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/mov", "video/quicktime", "video/webm", "video/avi"];
const UPLOAD_TIMEOUT_MS = 300000; // 5 minutes
const STALL_TIMEOUT_MS = 60000;   // 60s without progress = stalled

/**
 * Detect if a video file is likely a 360° (equirectangular) video.
 * Checks:
 *  1. Filename keywords: "360", "equirectangular", "spherical", "vr"
 *  2. Aspect ratio close to 2:1 (equirectangular standard, e.g. 3840x1920, 4096x2048)
 * Returns a Promise<boolean>.
 */
function detect360Video(file) {
  return new Promise((resolve) => {
    // 1. Filename keyword check
    const name = file.name.toLowerCase();
    const keywords = ["360", "equirectangular", "spherical", "_vr", "-vr", "vr_", "vr-"];
    if (keywords.some(k => name.includes(k))) { resolve(true); return; }

    // 2. Aspect ratio check via hidden video element
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    const cleanup = () => URL.revokeObjectURL(url);

    video.onloadedmetadata = () => {
      const w = video.videoWidth;
      const h = video.videoHeight;
      cleanup();
      if (!w || !h) { resolve(false); return; }
      const ratio = w / h;
      // Equirectangular is exactly 2:1. Allow ±5% tolerance.
      const is2to1 = ratio >= 1.90 && ratio <= 2.10;
      // Also require a minimum resolution to avoid false positives (e.g. 640x320 landscape clips)
      const highRes = w >= 1920;
      resolve(is2to1 && highRes);
    };
    video.onerror = () => { cleanup(); resolve(false); };
    video.src = url;
  });
}

function MediaPostForm({ post, events, onSave, onCancel, organizerId = "" }) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [uploadError, setUploadError] = useState("");
  const [uploadFailed, setUploadFailed] = useState(false);
  const [chunkedUpload, setChunkedUpload] = useState(false); // true when using ChunkedVideoUploader
  const [is360Detected, setIs360Detected] = useState(post?.is_360 || false);
  const fileInputRef = useRef(null);
  const pendingFileRef = useRef(null); // store file for retry
  const [form, setForm] = useState(post || {
    media_url: "", media_type: "image", is_360: false, caption: "", venue_name: "",
    city: "", state: "", country: "", event_date: "", event_id: "",
    promote_to_front_page: false, thumbnail_url: "",
  });

  const doUpload = useCallback(async (file) => {
    if (!file) return;
    setUploadError("");
    setUploadFailed(false);

    const isVideo = file.type.startsWith("video");

    // Use chunked upload for large video files (≥100 MB)
    if (isVideo && shouldUseChunkedUpload(file)) {
      pendingFileRef.current = file;
      setChunkedUpload(true);
      setUploading(true);
      return;
    }

    const isImage = file.type.startsWith("image");

    if (isVideo && !ALLOWED_VIDEO_TYPES.includes(file.type)) {
      setUploadError("Unsupported video format. Use MP4, MOV, WebM, or AVI.");
      return;
    }
    if (!isVideo && !ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setUploadError("Unsupported image format. Use JPG, PNG, WebP, or GIF.");
      return;
    }

    pendingFileRef.current = file;
    setUploading(true);
    setUploadProgress(0);

    let lastProgressTime = Date.now();
    let lastProgressValue = 0;
    let timedOut = false;

    // Stall detection: if progress doesn't advance for STALL_TIMEOUT_MS, abort
    const stallCheck = setInterval(() => {
      if (Date.now() - lastProgressTime > STALL_TIMEOUT_MS) {
        timedOut = true;
        clearInterval(stallCheck);
        setUploading(false);
        setUploadProgress(null);
        setUploadFailed(true);
        toast.error("Upload stalled — please retry");
      }
    }, 5000);

    // Hard timeout
    const timeoutId = setTimeout(() => {
      if (!timedOut) {
        timedOut = true;
        clearInterval(stallCheck);
        setUploading(false);
        setUploadProgress(null);
        setUploadFailed(true);
        toast.error("Upload timed out");
      }
    }, UPLOAD_TIMEOUT_MS);

    try {
      // Simulated progress — advances slowly so it never permanently sits at 85%
      const tickSize = isVideo ? 2 : 6;
      const tickInterval = isVideo ? 1500 : 600;
      const progressInterval = setInterval(() => {
        if (timedOut) { clearInterval(progressInterval); return; }
        setUploadProgress(p => {
          const next = Math.min((p || 0) + tickSize, 80); // cap at 80, 100 set on success
          if (next > lastProgressValue) {
            lastProgressValue = next;
            lastProgressTime = Date.now();
          }
          return next;
        });
      }, tickInterval);

      const folder = organizerId ? `organizer/${organizerId}/media` : "organizer/media";
      const { file_url, file_size_bytes } = await uploadToSpaces(file, folder);

      clearInterval(progressInterval);
      clearInterval(stallCheck);
      clearTimeout(timeoutId);

      if (timedOut) return; // already showed error — don't update state

      setUploadProgress(100);
      setForm(f => ({ ...f, media_url: file_url, media_type: isVideo ? "video" : "image", _file_size_bytes: file_size_bytes }));
      recordStorageUsage({
        file_url,
        file_size_bytes,
        mime_type: file.type,
        file_category: "media_library",
      }).catch(() => {});
      setTimeout(() => setUploadProgress(null), 800);
    } catch (err) {
      clearInterval(stallCheck);
      clearTimeout(timeoutId);
      if (!timedOut) {
        setUploadFailed(true);
        setUploadProgress(null);
      }
    } finally {
      if (!timedOut) setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [organizerId]);

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    // Auto-detect 360 before uploading
    if (file.type.startsWith("video")) {
      const detected = await detect360Video(file);
      setIs360Detected(detected);
      setForm(f => ({ ...f, is_360: detected }));
    } else {
      setIs360Detected(false);
      setForm(f => ({ ...f, is_360: false }));
    }
    doUpload(file);
  };

  const handleRetry = () => {
    if (pendingFileRef.current) {
      doUpload(pendingFileRef.current);
    } else {
      fileInputRef.current?.click();
    }
  };

  const handleChooseAnother = () => {
    pendingFileRef.current = null;
    setUploadFailed(false);
    setUploadError("");
    setUploadProgress(null);
    fileInputRef.current?.click();
  };

  // Chunked upload completion
  const handleChunkedComplete = (result) => {
    if (!result?.file_url) return;
    const isVideo = pendingFileRef.current?.type?.startsWith("video");
    setForm(f => ({ ...f, media_url: result.file_url, media_type: isVideo ? "video" : "image", _file_size_bytes: result.file_size_bytes }));
    setUploading(false);
    setChunkedUpload(false);
    setUploadProgress(100);
    pendingFileRef.current = null;
    setTimeout(() => setUploadProgress(null), 800);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Chunked upload cancel
  const handleChunkedCancel = () => {
    setUploading(false);
    setChunkedUpload(false);
    pendingFileRef.current = null;
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="p-5 rounded-xl bg-card border border-primary/20 space-y-4">
      <div className="flex items-center justify-between">
        <p className="font-display font-bold">{post ? "Edit Post" : "New Media Post"}</p>
        <button onClick={onCancel}><X className="w-4 h-4 text-muted-foreground" /></button>
      </div>

      <div>
        <Label className="text-xs font-mono text-muted-foreground">Upload Media *</Label>
        <div className="mt-1 flex items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm,video/avi"
            onChange={handleFile}
            disabled={uploading}
            className="text-xs text-muted-foreground disabled:opacity-50"
          />
          {uploading && <div className="w-4 h-4 border-2 border-muted border-t-primary rounded-full animate-spin" />}
        </div>
        <p className="text-[10px] text-muted-foreground font-mono mt-1">
          Images: JPG, PNG, WebP, GIF · Videos: MP4, MOV, WebM · Large files may take longer to upload.
        </p>
        <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
          💡 For 360° videos: use MP4 with <strong className="text-foreground">H.264 + AAC</strong> and <strong className="text-foreground">fast-start</strong> enabled for best mobile playback.
        </p>
        {/* Chunked uploader for large videos */}
        {chunkedUpload && pendingFileRef.current && (
          <div className="mt-2">
            <ChunkedVideoUploader
              file={pendingFileRef.current}
              folder={organizerId ? `organizer/${organizerId}/media` : "organizer/media"}
              metadata={{ file_category: "media_library" }}
              onComplete={handleChunkedComplete}
              onCancel={handleChunkedCancel}
            />
          </div>
        )}

        {uploadError && !uploadFailed && !chunkedUpload && (
          <p className="text-xs text-destructive mt-1.5 flex items-center gap-1">
            <X className="w-3 h-3" /> {uploadError}
          </p>
        )}
        {uploadFailed && !chunkedUpload && (
          <div className="mt-2">
            <VideoUploadErrorPanel
              error={uploadError}
              fileName={pendingFileRef.current?.name}
              fileSize={pendingFileRef.current?.size}
              fileType={pendingFileRef.current?.type}
              uploadProgress={uploadProgress}
              module="organizer_media"
              onRetry={handleRetry}
              onChooseAnother={handleChooseAnother}
            />
          </div>
        )}
        {!uploadFailed && !chunkedUpload && uploadProgress !== null && (
          <div className="mt-2 space-y-1">
            <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
              <span>{uploadProgress < 80 ? "Uploading..." : uploadProgress < 100 ? "Processing..." : "Done!"}</span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
            </div>
          </div>
        )}
        {form.media_url && (
          <div className="mt-2 rounded-lg overflow-hidden max-h-48">
            {form.media_type === "video"
              ? <MediaVideoPlayer src={form.media_url} poster={form.thumbnail_url} className="w-full max-h-48" />
              : <img src={form.media_url} alt="" className="w-full max-h-48 object-cover rounded-lg" />
            }
          </div>
        )}
      </div>

      {/* 360° Badge — only shown when auto-detected as a real 360 video */}
      {form.media_type === "video" && form.media_url && is360Detected && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-accent/10 border border-accent/20">
          <div className="w-5 h-5 rounded border-2 border-accent bg-accent flex items-center justify-center shrink-0">
            <Check className="w-3 h-3 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-accent">360° Video Detected</p>
            <p className="text-xs text-muted-foreground">This video will use the immersive 360° player with drag-to-look support</p>
          </div>
        </div>
      )}

      {/* Video Thumbnail Picker — only shown when a video is uploaded */}
      {form.media_type === "video" && form.media_url && (
        <div className="p-4 rounded-xl bg-secondary/40 border border-border/50">
          <VideoThumbnailPicker
            videoUrl={form.media_url}
            thumbnailUrl={form.thumbnail_url}
            organizerId={organizerId}
            onChange={(url) => setForm(f => ({ ...f, thumbnail_url: url }))}
          />
        </div>
      )}

      <div>
        <Label className="text-xs font-mono text-muted-foreground">Caption</Label>
        <textarea value={form.caption} onChange={e => setForm(f => ({ ...f, caption: e.target.value }))}
          rows={3} placeholder="What's the vibe? Tell the story..."
          className="mt-1 w-full rounded-md bg-background border border-border/50 px-3 py-2 text-sm" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs font-mono text-muted-foreground">Venue Name</Label>
          <Input value={form.venue_name} onChange={e => setForm(f => ({ ...f, venue_name: e.target.value }))}
            placeholder="Club XYZ" className="mt-1 bg-background border-border/50" />
        </div>
        <div>
          <Label className="text-xs font-mono text-muted-foreground">Date</Label>
          <Input type="date" value={form.event_date} onChange={e => setForm(f => ({ ...f, event_date: e.target.value }))}
            className="mt-1 bg-background border-border/50" />
        </div>
        <div>
          <Label className="text-xs font-mono text-muted-foreground">City</Label>
          <Input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
            placeholder="New York" className="mt-1 bg-background border-border/50" />
        </div>
        <div>
          <Label className="text-xs font-mono text-muted-foreground">State</Label>
          <Input value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))}
            placeholder="NY" className="mt-1 bg-background border-border/50" />
        </div>
        <div>
          <Label className="text-xs font-mono text-muted-foreground">Country</Label>
          <Input value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))}
            placeholder="USA" className="mt-1 bg-background border-border/50" />
        </div>
        <div>
          <Label className="text-xs font-mono text-muted-foreground">Link to Event (optional)</Label>
          <select value={form.event_id} onChange={e => setForm(f => ({ ...f, event_id: e.target.value }))}
            className="mt-1 w-full bg-background border border-border/50 rounded-md px-3 py-2 text-sm">
            <option value="">None</option>
            {events.map(ev => <option key={ev.id} value={ev.id}>{ev.title}</option>)}
          </select>
        </div>
      </div>

      <div className="flex items-center gap-3 p-3 rounded-lg bg-yellow-400/10 border border-yellow-400/20">
        <button onClick={() => setForm(f => ({ ...f, promote_to_front_page: !f.promote_to_front_page }))}
          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all shrink-0 ${
            form.promote_to_front_page ? "bg-yellow-400 border-yellow-400" : "border-border/50 bg-background"
          }`}>
          {form.promote_to_front_page && <Check className="w-3 h-3 text-black" />}
        </button>
        <div>
          <p className="text-sm font-bold text-yellow-400">⭐ Promote to Front Page</p>
          <p className="text-xs text-muted-foreground">This media will be featured on the homepage</p>
        </div>
      </div>

      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => onSave(form)} disabled={!form.media_url || uploading} className="glow-lime font-bold">
          {post ? "Save Changes" : "Publish Post"}
        </Button>
      </div>
    </div>
  );
}

export default function OrganizerMediaLibrary() {
  const [posts, setPosts] = useState([]);
  const [events, setEvents] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [expandedBudget, setExpandedBudget] = useState(null);
  const [lightbox, setLightbox] = useState(null); // { post }
  const [interactionsPost, setInteractionsPost] = useState(null);
  const [interactionRefreshKey, setInteractionRefreshKey] = useState(0);

  useEffect(() => {
    (async () => {
      const u = await base44.auth.me();
      setUser(u);
      const [evs, ps] = await Promise.all([
        base44.entities.Event.filter({ organizer_id: u.id }, "-date", 50),
        base44.entities.OrganizerMediaPost.filter({ organizer_id: u.id, upload_section: "organizer_media" }, "-created_date", 100),
      ]);
      setEvents(evs);
      setPosts(ps);
      setLoading(false);
    })();
  }, []);

  const handleSave = async (form) => {
    const isAdmin = user.role === 'admin';
    if (editing) {
      const updateData = { ...form };
      // If media changed and user is not admin, reset to pending
      if (!isAdmin && form.media_url !== editing.media_url) {
        updateData.approval_status = 'pending_review';
      }
      await base44.entities.OrganizerMediaPost.update(editing.id, updateData);
      setPosts(prev => prev.map(p => p.id === editing.id ? { ...p, ...updateData } : p));
      toast.success("Post updated!");

      // If video media changed, trigger Mux encoding
      if (form.media_url !== editing.media_url && form.media_type === "video") {
        triggerMuxEncoding(editing.id, form.media_url);
      }
    } else {
      const isVideo = form.media_type === "video";
      const created = await base44.entities.OrganizerMediaPost.create({
        ...form,
        organizer_id: user.id,
        organizer_name: user.full_name,
        uploaded_by_email: user.email,
        uploaded_by_role: user.role || 'organizer',
        upload_section: 'organizer_media',
        approval_status: isAdmin ? 'approved' : 'pending_review',
        // For videos: mark as processing so AI moderation waits until encoding completes
        processing_status: isVideo ? 'processing' : 'not_needed',
      });
      setPosts(prev => [created, ...prev]);

      // Trigger Mux encoding for all videos (especially important for 360)
      if (isVideo) {
        triggerMuxEncoding(created.id, form.media_url);
      }

      if (!isAdmin) {
        if (isVideo) {
          toast.success("Video uploaded! It will be reviewed after encoding completes.");
        } else {
          toast.success("Media submitted for review. It will appear after admin approval.");
          // Notify all admins about new pending media (images only — video notifications
          // are sent by AI moderation after encoding completes in pollMuxStatuses)
          (async () => {
            const allUsers = await base44.entities.User.list(null, 500).catch(() => []);
            const admins = allUsers.filter(u => u.role === 'admin');
            const mediaLabel = created.caption || created.venue_name || created.media_url?.split('/').pop() || 'New media';
            await Promise.all(admins.map(admin =>
              base44.entities.Notification.create({
                user_email: admin.email,
                title: '🖼 New media pending review',
                message: `${user.full_name || user.email} uploaded "${mediaLabel}" — awaiting moderation.`,
                type: 'general',
                link: '/admin/moderation',
              }).catch(() => {})
            ));
          })();
        }
      } else {
        toast.success("Media post published!");
      }
    }
    setShowForm(false);
    setEditing(null);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this post?")) return;
    const post = posts.find(p => p.id === id);
    await base44.entities.OrganizerMediaPost.delete(id);
    setPosts(prev => prev.filter(p => p.id !== id));
    // Soft-delete storage record
    if (post?.media_url) deleteStorageRecord(post.media_url).catch(() => {});
    toast.success("Post deleted");
  };

  const triggerMuxEncoding = async (postId, videoUrl) => {
    try {
      const res = await base44.functions.invoke("createMuxAsset", {
        video_url: videoUrl,
        media_post_id: postId,
      });
      setPosts(prev => prev.map(p => p.id === postId ? {
        ...p,
        mux_asset_id: res.data?.mux_asset_id,
        mux_playback_id: res.data?.mux_playback_id,
        mux_playback_url: res.data?.mux_playback_url,
        mux_status: res.data?.mux_status,
      } : p));
    } catch (e) {
      console.error("Mux encoding trigger failed:", e);
    }
  };

  const handleMuxUpdate = (postId, data) => {
    setPosts(prev => prev.map(p => p.id === postId ? {
      ...p,
      mux_status: data.mux_status,
      mux_playback_id: data.mux_playback_id || p.mux_playback_id,
      mux_playback_url: data.mux_playback_url || p.mux_playback_url,
      mux_error_message: data.mux_error_message || p.mux_error_message,
      processing_status: data.mux_status === 'ready' ? 'complete' : data.mux_status === 'errored' ? 'failed' : p.processing_status,
    } : p));
  };

  const togglePromote = async (post) => {
    const newVal = !post.promote_to_front_page;
    await base44.entities.OrganizerMediaPost.update(post.id, { promote_to_front_page: newVal });
    setPosts(prev => prev.map(p => p.id === post.id ? { ...p, promote_to_front_page: newVal } : p));
    toast.success(newVal ? "Post promoted to front page!" : "Promotion removed");
  };

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="text-center sm:text-left">
          <h1 className="font-display font-black text-3xl tracking-tight">MEDIA LIBRARY</h1>
          <p className="text-sm text-muted-foreground mt-1">{posts.length} media post{posts.length !== 1 ? "s" : ""}</p>
          <p className="text-sm text-muted-foreground mt-2 max-w-xl leading-relaxed">
            Share photos and videos with your audience. Published media can appear on your <strong className="text-foreground">public profile</strong>, in your <strong className="text-foreground">followers' Feed</strong>, and in relevant Reizor media sections. Only approved public posts are visible to other users.
          </p>
          <p className="text-sm text-muted-foreground mt-1 max-w-xl leading-relaxed">
            Upload media through Media Library. Approved public media will automatically appear in Gallery.
          </p>
        </div>
        <div className="flex justify-center sm:justify-start">
          <Button onClick={() => { setShowForm(true); setEditing(null); }} className="glow-lime font-bold gap-2 w-full sm:w-auto">
            <Plus className="w-4 h-4" /> New Post
          </Button>
        </div>
      </div>


      {(showForm && !editing) && (
        <MediaPostForm events={events} onSave={handleSave} onCancel={() => setShowForm(false)} organizerId={user?.id} />
      )}

      {posts.length === 0 && !showForm ? (
        <div className="text-center py-20 space-y-4">
          <Video className="w-16 h-16 text-muted-foreground/20 mx-auto" />
          <div>
            <p className="font-display font-bold text-xl text-muted-foreground">No videos uploaded yet</p>
            <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto leading-relaxed">
              You don't have any videos uploaded at the moment. Upload a video to start fan engagement.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {posts.map(post => (
            <div key={post.id}>
              {editing?.id === post.id ? (
                <MediaPostForm post={editing} events={events} onSave={handleSave} onCancel={() => setEditing(null)} organizerId={user?.id} />
              ) : (
                <div className="rounded-xl bg-card border border-border/50 overflow-hidden">
                  <div className="relative">
                    <button onClick={() => setLightbox({ post })} className="w-full block cursor-pointer group/media">
                      {post.media_type === "video" ? (
                        post.thumbnail_url ? (
                          <img src={post.thumbnail_url} alt="" className="w-full h-48 object-cover" />
                        ) : post.mux_playback_url ? (
                          <MediaVideoPlayer src={post.mux_playback_url} poster={post.thumbnail_url} className="w-full h-48" controls={false} muted />
                        ) : (
                          <div className="w-full h-48 bg-secondary/40 flex items-center justify-center">
                            <Video className="w-10 h-10 text-muted-foreground/40" />
                          </div>
                        )
                      ) : (
                        <img src={post.media_url} alt="" className="w-full h-48 object-cover" />
                      )}
                      <div className="absolute inset-0 bg-black/0 group-hover/media:bg-black/20 transition-colors flex items-center justify-center">
                        <View className="w-8 h-8 text-white opacity-0 group-hover/media:opacity-100 transition-opacity drop-shadow-lg" />
                      </div>
                    </button>
                    <div className="absolute top-2 left-2 flex gap-1.5 pointer-events-none">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase flex items-center gap-1 ${
                        post.media_type === "video" ? "bg-accent/90 text-white" : "bg-primary/90 text-white"
                      }`}>
                        {post.media_type === "video" ? <Video className="w-3 h-3" /> : <Image className="w-3 h-3" />}
                        {post.media_type}
                      </span>
                      {post.is_360 && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-black bg-accent/90 text-white">360°</span>
                      )}
                      {post.promote_to_front_page && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-yellow-400 text-black flex items-center gap-1">
                          <Star className="w-3 h-3" /> Featured
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="p-4 space-y-2">
                    {post.caption && <p className="text-sm leading-snug line-clamp-2">{post.caption}</p>}
                    <div className="flex items-center gap-2 flex-wrap">
                      <MediaApprovalBadge status={post.approval_status} />
                      {post.approval_status === "pending_review" && (
                        <p className="text-[10px] text-yellow-400 font-mono">Not visible publicly yet</p>
                      )}
                      {(post.media_type === "video" && post.mux_asset_id) && (
                        <MuxStatusBadge post={post} onStatusUpdate={(data) => handleMuxUpdate(post.id, data)} />
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground font-mono">
                      {post.venue_name && <span>📍 {post.venue_name}</span>}
                      {post.city && <span>{post.city}{post.state ? `, ${post.state}` : ""}{post.country ? `, ${post.country}` : ""}</span>}
                      {post.event_date && <span>📅 {format(new Date(post.event_date), "MMM d, yyyy")}</span>}
                    </div>
                    <PostInteractionBar
                      key={`${post.id}-${interactionRefreshKey}`}
                      post={post}
                      currentUser={user}
                      mode="comments"
                      onOpenSheet={() => setInteractionsPost(post)}
                    />
                    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/30">
                      <button onClick={() => togglePromote(post)}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-mono font-bold border transition-all min-h-[40px] ${
                          post.promote_to_front_page
                            ? "bg-yellow-400/20 border-yellow-400/40 text-yellow-400"
                            : "border-border/50 text-muted-foreground hover:border-yellow-400/40 hover:text-yellow-400"
                        }`}>
                        <Star className="w-4 h-4" />
                        <span className="hidden sm:inline">Feature</span>
                      </button>
                      {post.media_type === "video" && (
                        <button
                          onClick={() => setExpandedBudget(expandedBudget === post.id ? null : post.id)}
                          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-display font-bold transition-all min-h-[40px] ${
                            expandedBudget === post.id
                              ? "bg-primary text-white shadow-md"
                              : "bg-primary/15 text-primary hover:bg-primary/25 border border-primary/30"
                          }`}
                        >
                          <DollarSign className="w-4 h-4" />
                          {expandedBudget === post.id ? "Close Budget" : "Add Budget"}
                          {expandedBudget === post.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                      )}
                      <div className="flex-1 sm:flex-initial" />
                      <button onClick={() => setEditing(post)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-mono border border-border/50 text-muted-foreground hover:text-foreground transition-colors min-h-[40px]">
                        <Edit2 className="w-4 h-4" />
                        <span className="hidden sm:inline">Edit</span>
                      </button>
                      <button onClick={() => handleDelete(post.id)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-mono border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors min-h-[40px]">
                        <Trash2 className="w-4 h-4" />
                        <span className="hidden sm:inline">Delete</span>
                      </button>
                    </div>
                    {expandedBudget === post.id && post.media_type === "video" && (
                      <div className="mt-3">
                        <VideoBudgetManager
                          videoUrl={post.media_url}
                          videoTitle={post.caption || ""}
                          contextType="organizer_media"
                          contextId={post.id}
                          ownerType="organizer"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
{/* Post Interactions Sheet */}
      <PostInteractionsSheet
        post={interactionsPost}
        currentUser={user}
        isOwner={true}
        mode="comments"
        open={!!interactionsPost}
        onClose={(counts) => {
          setInteractionsPost(null);
          setInteractionRefreshKey(k => k + 1);
        }}
      />

{/* Lightbox with 360° support */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black flex flex-col select-none"
          onClick={() => setLightbox(null)}
        >
{/* Top bar — hide for 360 videos since the player has its own close button */}
          {!lightbox.post.is_360 && (
            <div className="flex items-center justify-between px-4 shrink-0 bg-black/60 backdrop-blur-sm"
              style={{ paddingTop: "max(env(safe-area-inset-top, 0px), 44px)", paddingBottom: 12 }}>
              <button onClick={() => setLightbox(null)} className="p-2 rounded-full bg-white/20 hover:bg-white/40 transition-colors">
                <X className="w-5 h-5 text-white" />
              </button>
              <p className="text-white/50 text-xs font-mono truncate max-w-[200px]">
                {lightbox.post.caption || lightbox.post.venue_name || "Media Preview"}
              </p>
            </div>
          )}

          {/* Media area */}
          <div className="flex-1 flex items-center justify-center min-h-0 p-4" onClick={e => e.stopPropagation()}>
            {lightbox.post.is_360 ? (
              <div className="w-full max-w-2xl"><Video360Player src={lightbox.post.mux_playback_url || lightbox.post.media_url} mobileSrc={lightbox.post.mobile_playback_url} desktopSrc={lightbox.post.desktop_optimized_url} poster={lightbox.post.thumbnail_url} playbackId={lightbox.post.mux_playback_id} muxStatus={lightbox.post.mux_status} onClose={() => setLightbox(null)} trackingVideoId={lightbox.post.id} trackingEventId={lightbox.post.event_id || null} trackingOwnerType="organizer" /></div>
            ) : lightbox.post.media_type === "video" ? (
              <MediaVideoPlayer src={lightbox.post.mux_playback_url || lightbox.post.media_url} poster={lightbox.post.thumbnail_url} className="max-h-full max-w-full rounded-lg" autoPlay trackingVideoId={lightbox.post.id} trackingEventId={lightbox.post.event_id || null} trackingOwnerType="organizer" />
            ) : (
              <img src={lightbox.post.media_url} alt={lightbox.post.caption || ""} className="max-h-full max-w-full object-contain rounded-lg" />
            )}
          </div>

          {/* Caption bar */}
          <div className="shrink-0 bg-black/60 backdrop-blur-sm px-4 py-3 text-center"
            style={{ paddingBottom: "max(env(safe-area-inset-bottom, 0px), 16px)" }}>
            {lightbox.post.caption && (
              <p className="text-sm text-white/80 font-mono">{lightbox.post.caption}</p>
            )}
            {lightbox.post.is_360 && (
              <p className="text-xs text-accent font-mono mt-1">360° — Drag to look around</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}