import { useState, useEffect } from "react";
import { Plus, Trash2, Edit2, ShoppingBag, Package, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";
import { toast } from "sonner";

const CATEGORIES = ["clothing", "accessories", "music", "prints", "other"];
const BLANK = { name: "", description: "", price: "", category: "other", sizes: [], stock: "", image_url: "", is_active: true };
const SIZE_OPTIONS = ["XS", "S", "M", "L", "XL", "XXL", "One Size"];

const STATUS_COLOR = {
  pending:   "text-yellow-400 bg-yellow-400/10",
  confirmed: "text-accent bg-accent/10",
  shipped:   "text-primary bg-primary/10",
  delivered: "text-green-400 bg-green-400/10",
  cancelled: "text-destructive bg-destructive/10",
};

export default function ArtistMerch() {
  const [artist, setArtist] = useState(null);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("products");
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(BLANK);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    base44.auth.me().then(async (user) => {
      const artists = await base44.entities.Artist.filter({ user_email: user.email }, null, 1);
      if (!artists[0]) { setLoading(false); return; }
      const a = artists[0];
      setArtist(a);
      const [p, o] = await Promise.all([
        base44.entities.Product.filter({ artist_id: a.id }, "sort_order", 50),
        base44.entities.MerchOrder.filter({ artist_id: a.id }, "-created_date", 100),
      ]);
      setProducts(p);
      setOrders(o);
      setLoading(false);
    });
  }, []);

  const startEdit = (product) => {
    setForm({ ...product, price: String(product.price), stock: String(product.stock ?? ""), sizes: product.sizes || [] });
    setEditing(product.id);
  };

  const startNew = () => { setForm(BLANK); setEditing("new"); };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setForm(f => ({ ...f, image_url: file_url }));
    setUploading(false);
  };

  const toggleSize = (size) => {
    setForm(f => ({
      ...f,
      sizes: f.sizes.includes(size) ? f.sizes.filter(s => s !== size) : [...f.sizes, size],
    }));
  };

  const handleSave = async () => {
    if (!form.name || !form.price) { toast.error("Name and price are required"); return; }
    setSaving(true);
    const data = {
      artist_id: artist.id,
      artist_name: artist.display_name,
      artist_email: artist.user_email,
      name: form.name,
      description: form.description,
      price: parseFloat(form.price),
      category: form.category,
      sizes: form.sizes,
      stock: form.stock !== "" ? parseInt(form.stock) : null,
      image_url: form.image_url,
      is_active: form.is_active !== false,
      sort_order: products.length,
    };
    if (editing === "new") {
      const p = await base44.entities.Product.create(data);
      setProducts(prev => [...prev, p]);
      toast.success("Product added!");
    } else {
      await base44.entities.Product.update(editing, data);
      setProducts(prev => prev.map(p => p.id === editing ? { ...p, ...data } : p));
      toast.success("Product updated!");
    }
    setEditing(null);
    setSaving(false);
  };

  const handleDelete = async (id) => {
    await base44.entities.Product.delete(id);
    setProducts(prev => prev.filter(p => p.id !== id));
    toast.success("Product removed");
  };

  const updateOrderStatus = async (orderId, status) => {
    await base44.entities.MerchOrder.update(orderId, { status });
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o));
    toast.success("Order updated");
  };

  const totalRevenue = orders.filter(o => o.status !== "cancelled").reduce((s, o) => s + (o.total || 0), 0);

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;
  if (!artist) return <div className="text-center py-20 text-muted-foreground">No artist profile found.</div>;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display font-black text-3xl tracking-tight">MERCH SHOP</h1>
          <p className="text-sm text-muted-foreground font-mono mt-0.5">Sell merchandise directly to your fans</p>
        </div>
        <div className="flex items-center gap-3 text-sm font-mono">
          <span className="text-green-400 font-bold">${totalRevenue.toFixed(2)}</span>
          <span className="text-muted-foreground">· {orders.length} orders</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex rounded-lg border border-border/50 overflow-hidden w-fit">
        {["products", "orders"].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-mono font-bold capitalize transition-all ${activeTab === tab ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted"}`}>
            {tab}
          </button>
        ))}
      </div>

      {activeTab === "products" && (
        <div className="space-y-4">
          {/* Product grid */}
          <div className="grid sm:grid-cols-2 gap-3">
            {products.map(product => (
              <div key={product.id} className="rounded-xl bg-card border border-border/50 overflow-hidden">
                {product.image_url ? (
                  <img src={product.image_url} alt={product.name} className="w-full h-36 object-cover" />
                ) : (
                  <div className="w-full h-36 bg-muted flex items-center justify-center">
                    <Package className="w-8 h-8 text-muted-foreground/30" />
                  </div>
                )}
                <div className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-display font-bold">{product.name}</p>
                      <p className="font-mono font-black text-primary">${product.price.toFixed(2)}</p>
                      {product.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{product.description}</p>}
                      <div className="flex flex-wrap gap-1 mt-1">
                        <span className="font-mono text-[10px] uppercase text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{product.category}</span>
                        {product.stock != null && <span className="font-mono text-[10px] text-muted-foreground">Stock: {product.stock}</span>}
                        {!product.is_active && <span className="font-mono text-[10px] text-destructive bg-destructive/10 px-1.5 py-0.5 rounded">Hidden</span>}
                      </div>
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

          {/* Edit / New form */}
          {editing && (
            <div className="p-5 rounded-xl bg-card border border-border/50 space-y-4">
              <h3 className="font-display font-bold">{editing === "new" ? "Add Product" : "Edit Product"}</h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <Label className="text-xs font-mono text-muted-foreground">Product Name *</Label>
                  <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Logo Tee, Vinyl Record" className="mt-1 bg-secondary border-border/50" />
                </div>
                <div>
                  <Label className="text-xs font-mono text-muted-foreground">Price ($) *</Label>
                  <Input type="number" min="0" step="0.01" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })}
                    placeholder="0.00" className="mt-1 bg-secondary border-border/50" />
                </div>
                <div>
                  <Label className="text-xs font-mono text-muted-foreground">Stock (optional)</Label>
                  <Input type="number" min="0" value={form.stock} onChange={e => setForm({ ...form, stock: e.target.value })}
                    placeholder="Unlimited" className="mt-1 bg-secondary border-border/50" />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs font-mono text-muted-foreground">Category</Label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {CATEGORIES.map(c => (
                      <button key={c} onClick={() => setForm({ ...form, category: c })}
                        className={`px-3 py-1 rounded-lg border text-xs font-mono font-bold capitalize transition-all ${form.category === c ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border/50 text-muted-foreground hover:border-primary/40"}`}>
                        {c}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="col-span-2">
                  <Label className="text-xs font-mono text-muted-foreground">Description</Label>
                  <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                    placeholder="Product description..." className="mt-1 bg-secondary border-border/50" />
                </div>
                <div className="col-span-2">
                  <Label className="text-xs font-mono text-muted-foreground">Sizes (optional)</Label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    {SIZE_OPTIONS.map(s => (
                      <button key={s} onClick={() => toggleSize(s)}
                        className={`px-2.5 py-1 rounded border text-xs font-mono font-bold transition-all ${form.sizes.includes(s) ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border/50 text-muted-foreground hover:border-primary/40"}`}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="col-span-2">
                  <Label className="text-xs font-mono text-muted-foreground">Product Image</Label>
                  {form.image_url ? (
                    <div className="relative mt-1 w-32 h-32">
                      <img src={form.image_url} alt="" className="w-32 h-32 rounded-lg object-cover" />
                      <button onClick={() => setForm({ ...form, image_url: "" })} className="absolute -top-1.5 -right-1.5 p-1 rounded-full bg-destructive text-white"><X className="w-3 h-3" /></button>
                    </div>
                  ) : (
                    <label className="mt-1 flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary border border-dashed border-border/50 text-muted-foreground text-sm cursor-pointer hover:border-primary/40 transition-colors w-fit">
                      <Upload className="w-4 h-4" />
                      {uploading ? "Uploading..." : "Upload Image"}
                      <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploading} />
                    </label>
                  )}
                </div>
                <div className="col-span-2 flex items-center gap-2">
                  <input type="checkbox" id="is_active" checked={form.is_active !== false} onChange={e => setForm({ ...form, is_active: e.target.checked })} className="rounded" />
                  <label htmlFor="is_active" className="text-sm text-muted-foreground font-mono">Visible in shop</label>
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
              <Plus className="w-4 h-4" /> Add Product
            </Button>
          )}
        </div>
      )}

      {activeTab === "orders" && (
        <div className="space-y-3">
          {orders.length === 0 ? (
            <div className="text-center py-16 bg-card rounded-xl border border-border/50">
              <ShoppingBag className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground text-sm">No orders yet</p>
            </div>
          ) : orders.map(order => (
            <div key={order.id} className="p-4 rounded-xl bg-card border border-border/50 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-display font-bold text-sm">{order.buyer_name || order.buyer_email}</p>
                  <p className="text-xs text-muted-foreground font-mono">{order.order_number} · {format(new Date(order.created_date), "MMM dd, yyyy")}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{order.shipping_address}</p>
                  <ul className="mt-1 space-y-0.5">
                    {order.items?.map((item, i) => (
                      <li key={i} className="text-xs font-mono">{item.quantity}x {item.product_name}{item.size ? ` (${item.size})` : ""} — ${(item.price * item.quantity).toFixed(2)}</li>
                    ))}
                  </ul>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-display font-black text-lg text-green-400">${order.total.toFixed(2)}</p>
                  <span className={`font-mono text-[10px] font-bold uppercase px-2 py-0.5 rounded ${STATUS_COLOR[order.status] || ""}`}>{order.status}</span>
                </div>
              </div>
              {order.status !== "delivered" && order.status !== "cancelled" && (
                <div className="flex gap-2 flex-wrap pt-1">
                  {order.status === "pending" && <button onClick={() => updateOrderStatus(order.id, "confirmed")} className="text-xs font-mono text-accent hover:underline">Confirm</button>}
                  {order.status === "confirmed" && <button onClick={() => updateOrderStatus(order.id, "shipped")} className="text-xs font-mono text-primary hover:underline">Mark Shipped</button>}
                  {order.status === "shipped" && <button onClick={() => updateOrderStatus(order.id, "delivered")} className="text-xs font-mono text-green-400 hover:underline">Mark Delivered</button>}
                  <button onClick={() => updateOrderStatus(order.id, "cancelled")} className="text-xs font-mono text-destructive hover:underline">Cancel</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}