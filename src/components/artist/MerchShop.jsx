import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { ShoppingBag, ShoppingCart, Plus, Minus, X, Package, CheckCircle, Clock, Truck, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

const STATUS_STYLES = {
  pending:    { label: "Pending",    icon: Clock,       color: "text-yellow-400" },
  processing: { label: "Processing", icon: Clock,       color: "text-blue-400"   },
  shipped:    { label: "Shipped",    icon: Truck,       color: "text-accent"     },
  delivered:  { label: "Delivered",  icon: CheckCircle, color: "text-green-400"  },
  cancelled:  { label: "Cancelled",  icon: X,           color: "text-destructive"},
};

export default function MerchShop({ artist, user }) {
  const [products, setProducts]         = useState([]);
  const [cart, setCart]                 = useState([]);
  const [cartOpen, setCartOpen]         = useState(false);
  const [view, setView]                 = useState("cart"); // "cart" | "checkout" | "orders"
  const [shippingAddress, setShipping]  = useState("");
  const [addressError, setAddressError] = useState("");
  const [placing, setPlacing]           = useState(false);
  const [myOrders, setMyOrders]         = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [loading, setLoading]           = useState(true);
  const cartPanelRef                    = useRef(null);
  const isMobile = typeof window !== "undefined" && window.innerWidth < 640;

  useEffect(() => {
    base44.entities.Product.filter({ artist_id: artist.id, is_active: true }, "sort_order", 30)
      .then(p => { setProducts(p); setLoading(false); })
      .catch(() => setLoading(false));
  }, [artist.id]);

  // When cart is opened, scroll panel to top
  useEffect(() => {
    if (cartOpen && cartPanelRef.current) {
      cartPanelRef.current.scrollTop = 0;
    }
  }, [cartOpen]);

  // Reset view to cart when cart is closed
  const closeCart = () => { setCartOpen(false); setView("cart"); setAddressError(""); };

  const addToCart = (product, size = null) => {
    if (!user) { base44.auth.redirectToLogin(); return; }
    setCart(prev => {
      const key = `${product.id}-${size}`;
      const existing = prev.find(i => `${i.product.id}-${i.size}` === key);
      if (existing) return prev.map(i => `${i.product.id}-${i.size}` === key ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { product, quantity: 1, size }];
    });
    toast.success(`${product.name} added to cart!`);
  };

  const removeFromCart = (key) => {
    setCart(prev => {
      const next = prev.filter(i => `${i.product.id}-${i.size}` !== key);
      if (next.length === 0) setView("cart"); // reset to cart view if emptied
      return next;
    });
  };

  const updateQty = (key, delta) => setCart(prev =>
    prev.map(i => `${i.product.id}-${i.size}` === key ? { ...i, quantity: Math.max(1, i.quantity + delta) } : i)
  );

  const cartTotal = cart.reduce((s, i) => s + i.product.price * i.quantity, 0);
  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);

  const validateAddress = (addr) => {
    if (!addr.trim()) return "Shipping address is required.";
    if (addr.trim().length < 10) return "Please enter a complete address (street, city, country).";
    return "";
  };

  const handlePlaceOrder = async () => {
    if (cart.length === 0) { toast.error("Your cart is empty."); return; }
    const err = validateAddress(shippingAddress);
    if (err) { setAddressError(err); return; }
    setAddressError("");
    setPlacing(true);
    try {
      const orderNumber = `MERCH-${Date.now().toString(36).toUpperCase()}`;
      await base44.entities.MerchOrder.create({
        artist_id: artist.id,
        artist_name: artist.display_name,
        artist_email: artist.user_email,
        buyer_email: user.email,
        buyer_name: user.full_name || user.email,
        items: cart.map(i => ({ product_id: i.product.id, product_name: i.product.name, price: i.product.price, quantity: i.quantity, size: i.size })),
        total: cartTotal,
        shipping_address: shippingAddress,
        status: "pending",
        order_number: orderNumber,
      });
      await base44.integrations.Core.SendEmail({
        to: artist.user_email,
        subject: `🛒 New Merch Order — ${orderNumber}`,
        body: `${user.full_name || user.email} placed a merch order!\n\nOrder: ${orderNumber}\nTotal: $${cartTotal.toFixed(2)}\n\nItems:\n${cart.map(i => `• ${i.quantity}x ${i.product.name}${i.size ? ` (${i.size})` : ""} — $${(i.product.price * i.quantity).toFixed(2)}`).join("\n")}\n\nShip to: ${shippingAddress}\n\nManage orders in your Merch Shop dashboard.`,
      }).catch(() => {});
      toast.success("Order placed! The artist will be in touch. 🎉");
      setCart([]);
      setShipping("");
      setView("orders");
      loadMyOrders();
    } catch (e) {
      toast.error("Failed to place order. Please try again.");
    } finally {
      setPlacing(false);
    }
  };

  const loadMyOrders = async () => {
    if (!user) return;
    setOrdersLoading(true);
    try {
      const orders = await base44.entities.MerchOrder.filter({ buyer_email: user.email, artist_id: artist.id }, "-created_date", 20);
      setMyOrders(orders);
    } catch {
      setMyOrders([]);
    } finally {
      setOrdersLoading(false);
    }
  };

  const openOrders = () => { setView("orders"); loadMyOrders(); };

  if (loading || products.length === 0) return null;

  const panelStyle = {
    position: "relative",
    background: "hsl(228, 45%, 10%)",
    display: "flex",
    flexDirection: "column",
    width: isMobile ? "100%" : "400px",
    maxHeight: isMobile ? "85vh" : "100vh",
    height: isMobile ? "auto" : "100vh",
    borderRadius: isMobile ? "20px 20px 0 0" : 0,
    borderTop: isMobile ? "1px solid hsl(228,30%,18%)" : "none",
    borderLeft: isMobile ? "none" : "1px solid hsl(228,30%,18%)",
    paddingBottom: isMobile ? "env(safe-area-inset-bottom, 0px)" : 0,
    animation: isMobile
      ? "slideUpCart 0.28s cubic-bezier(0.32,0.72,0,1)"
      : "slideInRight 0.28s cubic-bezier(0.32,0.72,0,1)",
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShoppingBag className="w-4 h-4 text-primary" />
          <h2 className="font-display font-bold text-lg">MERCH</h2>
        </div>
        <div className="flex items-center gap-2">
          {user && (
            <button onClick={() => { setCartOpen(true); openOrders(); }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary border border-border/50 text-muted-foreground text-sm font-display font-bold hover:border-primary/30 transition-colors">
              My Orders
            </button>
          )}
          {cartCount > 0 && (
            <button onClick={() => { setCartOpen(true); setView("cart"); }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/30 text-primary text-sm font-display font-bold hover:bg-primary/20 transition-colors">
              <ShoppingCart className="w-4 h-4" /> Cart ({cartCount})
            </button>
          )}
        </div>
      </div>

      {/* Products grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {products.map(product => (
          <ProductCard key={product.id} product={product} onAdd={addToCart} />
        ))}
      </div>

      {/* Cart panel — portal */}
      {cartOpen && createPortal(
        <div
          onClick={closeCart}
          style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", flexDirection: isMobile ? "column" : "row", justifyContent: "flex-end", alignItems: "stretch" }}
        >
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.7)" }} />
          <div ref={cartPanelRef} onClick={e => e.stopPropagation()} style={panelStyle}>
            <style>{`@keyframes slideUpCart{from{transform:translateY(100%)}to{transform:translateY(0)}}@keyframes slideInRight{from{transform:translateX(100%)}to{transform:translateX(0)}}`}</style>

            {/* Drag handle — mobile */}
            {isMobile && (
              <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 4px" }}>
                <div style={{ width: 40, height: 4, borderRadius: 9999, background: "hsl(228,30%,28%)" }} />
              </div>
            )}

            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 16px 12px", borderBottom: "1px solid hsl(228,30%,18%)", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {view !== "cart" && (
                  <button onClick={() => setView("cart")} style={{ background: "none", border: "none", cursor: "pointer", color: "hsl(220,20%,65%)", display: "flex", alignItems: "center", marginRight: 4 }}>
                    <ChevronLeft style={{ width: 18, height: 18 }} />
                  </button>
                )}
                <ShoppingCart style={{ width: 16, height: 16, color: "hsl(var(--primary))" }} />
                <span style={{ fontWeight: 700, fontSize: "1rem" }}>
                  {view === "orders" ? "My Orders" : view === "checkout" ? "Checkout" : "Your Cart"}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {view === "cart" && (
                  <button onClick={openOrders} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "0.75rem", color: "hsl(220,20%,60%)", fontFamily: "monospace" }}>
                    My Orders
                  </button>
                )}
                <button onClick={closeCart} style={{ color: "hsl(220,20%,55%)", background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                  <X style={{ width: 20, height: 20 }} />
                </button>
              </div>
            </div>

            {/* ── CART VIEW ── */}
            {view === "cart" && (
              <>
                <div style={{ overflowY: "auto", flex: "1 1 auto", minHeight: 0, padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
                  {cart.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "40px 0" }}>
                      <ShoppingCart style={{ width: 40, height: 40, opacity: 0.2, margin: "0 auto 12px" }} />
                      <p style={{ color: "hsl(220,20%,55%)", fontSize: "0.875rem" }}>Your cart is empty</p>
                      <p style={{ color: "hsl(220,20%,40%)", fontSize: "0.75rem", marginTop: 4 }}>Add items from the shop below</p>
                    </div>
                  ) : cart.map(item => {
                    const key = `${item.product.id}-${item.size}`;
                    return (
                      <div key={key} style={{ display: "flex", gap: 12, padding: 12, borderRadius: 12, background: "hsl(230,50%,6%)", border: "1px solid hsl(228,30%,18%)" }}>
                        {item.product.image_url ? (
                          <img src={item.product.image_url} alt="" style={{ width: 56, height: 56, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
                        ) : (
                          <div style={{ width: 56, height: 56, borderRadius: 8, background: "hsl(228,35%,16%)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <Package style={{ width: 20, height: 20, opacity: 0.3 }} />
                          </div>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontWeight: 700, fontSize: "0.875rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.product.name}</p>
                          {item.size && <p style={{ fontSize: "0.75rem", color: "hsl(220,20%,55%)", fontFamily: "monospace" }}>Size: {item.size}</p>}
                          <p style={{ fontWeight: 700, color: "hsl(var(--primary))", fontSize: "0.875rem", fontFamily: "monospace" }}>${(item.product.price * item.quantity).toFixed(2)}</p>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                            <button onClick={() => updateQty(key, -1)} style={{ width: 26, height: 26, borderRadius: 6, border: "1px solid hsl(228,30%,22%)", background: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "inherit" }}><Minus style={{ width: 12, height: 12 }} /></button>
                            <span style={{ fontSize: "0.875rem", fontFamily: "monospace", fontWeight: 700, minWidth: 20, textAlign: "center" }}>{item.quantity}</span>
                            <button onClick={() => updateQty(key, 1)} style={{ width: 26, height: 26, borderRadius: 6, border: "1px solid hsl(228,30%,22%)", background: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "inherit" }}><Plus style={{ width: 12, height: 12 }} /></button>
                            <button onClick={() => removeFromCart(key)} style={{ marginLeft: 4, background: "none", border: "none", cursor: "pointer", color: "hsl(220,20%,55%)" }}><X style={{ width: 14, height: 14 }} /></button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {/* Footer — only show total + checkout when cart has items */}
                <div style={{ flexShrink: 0, padding: "12px 16px 16px", borderTop: "1px solid hsl(228,30%,18%)", display: "flex", flexDirection: "column", gap: 12 }}>
                  {cart.length > 0 ? (
                    <>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontWeight: 700, fontSize: "1rem" }}>
                        <span>Total</span>
                        <span style={{ color: "hsl(var(--primary))" }}>${cartTotal.toFixed(2)}</span>
                      </div>
                      <Button onClick={() => setView("checkout")} className="w-full glow-lime font-display font-bold">
                        Checkout — ${cartTotal.toFixed(2)}
                      </Button>
                    </>
                  ) : (
                    <button onClick={closeCart} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "0.875rem", color: "hsl(220,20%,55%)", textAlign: "center", padding: "4px 0" }}>
                      Close
                    </button>
                  )}
                </div>
              </>
            )}

            {/* ── CHECKOUT VIEW ── */}
            {view === "checkout" && (
              <>
                <div style={{ overflowY: "auto", flex: "1 1 auto", minHeight: 0, padding: "16px" }}>
                  {/* Order summary */}
                  <p style={{ fontFamily: "monospace", fontSize: "0.7rem", color: "hsl(220,20%,50%)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Order Summary</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
                    {cart.map(item => (
                      <div key={`${item.product.id}-${item.size}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "0.875rem" }}>
                        <span style={{ color: "hsl(220,20%,75%)" }}>{item.quantity}× {item.product.name}{item.size ? ` (${item.size})` : ""}</span>
                        <span style={{ fontFamily: "monospace", fontWeight: 700 }}>${(item.product.price * item.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                    <div style={{ borderTop: "1px solid hsl(228,30%,18%)", paddingTop: 8, display: "flex", justifyContent: "space-between", fontWeight: 700 }}>
                      <span>Total</span>
                      <span style={{ color: "hsl(var(--primary))" }}>${cartTotal.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Shipping */}
                  <p style={{ fontFamily: "monospace", fontSize: "0.7rem", color: "hsl(220,20%,50%)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>Shipping Address *</p>
                  <textarea
                    value={shippingAddress}
                    onChange={e => { setShipping(e.target.value); if (addressError) setAddressError(validateAddress(e.target.value)); }}
                    placeholder="Street, City, State/Province, ZIP, Country"
                    rows={3}
                    style={{
                      width: "100%", borderRadius: 8, padding: "10px 12px", fontSize: "0.875rem",
                      background: "hsl(230,50%,6%)", border: addressError ? "1px solid hsl(var(--destructive))" : "1px solid hsl(228,30%,22%)",
                      color: "inherit", resize: "vertical", fontFamily: "inherit", outline: "none", boxSizing: "border-box",
                    }}
                  />
                  {addressError && <p style={{ color: "hsl(var(--destructive))", fontSize: "0.75rem", marginTop: 4 }}>{addressError}</p>}
                </div>
                <div style={{ flexShrink: 0, padding: "12px 16px 16px", borderTop: "1px solid hsl(228,30%,18%)", display: "flex", flexDirection: "column", gap: 10 }}>
                  <Button onClick={handlePlaceOrder} disabled={placing} className="w-full glow-lime font-display font-bold">
                    {placing ? "Placing order…" : `Place Order — $${cartTotal.toFixed(2)}`}
                  </Button>
                  <button onClick={() => { setView("cart"); setAddressError(""); }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "0.75rem", color: "hsl(220,20%,55%)", fontFamily: "monospace", textAlign: "center" }}>← Back to cart</button>
                </div>
              </>
            )}

            {/* ── ORDERS VIEW ── */}
            {view === "orders" && (
              <div style={{ overflowY: "auto", flex: "1 1 auto", minHeight: 0, padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
                {ordersLoading ? (
                  <div style={{ display: "flex", justifyContent: "center", padding: "40px 0" }}>
                    <div style={{ width: 28, height: 28, border: "3px solid hsl(228,30%,22%)", borderTopColor: "hsl(var(--primary))", borderRadius: "50%", animation: "spin 0.7s linear infinite" }} />
                    <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                  </div>
                ) : myOrders.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "40px 0" }}>
                    <Package style={{ width: 40, height: 40, opacity: 0.2, margin: "0 auto 12px" }} />
                    <p style={{ color: "hsl(220,20%,55%)", fontSize: "0.875rem" }}>No orders yet</p>
                  </div>
                ) : myOrders.map(order => {
                  const s = STATUS_STYLES[order.status] || STATUS_STYLES.pending;
                  const Icon = s.icon;
                  return (
                    <div key={order.id} style={{ padding: 12, borderRadius: 12, background: "hsl(230,50%,6%)", border: "1px solid hsl(228,30%,18%)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                        <div>
                          <p style={{ fontFamily: "monospace", fontSize: "0.7rem", color: "hsl(220,20%,50%)" }}>{order.order_number}</p>
                          <p style={{ fontWeight: 700, fontSize: "0.875rem", marginTop: 2 }}>${(order.total || 0).toFixed(2)}</p>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }} className={s.color}>
                          <Icon style={{ width: 13, height: 13 }} />
                          <span style={{ fontSize: "0.75rem", fontWeight: 700, fontFamily: "monospace" }}>{s.label}</span>
                        </div>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                        {(order.items || []).map((item, idx) => (
                          <p key={idx} style={{ fontSize: "0.75rem", color: "hsl(220,20%,60%)" }}>
                            {item.quantity}× {item.product_name}{item.size ? ` (${item.size})` : ""}
                          </p>
                        ))}
                      </div>
                      {order.shipping_address && (
                        <p style={{ fontSize: "0.72rem", color: "hsl(220,20%,45%)", marginTop: 6, fontFamily: "monospace" }}>📦 {order.shipping_address}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

function ProductCard({ product, onAdd }) {
  const [selectedSize, setSelectedSize] = useState(null);
  const hasSizes = product.sizes?.length > 0;

  return (
    <div className="rounded-xl bg-card border border-border/50 overflow-hidden group">
      <div className="relative">
        {product.image_url ? (
          <img src={product.image_url} alt={product.name} className="w-full h-36 object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="w-full h-36 bg-muted flex items-center justify-center">
            <Package className="w-8 h-8 text-muted-foreground/30" />
          </div>
        )}
        {product.stock === 0 && (
          <div className="absolute inset-0 bg-background/70 flex items-center justify-center">
            <span className="font-mono text-xs font-bold uppercase text-muted-foreground">Sold Out</span>
          </div>
        )}
      </div>
      <div className="p-3 space-y-2">
        <div>
          <p className="font-display font-bold text-sm leading-tight">{product.name}</p>
          <p className="font-mono font-black text-primary">${product.price.toFixed(2)}</p>
        </div>
        {hasSizes && (
          <div className="flex flex-wrap gap-1">
            {product.sizes.map(s => (
              <button key={s} onClick={() => setSelectedSize(s)}
                className={`px-1.5 py-0.5 text-[10px] font-mono font-bold rounded border transition-all ${selectedSize === s ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border/50 text-muted-foreground hover:border-primary/30"}`}>
                {s}
              </button>
            ))}
          </div>
        )}
        <button
          onClick={() => { if (hasSizes && !selectedSize) { toast.error("Please select a size"); return; } onAdd(product, selectedSize); }}
          disabled={product.stock === 0}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-primary/10 border border-primary/30 text-primary text-xs font-display font-bold hover:bg-primary/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
          <ShoppingCart className="w-3.5 h-3.5" /> Add to Cart
        </button>
      </div>
    </div>
  );
}