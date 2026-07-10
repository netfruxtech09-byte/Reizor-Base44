import { useState, useEffect } from "react";
import { Plus, Trash2, Edit2, Images, Upload, X, Eye, EyeOff, Grid, ChevronDown, ChevronUp, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { base44 } from "@/api/base44Client";
import { uploadToSpaces, recordStorageUsage, deleteStorageRecord } from "@/utils/spacesStorage";
import { toast } from "sonner";
import MediaApprovalBadge from "@/components/media/MediaApprovalBadge";
import { useMediaPicker } from "@/hooks/useMediaPicker";
import VideoBudgetManager from "@/components/video/VideoBudgetManager";

const BLANK = { title: "", description: "", is_public: true };

export default function ArtistGallery() {
  const { openGallery } = useMediaPicker();
  const [artist, setArtist] = useState(null);
  const [albums, setAlbums] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // album id or "new"
  const [form, setForm] = useState(BLANK);
  const [saving, setSaving] = useState(false);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [expandedAlbum, setExpandedAlbum] = useState(null);
  const [expandedVideoBudget, setExpandedVideoBudget] = useState(null); // "albumId-mediaIndex"
  // Temp media for the form being edited
  const [formMedia, setFormMedia] = useState({ urls: [], types: [], captions: [], titles: [], dates: [], thumbnails: [] });
  const [uploadingThumbIdx, setUploadingThumbIdx] = useState(null);

  useEffect(() => {
    base44.auth.me().then(async (user) => {
      const artists = await base44.entities.Artist.filter({ user_email: user.email }, null, 1);
      if (!artists[0]) { setLoading(false); return; }
      const a = artists[0];
      setArtist(a);
      const albs = await base44.entities.ArtistAlbum.filter({ artist_id: a.id }, "sort_order", 50);
      setAlbums(albs);
      setLoading(false);
    });
  }, []);

  const startNew = () => {
    setForm(BLANK);
    setFormMedia({ urls: [], types: [], captions: [], titles: [], dates: [], thumbnails: [] });
    setEditing("new");
  };

  const startEdit = (album) => {
    setForm({ title: album.title, description: album.description || "", is_public: album.is_public !== false, cover_url: album.cover_url || "" });
    setFormMedia({ urls: album.media_urls || [], types: album.media_types || [], captions: album.media_captions || [], titles: album.media_titles || [], dates: album.media_dates || [], thumbnails: album.media_thumbnails || [] });
    setEditing(album.id);
  };

  const handleCoverUpload = async () => {
    setUploadingCover(true);
    openGallery(async (file) => {
      try {
        const folder = artist?.id ? `artists/${artist.id}/media` : "artists/general/media";
        const { file_url, file_size_bytes } = await uploadToSpaces(file, folder);
        setForm(f => ({ ...f, cover_url: file_url }));
        recordStorageUsage({ file_url, file_size_bytes, mime_type: file.type, file_category: "media_library" }).catch(() => {});
      } catch {
        toast.error("Cover upload failed");
      } finally {
        setUploadingCover(false);
      }
    }, { accept: 'image/*' });
  };

  const handleMediaUpload = async () => {
    setUploadingMedia(true);
    openGallery(async (file) => {
      try {
        const isVideo = file.type.startsWith("video");
        const folder = artist?.id
          ? (isVideo ? `artists/${artist.id}/videos` : `artists/${artist.id}/media`)
          : "artists/general/media";
        const { file_url, file_size_bytes } = await uploadToSpaces(file, folder);
        recordStorageUsage({ file_url, file_size_bytes, mime_type: file.type, file_category: isVideo ? "media_library" : "media_library" }).catch(() => {});
        const type = isVideo ? "video" : "image";
        const today = new Date().toISOString().slice(0, 10);
        setFormMedia(prev => ({
          urls: [...prev.urls, file_url],
          types: [...prev.types, type],
          captions: [...prev.captions, ""],
          titles: [...prev.titles, ""],
          dates: [...prev.dates, today],
          thumbnails: [...prev.thumbnails, ""],
        }));
        toast.success("File uploaded");
      } catch {
        toast.error("Media upload failed");
      } finally {
        setUploadingMedia(false);
      }
    }, { accept: 'image/*,video/*' });
  };

  const removeMedia = (i) => {
    setFormMedia(prev => ({
      urls: prev.urls.filter((_, idx) => idx !== i),
      types: prev.types.filter((_, idx) => idx !== i),
      captions: prev.captions.filter((_, idx) => idx !== i),
      titles: prev.titles.filter((_, idx) => idx !== i),
      dates: prev.dates.filter((_, idx) => idx !== i),
      thumbnails: prev.thumbnails.filter((_, idx) => idx !== i),
    }));
  };

  const handleVideoThumbnail = async (i, file) => {
    if (!file || !file.type.startsWith("image")) { toast.error("Thumbnail must be an image"); return; }
    setUploadingThumbIdx(i);
    try {
      const folder = artist?.id ? `artists/${artist.id}/thumbnails` : "artists/general/thumbnails";
      const { file_url } = await uploadToSpaces(file, folder);
      setFormMedia(prev => {
        const thumbnails = [...(prev.thumbnails || [])];
        thumbnails[i] = file_url;
        return { ...prev, thumbnails };
      });
      toast.success("Thumbnail uploaded");
    } catch {
      toast.error("Thumbnail upload failed");
    } finally {
      setUploadingThumbIdx(null);
    }
  };

  const clearVideoThumbnail = (i) => {
    setFormMedia(prev => {
      const thumbnails = [...(prev.thumbnails || [])];
      thumbnails[i] = "";
      return { ...prev, thumbnails };
    });
  };

  const updateTitle = (i, val) => {
    setFormMedia(prev => ({ ...prev, titles: prev.titles.map((t, idx) => idx === i ? val : t) }));
  };

  const updateDate = (i, val) => {
    setFormMedia(prev => ({ ...prev, dates: prev.dates.map((d, idx) => idx === i ? val : d) }));
  };

  const updateCaption = (i, val) => {
    setFormMedia(prev => ({ ...prev, captions: prev.captions.map((c, idx) => idx === i ? val : c) }));
  };

  const handleSave = async () => {
    if (!form.title) { toast.error("Title is required"); return; }
    setSaving(true);
    const user = await base44.auth.me().catch(() => null);
    const isAdmin = user?.role === 'admin';
    const data = {
      artist_id: artist.id,
      artist_name: artist.display_name,
      artist_email: artist.user_email,
      title: form.title,
      description: form.description,
      cover_url: form.cover_url || formMedia.urls[0] || "",
      media_urls: formMedia.urls,
      media_types: formMedia.types,
      media_captions: formMedia.captions,
      media_titles: formMedia.titles,
      media_dates: formMedia.dates,
      media_thumbnails: formMedia.thumbnails || [],
      is_public: form.is_public !== false,
      sort_order: albums.length,
    };
    if (editing === "new") {
      // New albums with media need approval; admin = auto-approved
      if (formMedia.urls.length > 0) {
        data.approval_status = isAdmin ? 'approved' : 'pending_review';
      } else {
        data.approval_status = 'approved'; // text-only album, no media to moderate
      }
      const alb = await base44.entities.ArtistAlbum.create(data);
      setAlbums(prev => [...prev, alb]);
      if (!isAdmin && formMedia.urls.length > 0) {
        toast.success("Album created! Your media has been submitted for admin approval.");
      } else {
        toast.success("Album created!");
      }
    } else {
      // On edit, if new media was added, re-queue for review (unless admin)
      if (formMedia.urls.length > 0 && !isAdmin) {
        data.approval_status = 'pending_review';
      } else if (isAdmin) {
        data.approval_status = 'approved';
      }
      await base44.entities.ArtistAlbum.update(editing, data);
      setAlbums(prev => prev.map(a => a.id === editing ? { ...a, ...data } : a));
      toast.success("Album updated!");
    }
    setEditing(null);
    setSaving(false);
  };

  const handleDelete = async (id) => {
    const album = albums.find(a => a.id === id);
    await base44.entities.ArtistAlbum.delete(id);
    setAlbums(prev => prev.filter(a => a.id !== id));
    // Soft-delete storage records for all media in this album
    if (album?.media_urls?.length) {
      album.media_urls.forEach(url => deleteStorageRecord(url).catch(() => {}));
    }
    toast.success("Album deleted");
  };

  const toggleVisibility = async (album) => {
    const updated = { ...album, is_public: !album.is_public };
    await base44.entities.ArtistAlbum.update(album.id, { is_public: updated.is_public });
    setAlbums(prev => prev.map(a => a.id === album.id ? updated : a));
  };

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;
  if (!artist) return <div className="text-center py-20 text-muted-foreground">No artist profile found.</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display font-black text-2xl sm:text-3xl tracking-tight">MEDIA GALLERY</h1>
          <p className="text-sm text-muted-foreground font-mono mt-0.5">Organise your photos & videos into albums</p>
        </div>
        {!editing && (
          <Button onClick={startNew} className="glow-lime font-display font-bold gap-2 self-start sm:self-auto">
            <Plus className="w-4 h-4" /> New Album
          </Button>
        )}
      </div>

      {/* New/Edit form */}
      {editing && (
        <div className="p-4 sm:p-5 rounded-xl bg-card border border-border/50 space-y-4">
          <h3 className="font-display font-bold">{editing === "new" ? "New Album" : "Edit Album"}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label className="text-xs font-mono text-muted-foreground">Album Title *</Label>
              <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                placeholder="e.g. Tour 2025, Behind the Scenes" className="mt-1 bg-secondary border-border/50" />
            </div>
            <div className="col-span-2">
              <Label className="text-xs font-mono text-muted-foreground">Description</Label>
              <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="What's this album about?" className="mt-1 bg-secondary border-border/50" />
            </div>
            <div className="col-span-2">
              <Label className="text-xs font-mono text-muted-foreground">Album Cover (optional — uses first media if blank)</Label>
              {form.cover_url ? (
                <div className="relative mt-1 w-24 h-24">
                  <img src={form.cover_url} alt="" className="w-24 h-24 rounded-lg object-cover" />
                  <button onClick={() => setForm({ ...form, cover_url: "" })} className="absolute -top-1.5 -right-1.5 p-1 rounded-full bg-destructive text-white"><X className="w-3 h-3" /></button>
                </div>
              ) : (
               <button onClick={handleCoverUpload} disabled={uploadingCover} className="mt-1 flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary border border-dashed border-border/50 text-muted-foreground text-sm cursor-pointer hover:border-primary/40 transition-colors w-fit disabled:opacity-50">
                  <Upload className="w-4 h-4" />
                  {uploadingCover ? "Uploading..." : "Upload Cover"}
               </button>
              )}
            </div>
            <div className="col-span-2">
              <Label className="text-xs font-mono text-muted-foreground">Media Files</Label>
              <button onClick={handleMediaUpload} disabled={uploadingMedia} className="mt-1 flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary border border-dashed border-border/50 text-muted-foreground text-sm cursor-pointer hover:border-primary/40 transition-colors w-fit disabled:opacity-50">
                <Upload className="w-4 h-4" />
                {uploadingMedia ? "Uploading..." : "Upload Photos / Videos"}
              </button>
              {formMedia.urls.length > 0 && (
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {formMedia.urls.map((url, i) => (
                    <div key={i} className="relative group rounded-lg overflow-hidden border border-border/40 bg-card p-1.5 space-y-1">
                      <div className="relative">
                        {formMedia.types[i] === "video" ? (
                          formMedia.thumbnails?.[i]
                            ? <img src={formMedia.thumbnails[i]} alt="" className="w-full h-20 object-cover rounded" />
                            : <video src={url} className="w-full h-20 object-cover rounded" />
                        ) : (
                          <img src={url} alt="" className="w-full h-20 object-cover rounded"
                            onError={e => { e.target.style.display="none"; e.target.nextSibling?.classList?.remove("hidden"); }}
                          />
                        )}
                        <div className="hidden w-full h-20 rounded bg-muted flex items-center justify-center">
                          <Grid className="w-5 h-5 text-muted-foreground/40" />
                        </div>
                        <button onClick={() => removeMedia(i)}
                          className="absolute top-1 right-1 p-1 rounded-full bg-destructive text-white opacity-0 group-hover:opacity-100 transition-opacity">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                      <input value={formMedia.titles[i] || ""} onChange={e => updateTitle(i, e.target.value)}
                        placeholder="Title..." className="w-full text-[10px] font-mono bg-secondary border border-border/40 px-1.5 py-1 rounded text-foreground" />
                      <input type="date" value={formMedia.dates[i] || ""} onChange={e => updateDate(i, e.target.value)}
                        className="w-full text-[10px] font-mono bg-secondary border border-border/40 px-1.5 py-1 rounded text-muted-foreground" />
                      <input value={formMedia.captions[i] || ""} onChange={e => updateCaption(i, e.target.value)}
                        placeholder="Caption..." className="w-full text-[10px] font-mono bg-secondary border-0 px-1 py-0.5 rounded text-muted-foreground" />
                      {/* Thumbnail upload for videos */}
                      {formMedia.types[i] === "video" && (
                        <div className="pt-0.5">
                          {formMedia.thumbnails?.[i] ? (
                            <div className="flex items-center gap-1">
                              <span className="text-[9px] font-mono text-green-400">✓ Thumbnail set</span>
                              <button onClick={() => clearVideoThumbnail(i)} className="text-[9px] font-mono text-destructive hover:underline">remove</button>
                            </div>
                          ) : (
                            <label className={`flex items-center gap-1 text-[9px] font-mono text-primary cursor-pointer hover:underline ${uploadingThumbIdx === i ? "opacity-50 pointer-events-none" : ""}`}>
                              <Upload className="w-2.5 h-2.5" />
                              {uploadingThumbIdx === i ? "Uploading..." : "Add thumbnail"}
                              <input type="file" accept="image/*" className="hidden"
                                onChange={e => { if (e.target.files[0]) handleVideoThumbnail(i, e.target.files[0]); e.target.value = ""; }} />
                            </label>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="col-span-2 flex items-center gap-2">
              <input type="checkbox" id="is_public" checked={form.is_public !== false} onChange={e => setForm({ ...form, is_public: e.target.checked })} className="rounded" />
              <label htmlFor="is_public" className="text-sm text-muted-foreground font-mono">Visible on public profile</label>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={saving} className="glow-lime font-display font-bold">{saving ? "Saving..." : "Save Album"}</Button>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Albums list */}
      {albums.length === 0 && !editing ? (
        <div className="text-center py-16 bg-card rounded-xl border border-border/50">
          <Images className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">No albums yet. Create your first one!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {albums.map(album => (
            <div key={album.id} className="rounded-xl bg-card border border-border/50 overflow-hidden">
              <div className="flex items-center gap-3 p-4">
                {album.cover_url || album.media_urls?.[0] ? (
                  <img src={album.cover_url || album.media_urls[0]} alt="" className="w-14 h-14 rounded-lg object-cover shrink-0" />
                ) : (
                  <div className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center shrink-0"><Images className="w-5 h-5 text-muted-foreground/40" /></div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-display font-bold truncate">{album.title}</p>
                    <MediaApprovalBadge status={album.approval_status} />
                  </div>
                  {album.description && <p className="text-xs text-muted-foreground truncate">{album.description}</p>}
                  <p className="text-xs font-mono text-muted-foreground mt-0.5">{album.media_urls?.length || 0} items</p>
                  {album.approval_status === "pending_review" && (
                    <p className="text-[10px] text-yellow-400 font-mono mt-0.5">Pending admin review — not visible publicly yet</p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => toggleVisibility(album)} title={album.is_public ? "Hide" : "Show"}
                    className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground">
                    {album.is_public ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4 text-destructive" />}
                  </button>
                  <button onClick={() => setExpandedAlbum(expandedAlbum === album.id ? null : album.id)}
                    className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground">
                    {expandedAlbum === album.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  <button onClick={() => startEdit(album)} className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground"><Edit2 className="w-4 h-4" /></button>
                  <button onClick={() => handleDelete(album.id)} className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-destructive"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
              {expandedAlbum === album.id && album.media_urls?.length > 0 && (
                <div className="border-t border-border/30 p-3 space-y-2">
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                    {album.media_urls.map((url, i) => {
                      const key = `${album.id}-${i}`;
                      return (
                        <div key={i} className="space-y-1">
                          <div className="relative rounded overflow-hidden aspect-square bg-muted">
                            {album.media_types?.[i] === "video" ? (
                              album.media_thumbnails?.[i]
                                ? <img src={album.media_thumbnails[i]} alt="" className="w-full h-full object-cover" />
                                : <video src={url} className="w-full h-full object-cover" />
                            ) : (
                              <img src={url} alt={album.media_captions?.[i] || ""} className="w-full h-full object-cover"
                                onError={e => { e.target.style.display="none"; }}
                              />
                            )}
                          </div>
                          {album.media_types?.[i] === "video" && (
                            <button
                              onClick={() => setExpandedVideoBudget(expandedVideoBudget === key ? null : key)}
                              className="w-full flex items-center justify-center gap-1 px-2 py-1 rounded text-[10px] font-mono border border-primary/30 text-primary hover:bg-primary/10 transition-colors"
                            >
                              <DollarSign className="w-3 h-3" /> Budget
                              {expandedVideoBudget === key ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}
                            </button>
                          )}
                          {expandedVideoBudget === key && (
                            <VideoBudgetManager
                              videoUrl={url}
                              videoTitle={album.media_titles?.[i] || album.title}
                              contextType="artist_gallery"
                              contextId={album.id}
                              ownerType="artist"
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}