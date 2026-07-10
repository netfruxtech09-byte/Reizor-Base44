import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Upload, Trash2, Eye, EyeOff, ImageIcon, Video, Star, Loader2, Edit2, ChevronUp, ChevronDown, Search, RefreshCw, CheckCircle2, XCircle, Ban } from "lucide-react";
import { toast } from "sonner";

const BLANK_FORM = { title: "", description: "", show_on_homepage: true, type: "image", media_date: new Date().toISOString().slice(0, 10), homepage_priority: 0 };

const APPROVAL_CONFIG = {
  approved:       { label: "Approved",  color: "text-green-400 bg-green-400/10 border-green-400/20" },
  pending_review: { label: "Pending",   color: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20" },
  rejected:       { label: "Rejected",  color: "text-red-400 bg-red-400/10 border-red-400/20" },
  blocked:        { label: "Blocked",   color: "text-red-600 bg-red-600/10 border-red-600/20" },
};

const FILTER_TABS = [
  { key: "all",           label: "All" },
  { key: "pending_review",label: "Pending" },
  { key: "approved",      label: "Approved" },
  { key: "rejected",      label: "Rejected" },
  { key: "homepage",      label: "Homepage" },
];

export default function AdminMedia() {
  const [media, setMedia] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState(BLANK_FORM);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const fileRef = useRef();

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const data = await base44.entities.MediaItem.list("-created_date", 500);
    setMedia(data);
    setLoading(false);
  }

  function openUpload() {
    setEditItem(null);
    setForm(BLANK_FORM);
    setFile(null);
    setPreview(null);
    setOpen(true);
  }

  function openEdit(item) {
    setEditItem(item);
    setForm({
      title: item.title || "",
      description: item.description || "",
      show_on_homepage: item.show_on_homepage ?? true,
      type: item.type || "image",
      media_date: item.media_date || new Date().toISOString().slice(0, 10),
      homepage_priority: item.homepage_priority ?? 0,
    });
    setFile(null);
    setPreview(null);
    setOpen(true);
  }

  function pickFile(e) {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    setForm(prev => ({ ...prev, type: f.type.startsWith("video") ? "video" : "image", title: prev.title || f.name.replace(/\.[^.]+$/, "") }));
    const url = URL.createObjectURL(f);
    setPreview({ url, type: f.type.startsWith("video") ? "video" : "image" });
  }

  async function handleSave() {
    if (!form.title) return toast.error("Please add a title");
    if (!editItem && !file) return toast.error("Please select a file");
    setSaving(true);
    try {
      const user = await base44.auth.me();
      if (editItem) {
        let updateData = { ...form };
        if (file) {
          const { file_url } = await base44.integrations.Core.UploadFile({ file });
          updateData.url = file_url;
        }
        await base44.entities.MediaItem.update(editItem.id, updateData);
        toast.success("Media updated");
      } else {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        await base44.entities.MediaItem.create({
          ...form, url: file_url,
          uploaded_by_name: user.full_name || user.email,
          uploaded_by_email: user.email,
          uploaded_by_role: user.role || "user",
          upload_section: "admin_library",
          approval_status: user.role === "admin" ? "approved" : "pending_review",
        });
        toast.success("Media uploaded");
      }
      setOpen(false);
      load();
    } catch (e) {
      toast.error("Failed: " + e.message);
    }
    setSaving(false);
  }

  async function toggleHomepage(item) {
    await base44.entities.MediaItem.update(item.id, { show_on_homepage: !item.show_on_homepage });
    setMedia(prev => prev.map(m => m.id === item.id ? { ...m, show_on_homepage: !m.show_on_homepage } : m));
    toast.success(item.show_on_homepage ? "Removed from homepage" : "Added to homepage");
  }

  async function toggleStatus(item) {
    const newStatus = item.status === "active" ? "hidden" : "active";
    await base44.entities.MediaItem.update(item.id, { status: newStatus });
    setMedia(prev => prev.map(m => m.id === item.id ? { ...m, status: newStatus } : m));
  }

  async function adjustPriority(item, delta) {
    const newPriority = Math.max(0, Math.min(10, (item.homepage_priority ?? 0) + delta));
    await base44.entities.MediaItem.update(item.id, { homepage_priority: newPriority });
    setMedia(prev => prev.map(m => m.id === item.id ? { ...m, homepage_priority: newPriority } : m));
  }

  async function moderateItem(item, action) {
    const note = (action === "reject" || action === "block")
      ? window.prompt(`Optional: reason for ${action}?`) ?? ""
      : "";
    await base44.functions.invoke("moderateMedia", { action, entity_type: "MediaItem", entity_id: item.id, note });
    const statusMap = { approve: "approved", reject: "rejected", block: "blocked" };
    setMedia(prev => prev.map(m => m.id === item.id ? { ...m, approval_status: statusMap[action] } : m));
    toast.success(`Media ${action}d`);
  }

  async function remove(item) {
    if (!confirm("Delete this media item?")) return;
    await base44.entities.MediaItem.delete(item.id);
    setMedia(prev => prev.filter(m => m.id !== item.id));
    toast.success("Deleted");
  }

  const filtered = media.filter(m => {
    const matchSearch = !search || m.title?.toLowerCase().includes(search.toLowerCase()) || m.uploaded_by_name?.toLowerCase().includes(search.toLowerCase());
    const matchFilter =
      filter === "all" ? true :
      filter === "homepage" ? m.show_on_homepage :
      (m.approval_status || "pending_review") === filter;
    return matchSearch && matchFilter;
  });

  const counts = {
    all: media.length,
    pending_review: media.filter(m => (m.approval_status || "pending_review") === "pending_review").length,
    approved: media.filter(m => m.approval_status === "approved").length,
    rejected: media.filter(m => m.approval_status === "rejected").length,
    homepage: media.filter(m => m.show_on_homepage).length,
  };

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display font-black text-2xl tracking-tight flex items-center gap-2">
            <ImageIcon className="w-6 h-6 text-primary" /> Media Library
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage photos & videos. Control homepage visibility and priority.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} className="gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Button>
          <Button onClick={openUpload} className="gap-2 glow-lime font-display font-bold">
            <Upload className="w-4 h-4" /> Upload
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: "Total",    value: media.length,                                               color: "text-foreground" },
          { label: "Pending",  value: counts.pending_review,                                      color: "text-yellow-400" },
          { label: "Approved", value: counts.approved,                                            color: "text-green-400" },
          { label: "Rejected", value: media.filter(m => m.approval_status === "rejected" || m.approval_status === "blocked").length, color: "text-red-400" },
          { label: "Homepage", value: counts.homepage,                                            color: "text-primary" },
        ].map(s => (
          <div key={s.label} className="p-3 rounded-xl bg-card border border-border/50 text-center">
            <p className={`font-mono text-2xl font-black ${s.color}`}>{s.value}</p>
            <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filter + Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-2 flex-wrap">
          {FILTER_TABS.map(tab => (
            <button key={tab.key} onClick={() => setFilter(tab.key)}
              className={`flex items-center gap-1.5 text-xs font-mono font-bold px-3 py-1.5 rounded-lg border transition-all ${
                filter === tab.key
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card border-border/50 text-muted-foreground hover:text-foreground hover:border-primary/30"
              }`}>
              {tab.label}
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${filter === tab.key ? "bg-white/20" : "bg-muted"}`}>
                {counts[tab.key] ?? media.length}
              </span>
            </button>
          ))}
        </div>
        <div className="relative sm:ml-auto sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search title or uploader..."
            className="pl-9 bg-card border-border/50 text-sm h-9" />
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <ImageIcon className="w-12 h-12 text-muted-foreground/30" />
          <p className="text-muted-foreground">{search || filter !== "all" ? "No results match your filter" : "No media uploaded yet"}</p>
          {filter === "all" && !search && (
            <Button onClick={openUpload} variant="outline" className="gap-2 mt-1">
              <Upload className="w-4 h-4" /> Upload First File
            </Button>
          )}
        </div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground font-mono">{filtered.length} item{filtered.length !== 1 ? "s" : ""}</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filtered.map(item => {
              const approvalCfg = APPROVAL_CONFIG[item.approval_status || "pending_review"];
              return (
                <div key={item.id} className={`group rounded-xl overflow-hidden border transition-all flex flex-col ${item.status === "hidden" ? "opacity-40 border-border/20" : "border-border/50 hover:border-primary/40 hover:shadow-md hover:shadow-primary/5"}`}>
                  {/* Thumbnail */}
                  <div className="relative aspect-video bg-muted flex-shrink-0">
                    {item.type === "video" ? (
                      <div className="w-full h-full flex items-center justify-center bg-card/80">
                        <Video className="w-8 h-8 text-muted-foreground/60" />
                      </div>
                    ) : (
                      <img src={item.url} alt={item.title} className="w-full h-full object-cover" />
                    )}
                    {/* Overlays */}
                    <div className="absolute top-2 left-2 flex gap-1">
                      <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${item.type === "video" ? "bg-purple-500/90 text-white" : "bg-sky-500/90 text-white"}`}>
                        {item.type === "video" ? "VID" : "IMG"}
                      </span>
                    </div>
                    {item.show_on_homepage && (
                      <div className="absolute top-2 right-2 flex items-center gap-0.5 bg-background/80 rounded px-1 py-0.5">
                        <Star className="w-3 h-3 text-primary fill-primary" />
                        {(item.homepage_priority ?? 0) > 0 && (
                          <span className="text-[9px] font-mono font-bold text-primary">{item.homepage_priority}</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="p-3 space-y-2 flex-1 flex flex-col">
                    <p className="text-xs font-bold truncate leading-tight">{item.title}</p>
                    {item.uploaded_by_name && (
                      <p className="text-[10px] text-muted-foreground font-mono truncate">{item.uploaded_by_name}</p>
                    )}

                    {/* Approval badge */}
                    <span className={`self-start text-[9px] font-mono font-bold px-2 py-0.5 rounded border ${approvalCfg.color}`}>
                      {approvalCfg.label}
                    </span>

                    {/* Moderation actions */}
                    <div className="flex gap-1 flex-wrap mt-auto">
                      {item.approval_status !== "approved" && (
                        <button onClick={() => moderateItem(item, "approve")}
                          className="flex items-center gap-0.5 px-1.5 py-1 rounded text-[9px] font-mono font-bold bg-green-400/10 text-green-400 border border-green-400/20 hover:bg-green-400/20 transition-colors">
                          <CheckCircle2 className="w-3 h-3" /> OK
                        </button>
                      )}
                      {item.approval_status !== "rejected" && item.approval_status !== "blocked" && (
                        <button onClick={() => moderateItem(item, "reject")}
                          className="flex items-center gap-0.5 px-1.5 py-1 rounded text-[9px] font-mono font-bold bg-red-400/10 text-red-400 border border-red-400/20 hover:bg-red-400/20 transition-colors">
                          <XCircle className="w-3 h-3" /> Rej
                        </button>
                      )}
                      {item.approval_status !== "blocked" && (
                        <button onClick={() => moderateItem(item, "block")}
                          className="flex items-center gap-0.5 px-1.5 py-1 rounded text-[9px] font-mono font-bold bg-red-800/10 text-red-500 border border-red-500/20 hover:bg-red-500/20 transition-colors">
                          <Ban className="w-3 h-3" /> Block
                        </button>
                      )}
                    </div>

                    {/* Utility actions */}
                    <div className="flex items-center gap-1 pt-1 border-t border-border/30">
                      <button onClick={() => openEdit(item)} title="Edit"
                        className="flex items-center gap-0.5 px-1.5 py-1 rounded text-[10px] font-mono bg-secondary border border-border/50 text-muted-foreground hover:text-foreground transition-colors">
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button onClick={() => toggleHomepage(item)} title="Toggle homepage"
                        className={`px-1.5 py-1 rounded text-[10px] font-mono border transition-all ${item.show_on_homepage ? "bg-primary/10 text-primary border-primary/30" : "bg-secondary border-border/50 text-muted-foreground hover:text-primary"}`}>
                        <Star className="w-3 h-3" />
                      </button>
                      {item.show_on_homepage && (
                        <div className="flex items-center border border-border/50 rounded overflow-hidden">
                          <button onClick={() => adjustPriority(item, -1)} className="px-1 py-1 bg-secondary text-muted-foreground hover:text-foreground transition-colors">
                            <ChevronDown className="w-3 h-3" />
                          </button>
                          <span className="px-1 text-[10px] font-mono font-bold bg-secondary">{item.homepage_priority ?? 0}</span>
                          <button onClick={() => adjustPriority(item, 1)} className="px-1 py-1 bg-secondary text-muted-foreground hover:text-primary transition-colors">
                            <ChevronUp className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                      <button onClick={() => toggleStatus(item)} title="Toggle visibility"
                        className="ml-auto p-1 rounded bg-secondary border border-border/50 text-muted-foreground hover:text-foreground transition-all">
                        {item.status === "active" ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                      </button>
                      <button onClick={() => remove(item)}
                        className="p-1 rounded bg-destructive/10 border border-destructive/30 text-destructive hover:bg-destructive hover:text-white transition-all">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Upload / Edit Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg bg-card border-border max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display font-black text-xl tracking-tight">
              {editItem ? "Edit Media" : "Upload Media"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div onClick={() => fileRef.current?.click()}
              className="border-2 border-dashed border-border/50 hover:border-primary/50 rounded-xl p-5 text-center cursor-pointer transition-all">
              <input ref={fileRef} type="file" className="hidden" accept="image/*,video/*" onChange={pickFile} />
              {preview ? (
                preview.type === "video"
                  ? <video src={preview.url} className="max-h-36 mx-auto rounded" controls />
                  : <img src={preview.url} className="max-h-36 mx-auto rounded object-contain" alt="preview" />
              ) : editItem ? (
                <div className="space-y-1">
                  {editItem.type === "image"
                    ? <img src={editItem.url} className="max-h-28 mx-auto rounded object-contain" alt="current" />
                    : <Video className="w-8 h-8 text-muted-foreground mx-auto" />}
                  <p className="text-xs text-muted-foreground">Click to replace file (optional)</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="w-8 h-8 text-muted-foreground mx-auto" />
                  <p className="text-sm text-muted-foreground">Click to select image or video</p>
                  <p className="text-xs text-muted-foreground/50 font-mono">JPG, PNG, GIF, MP4, MOV</p>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-mono text-muted-foreground uppercase">Title *</Label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Main Stage Night Shot" className="bg-secondary border-border/50" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-mono text-muted-foreground uppercase">Date</Label>
                <Input type="date" value={form.media_date} onChange={e => setForm(f => ({ ...f, media_date: e.target.value }))}
                  className="bg-secondary border-border/50" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-mono text-muted-foreground uppercase">Description</Label>
                <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Optional" className="bg-secondary border-border/50" />
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-secondary border border-border/50">
              <div>
                <p className="text-sm font-bold">Show on Homepage</p>
                <p className="text-xs text-muted-foreground">Feature in the public gallery</p>
              </div>
              <Switch checked={form.show_on_homepage} onCheckedChange={v => setForm(f => ({ ...f, show_on_homepage: v }))} />
            </div>

            {form.show_on_homepage && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-secondary border border-border/50">
                <div>
                  <p className="text-sm font-bold">Homepage Priority</p>
                  <p className="text-xs text-muted-foreground">0 = normal · 10 = max boost</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setForm(f => ({ ...f, homepage_priority: Math.max(0, (f.homepage_priority ?? 0) - 1) }))}
                    className="w-7 h-7 rounded border border-border/50 bg-card flex items-center justify-center text-muted-foreground hover:text-foreground">
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                  <span className="font-mono font-black text-primary w-6 text-center">{form.homepage_priority ?? 0}</span>
                  <button onClick={() => setForm(f => ({ ...f, homepage_priority: Math.min(10, (f.homepage_priority ?? 0) + 1) }))}
                    className="w-7 h-7 rounded border border-border/50 bg-card flex items-center justify-center text-muted-foreground hover:text-primary">
                    <ChevronUp className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <Button className="flex-1 glow-lime font-display font-bold" onClick={handleSave} disabled={saving}>
                {saving ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Saving...</> : editItem ? "Save Changes" : "Upload"}
              </Button>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}