import { useState, useEffect } from "react";
import { Plus, Trash2, Edit2, Download, Upload, X, Music, FileText, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";
import { toast } from "sonner";

const CATEGORIES = ["beat", "stem", "sample_pack", "preset", "sheet_music", "ebook", "other"];
const CAT_LABELS = { beat: "Beat", stem: "Stem", sample_pack: "Sample Pack", preset: "Preset", sheet_music: "Sheet Music", ebook: "eBook", other: "Other" };
const BLANK = { title: "", description: "", price: "", category: "beat", cover_url: "", file_url: "", file_name: "", preview_url: "", is_active: true };

export default function ArtistDownloads() {
  const [artist, setArtist] = useState(null);
  const [products, setProducts] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("products");
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(BLANK);
  const [saving, setSaving] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingPreview, setUploadingPreview] = useState(false);

  useEffect(() => {
    base44.auth.me().then(async (user) => {
      const artists = await base44.entities.Artist.filter({ user_email: user.email }, null, 1);
      if (!artists[0]) { setLoading(false); return; }
      const a = artists[0];
      setArtist(a);
      const [p, pur] = await Promise.all([
        base44.entities.DigitalProduct.filter({ artist_id: a.id }, "-created_date", 50),
        base44.entities.DigitalPurchase.filter({ artist_id: a.id }, "-created_date", 200),
      ]);
      setProducts(p);
      setPurchases(pur);
      setLoading(false);
    });
  }, []);

  const startNew = () => { setForm(BLANK); setEditing("new"); };
  const startEdit = (p) => { setForm({ ...p, price: String(p.price) }); setEditing(p.id); };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingFile(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setForm(f => ({ ...f, file_url, file_name: file.name }));
    setUploadingFile(false);
    toast.success("File uploaded");
  };

  const handleCoverUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingCover(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setForm(f => ({ ...f, cover_url: file_url }));
    setUploadingCover(false);
  };

  const handlePreviewUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingPreview(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setForm(f => ({ ...f, preview_url: file_url }));
    setUploadingPreview(false);
    toast.success("Preview uploaded");
  };

  const handleSave = async () => {
    if (!form.title || !form.price) { toast.error("Title and price are required"); return; }
    if (!form.file_url) { toast.error("Please upload a file"); return; }
    setSaving(true);
    const data = {
      artist_id: artist.id, artist_name: artist.display_name, artist_email: artist.user_email,
      title: form.title, description: form.description, price: parseFloat(form.price),
      category: form.category, cover_url: form.cover_url, file_url: form.file_url,
      file_name: form.file_name, preview_url: form.preview_url,
      is_active: form.is_active !== false,
      sales_count: editing === "new" ? 0 : (products.find(p => p.id === editing)?.sales_count || 0),
    };
    if (editing === "new") {
      const prod = await base44.entities.DigitalProduct.create(data);
      setProducts(prev => [prod, ...prev]);
      toast.success("Product listed!");
    } else {
      await base44.entities.DigitalProduct.update(editing, data);
      setProducts(prev => prev.map(p => p.id === editing ? { ...p, ...data } : p));
      toast.success("Product updated!");
    }
    setEditing(null);
    setSaving(false);
  };

  const handleDelete = async (id) => {
    await base44.entities.DigitalProduct.delete(id);
    setProducts(prev => prev.filter(p => p.id !== id));
    toast.success("Product removed");
  };

  const totalRevenue = purchases.filter(p => p.status === "completed").reduce((s, p) => s + (p.net_amount || 0), 0);

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;
  if (!artist) return <div className="text-center py-20 text-muted-foreground">No artist profile found.</div>;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display font-black text-3xl tracking-tight">DIGITAL DOWNLOADS</h1>
          <p className="text-sm text-muted-foreground font-mono mt-0.5">Sell beats, stems, presets & more</p>
        </div>
        <div className="flex items-center gap-3 text-sm font-mono">
          <span className="text-green-400 font-bold">${totalRevenue.toFixed(2)}</span>
          <span className="text-muted-foreground">· {purchases.length} sales</span>
        </div>
      </div>

      <div className="flex rounded-lg border border-border/50 overflow-hidden w-fit">
        {["products", "sales"].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-mono font-bold capitalize transition-all ${activeTab === tab ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted"}`}>
            {tab}
          </button>
        ))}
      </div>

      {activeTab === "products" && (
        <div className="space-y-4">
          {/* Product list */}
          <div className="space-y-3">
            {products.map(product => (
              <div key={product.id} className="flex gap-3 p-4 rounded-xl bg-card border border-border/50">
                {product.cover_url ? (
                  <img src={product.cover_url} alt="" className="w-16 h-16 rounded-lg object-cover shrink-0" />
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center shrink-0">
                    <Music className="w-6 h-6 text-muted-foreground/40" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-display font-bold">{product.title}</p>
                      <p className="font-mono font-black text-primary">${product.price.toFixed(2)}</p>
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        <span className="font-mono text-[10px] uppercase text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{CAT_LABELS[product.category]}</span>
                        <span className="font-mono text-[10px] text-muted-foreground">{product.sales_count || 0} sales</span>
                        {!product.is_active && <span className="font-mono text-[10px] text-destructive bg-destructive/10 px-1.5 py-0.5 rounded">Hidden</span>}
                      </div>
                      {product.file_name && <p className="text-xs text-muted-foreground font-mono truncate max-w-xs mt-0.5">📎 {product.file_name}</p>}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => startEdit(product)} className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground"><Edit2 className="w-3.5 h-3.5" /></button>
                      <button onClick={() => handleDelete(product.id)} className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Form */}
          {editing && (
            <div className="p-5 rounded-xl bg-card border border-border/50 space-y-4">
              <h3 className="font-display font-bold">{editing === "new" ? "New Digital Product" : "Edit Product"}</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label className="text-xs font-mono text-muted-foreground">Title *</Label>
                  <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                    placeholder="e.g. Trap Beat Vol.1, Vocal Preset Pack" className="mt-1 bg-secondary border-border/50" />
                </div>
                <div>
                  <Label className="text-xs font-mono text-muted-foreground">Price ($) *</Label>
                  <Input type="number" min="0" step="0.01" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })}
                    placeholder="0.00" className="mt-1 bg-secondary border-border/50" />
                </div>
                <div>
                  <Label className="text-xs font-mono text-muted-foreground">Category</Label>
                  <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                    className="mt-1 w-full rounded-md bg-secondary border border-border/50 px-3 py-2 text-sm text-foreground">
                    {CATEGORIES.map(c => <option key={c} value={c}>{CAT_LABELS[c]}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <Label className="text-xs font-mono text-muted-foreground">Description</Label>
                  <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                    placeholder="What's included?" className="mt-1 bg-secondary border-border/50" />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs font-mono text-muted-foreground">Digital File * (ZIP, MP3, WAV, PDF...)</Label>
                  {form.file_url ? (
                    <div className="mt-1 flex items-center gap-2 p-2 rounded-lg bg-green-400/10 border border-green-400/20">
                      <FileText className="w-4 h-4 text-green-400 shrink-0" />
                      <p className="text-xs font-mono text-green-400 flex-1 truncate">{form.file_name || "File uploaded"}</p>
                      <button onClick={() => setForm({ ...form, file_url: "", file_name: "" })}><X className="w-3.5 h-3.5 text-muted-foreground" /></button>
                    </div>
                  ) : (
                    <label className="mt-1 flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary border border-dashed border-border/50 text-muted-foreground text-sm cursor-pointer hover:border-primary/40 transition-colors w-fit">
                      <Upload className="w-4 h-4" />
                      {uploadingFile ? "Uploading..." : "Upload File"}
                      <input type="file" className="hidden" onChange={handleFileUpload} disabled={uploadingFile} />
                    </label>
                  )}
                </div>
                <div>
                  <Label className="text-xs font-mono text-muted-foreground">Cover Image</Label>
                  {form.cover_url ? (
                    <div className="relative mt-1 w-20 h-20">
                      <img src={form.cover_url} alt="" className="w-20 h-20 rounded-lg object-cover" />
                      <button onClick={() => setForm({ ...form, cover_url: "" })} className="absolute -top-1.5 -right-1.5 p-1 rounded-full bg-destructive text-white"><X className="w-3 h-3" /></button>
                    </div>
                  ) : (
                    <label className="mt-1 flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary border border-dashed border-border/50 text-muted-foreground text-sm cursor-pointer hover:border-primary/40 transition-colors w-fit">
                      <Upload className="w-4 h-4" />
                      {uploadingCover ? "Uploading..." : "Cover"}
                      <input type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} disabled={uploadingCover} />
                    </label>
                  )}
                </div>
                <div>
                  <Label className="text-xs font-mono text-muted-foreground">Preview Audio (optional)</Label>
                  {form.preview_url ? (
                    <div className="mt-1 flex items-center gap-2">
                      <audio src={form.preview_url} controls className="h-8 flex-1" />
                      <button onClick={() => setForm({ ...form, preview_url: "" })}><X className="w-3.5 h-3.5 text-muted-foreground" /></button>
                    </div>
                  ) : (
                    <label className="mt-1 flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary border border-dashed border-border/50 text-muted-foreground text-sm cursor-pointer hover:border-primary/40 transition-colors w-fit">
                      <Upload className="w-4 h-4" />
                      {uploadingPreview ? "Uploading..." : "Preview"}
                      <input type="file" accept="audio/*" className="hidden" onChange={handlePreviewUpload} disabled={uploadingPreview} />
                    </label>
                  )}
                </div>
                <div className="col-span-2 flex items-center gap-2">
                  <input type="checkbox" id="dp_active" checked={form.is_active !== false} onChange={e => setForm({ ...form, is_active: e.target.checked })} className="rounded" />
                  <label htmlFor="dp_active" className="text-sm text-muted-foreground font-mono">Visible in store</label>
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSave} disabled={saving} className="glow-lime font-display font-bold">{saving ? "Saving..." : "Save Product"}</Button>
                <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              </div>
            </div>
          )}

          {!editing && (
            <Button onClick={startNew} variant="outline" className="gap-2 border-dashed w-full font-display font-bold">
              <Plus className="w-4 h-4" /> Add Digital Product
            </Button>
          )}
        </div>
      )}

      {activeTab === "sales" && (
        <div className="space-y-3">
          {purchases.length === 0 ? (
            <div className="text-center py-16 bg-card rounded-xl border border-border/50">
              <Download className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">No sales yet</p>
            </div>
          ) : purchases.map(p => (
            <div key={p.id} className="flex items-center justify-between p-4 rounded-xl bg-card border border-border/50 gap-3">
              <div>
                <p className="font-display font-bold text-sm">{p.product_title}</p>
                <p className="text-xs text-muted-foreground font-mono">{p.buyer_name || p.buyer_email} · {format(new Date(p.created_date), "MMM dd, yyyy")}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-mono font-black text-green-400">${p.net_amount?.toFixed(2)}</p>
                <p className="text-[10px] text-muted-foreground font-mono">net</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}