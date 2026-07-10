import { useState, useEffect, useRef } from "react";
import { Download, Music, FileText, Package, Play, Pause } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { detectIsIOS } from "@/hooks/useIsIOS";

const CAT_LABELS = { beat: "Beat", stem: "Stem", sample_pack: "Sample Pack", preset: "Preset", sheet_music: "Sheet Music", ebook: "eBook", other: "Other" };

export default function DigitalDownloadsShop({ artist, user }) {
  const [products, setProducts] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState(null);
  const [playingPreview, setPlayingPreview] = useState(null);
  const [audio] = useState(() => new Audio());

  // Products are fetched once per artist (guarded against auth-state re-fires)
  const loadedArtistRef = useRef(null);
  useEffect(() => {
    if (!artist?.id) return;
    if (loadedArtistRef.current === artist.id) return;
    loadedArtistRef.current = artist.id;
    let cancelled = false;
    (async () => {
      try {
        const prods = await base44.entities.DigitalProduct.filter({ artist_id: artist.id, is_active: true }, "-created_date", 20);
        if (!cancelled) setProducts(prods);
      } catch {
        // Transient rate-limit / network error — hide section gracefully
        if (!cancelled) setProducts([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [artist?.id]);

  // Purchases are only fetched when there are products to buy and a known user
  useEffect(() => {
    if (!user?.email || !artist?.id || products.length === 0) return;
    let cancelled = false;
    base44.entities.DigitalPurchase.filter({ artist_id: artist.id, buyer_email: user.email }, null, 100)
      .then(purs => { if (!cancelled) setPurchases(purs); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [user?.email, artist?.id, products.length]);

  useEffect(() => () => { audio.pause(); }, []);

  const togglePreview = (url) => {
    if (playingPreview === url) {
      audio.pause();
      setPlayingPreview(null);
    } else {
      audio.src = url;
      audio.play();
      setPlayingPreview(url);
      audio.onended = () => setPlayingPreview(null);
    }
  };

  const hasPurchased = (productId) => purchases.some(p => p.product_id === productId && p.status === "completed");

  const handleBuy = async (product) => {
    if (!user) { base44.auth.redirectToLogin(); return; }
    if (hasPurchased(product.id)) {
      window.open(product.file_url, "_blank");
      return;
    }
    setBuying(product.id);
    const fee = parseFloat((product.price * 0.1).toFixed(2));
    const net = parseFloat((product.price - fee).toFixed(2));
    const purchase = await base44.entities.DigitalPurchase.create({
      product_id: product.id,
      product_title: product.title,
      artist_id: artist.id,
      artist_name: artist.display_name,
      artist_email: artist.user_email,
      buyer_email: user.email,
      buyer_name: user.full_name,
      amount: product.price,
      platform_fee: fee,
      net_amount: net,
      file_url: product.file_url,
      status: "completed",
    });
    await base44.entities.DigitalProduct.update(product.id, { sales_count: (product.sales_count || 0) + 1 });
    setPurchases(prev => [...prev, purchase]);
    setProducts(prev => prev.map(p => p.id === product.id ? { ...p, sales_count: (p.sales_count || 0) + 1 } : p));
    // Email buyer
    await base44.integrations.Core.SendEmail({
      to: user.email,
      subject: `🎵 Your download: ${product.title}`,
      body: `Hi ${user.full_name || "there"},\n\nThank you for purchasing "${product.title}" from ${artist.display_name}!\n\nDownload your file here:\n${product.file_url}\n\nThis link is for your personal use. Thank you for supporting the artist! 🎶`,
    }).catch(() => {});
    toast.success("Purchase complete! Download starts now.");
    window.open(product.file_url, "_blank");
    setBuying(null);
  };

  if (detectIsIOS()) return null;
  if (loading || products.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Download className="w-4 h-4 text-primary" />
        <h2 className="font-display font-bold text-lg">DIGITAL DOWNLOADS</h2>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        {products.map(product => {
          const purchased = hasPurchased(product.id);
          return (
            <div key={product.id} className="rounded-xl bg-card border border-border/50 overflow-hidden">
              {product.cover_url ? (
                <img src={product.cover_url} alt={product.title} className="w-full h-32 object-cover" />
              ) : (
                <div className="w-full h-32 bg-muted flex items-center justify-center">
                  <Music className="w-8 h-8 text-muted-foreground/30" />
                </div>
              )}
              <div className="p-3 space-y-2">
                <div>
                  <p className="font-display font-bold text-sm leading-tight">{product.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="font-mono text-[10px] uppercase text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{CAT_LABELS[product.category]}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">{product.sales_count || 0} sold</span>
                  </div>
                  {product.description && <p className="text-xs text-muted-foreground mt-1">{product.description}</p>}
                </div>

                {product.preview_url && (
                  <button onClick={() => togglePreview(product.preview_url)}
                    className="flex items-center gap-1.5 text-xs font-mono text-accent hover:text-accent/80 transition-colors">
                    {playingPreview === product.preview_url ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    {playingPreview === product.preview_url ? "Stop preview" : "Preview"}
                  </button>
                )}

                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono font-black text-primary">{product.price === 0 ? "FREE" : `$${product.price.toFixed(2)}`}</span>
                  <button
                    onClick={() => handleBuy(product)}
                    disabled={buying === product.id}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-display font-bold transition-colors ${
                      purchased
                        ? "bg-green-400/10 border border-green-400/30 text-green-400 hover:bg-green-400/20"
                        : "bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20"
                    }`}>
                    <Download className="w-3.5 h-3.5" />
                    {buying === product.id ? "Processing..." : purchased ? "Download Again" : product.price === 0 ? "Download Free" : "Buy & Download"}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}