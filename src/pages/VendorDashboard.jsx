import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Users, Copy, Check, ExternalLink, Download, QrCode, AlertTriangle, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

async function copyToClipboard(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.cssText = "position:fixed;top:0;left:0;opacity:0;pointer-events:none;";
      document.body.appendChild(ta);
      ta.focus(); ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    return true;
  } catch { return false; }
}

export default function VendorDashboard() {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(null);
  const [user, setUser] = useState(null);

  // Invite params from URL
  const params = new URLSearchParams(window.location.search);
  const inviteVendorId = params.get("vendor_id");
  const inviteEventId = params.get("event_id");
  const inviteEmail = params.get("email") ? decodeURIComponent(params.get("email")) : null;

  useEffect(() => {
    (async () => {
      const isAuthed = await base44.auth.isAuthenticated().catch(() => false);
      if (!isAuthed) {
        // Preserve invite params in the redirect URL so they survive login
        const nextUrl = window.location.pathname + window.location.search;
        base44.auth.redirectToLogin(nextUrl);
        return;
      }
      const u = await base44.auth.me().catch(() => null);
      if (!u) { setLoading(false); return; }
      setUser(u);
      const data = await base44.entities.EventVendor.filter({ email: u.email }, "-created_date", 50).catch(() => []);
      setVendors(data);
      setLoading(false);
    })();
  }, []);

  const copyLink = async (link, id) => {
    const ok = await copyToClipboard(link);
    if (ok) {
      setCopied(id);
      toast.success("Link copied!");
      setTimeout(() => setCopied(null), 2000);
    } else {
      toast.error("Could not copy — please copy manually");
    }
  };

  const downloadQR = (v) => {
    if (!v.qr_code_url) return;
    const a = document.createElement("a");
    a.href = v.qr_code_url;
    a.download = `vendor_${v.vendor_code}_QR.png`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
    </div>
  );

  if (!user) return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="text-center space-y-3">
        <p className="text-muted-foreground">Please sign in to view your vendor portal.</p>
        <Button onClick={() => base44.auth.redirectToLogin(window.location.pathname + window.location.search)}>Sign In</Button>
      </div>
    </div>
  );

  // Email mismatch check — if opened via invite link with a different email
  if (inviteEmail && user.email.toLowerCase() !== inviteEmail.toLowerCase()) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md w-full p-8 rounded-2xl bg-card border border-destructive/40 text-center space-y-4">
          <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-7 h-7 text-destructive" />
          </div>
          <h2 className="font-display font-black text-xl">Wrong Account</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            This vendor invite was sent to <span className="font-bold text-foreground">{inviteEmail}</span>.
          </p>
          <p className="text-sm text-muted-foreground">
            You're currently signed in as <span className="font-bold text-foreground">{user.email}</span>.
          </p>
          <p className="text-sm text-muted-foreground">
            Please log in using the invited vendor email address.
          </p>
          <Button onClick={() => base44.auth.logout(window.location.pathname + window.location.search)} className="w-full">
            Sign Out & Use Correct Account
          </Button>
        </div>
      </div>
    );
  }

  // If arrived via invite link, highlight the specific vendor
  const highlightedVendor = inviteVendorId ? vendors.find(v => v.id === inviteVendorId) : null;
  const displayVendors = highlightedVendor
    ? [highlightedVendor, ...vendors.filter(v => v.id !== inviteVendorId)]
    : vendors;

  const totalTicketsSold = vendors.reduce((s, v) => s + (v.tickets_sold || 0), 0);
  const totalTablesSold = vendors.reduce((s, v) => s + (v.tables_sold || 0), 0);

  return (
    <div className="min-h-screen py-8 px-4 sm:px-6 max-w-3xl mx-auto">
      <div className="mb-8">
        <span className="font-mono text-xs text-primary tracking-[0.3em] uppercase">★ VENDOR PORTAL</span>
        <h1 className="font-display font-black text-4xl tracking-tight mt-1">MY SALES</h1>
        <p className="text-sm text-muted-foreground mt-1">Track your ticket and table sales performance across events.</p>
      </div>

      {vendors.length === 0 ? (
        <div className="text-center py-20">
          <Users className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
          <p className="font-display font-bold text-xl text-muted-foreground mb-2">No assignments yet</p>
          <p className="text-sm text-muted-foreground">You'll be notified by email when an organizer assigns you to an event.</p>
          {inviteEmail && (
            <div className="mt-4 p-4 rounded-xl bg-amber-400/10 border border-amber-400/30 flex items-start gap-3 text-left max-w-sm mx-auto">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-300">
                If you just accepted a vendor invite, it may take a moment to load. Try refreshing the page.
              </p>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="p-4 rounded-xl bg-card border border-border/50 text-center">
              <p className="font-mono text-[10px] text-muted-foreground uppercase">Events</p>
              <p className="font-mono font-bold text-primary text-2xl">{vendors.length}</p>
            </div>
            <div className="p-4 rounded-xl bg-card border border-border/50 text-center">
              <p className="font-mono text-[10px] text-muted-foreground uppercase">Tickets Sold</p>
              <p className="font-mono font-bold text-2xl">{totalTicketsSold}</p>
            </div>
            <div className="p-4 rounded-xl bg-card border border-border/50 text-center">
              <p className="font-mono text-[10px] text-muted-foreground uppercase">Tables Sold</p>
              <p className="font-mono font-bold text-2xl">{totalTablesSold}</p>
            </div>
          </div>

          <div className="space-y-4">
            {displayVendors.map(v => {
              const isHighlighted = v.id === inviteVendorId;
              return (
                <div key={v.id} className={`p-5 rounded-xl bg-card border space-y-4 ${isHighlighted ? "border-primary/50 shadow-lg shadow-primary/10" : "border-border/50"}`}>
                  {isHighlighted && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/20">
                      <span className="text-sm">🎟️</span>
                      <p className="text-xs font-mono text-primary font-bold">Your vendor invitation for this event</p>
                    </div>
                  )}

                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-display font-bold text-lg">{v.event_title}</h3>
                      <p className="font-mono text-xs text-muted-foreground">
                        Code: <span className="text-foreground font-bold">{v.vendor_code}</span>
                      </p>
                      {v.status === "suspended" && (
                        <span className="font-mono text-[10px] text-destructive bg-destructive/10 px-2 py-0.5 rounded mt-1 inline-block">Suspended</span>
                      )}
                    </div>
                    <Link to={`/events/${v.event_id}`} target="_blank">
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    </Link>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg bg-secondary/60 border border-border/30">
                      <p className="font-mono text-[10px] text-muted-foreground uppercase">Tickets</p>
                      <p className="font-mono font-bold text-lg">
                        <span className="text-primary">{v.tickets_sold || 0}</span>
                        <span className="text-muted-foreground text-sm"> / {v.ticket_allocation || 0}</span>
                      </p>
                      <div className="mt-1.5 bg-muted rounded-full h-1.5 overflow-hidden">
                        <div className="h-full bg-primary rounded-full transition-all"
                          style={{ width: v.ticket_allocation > 0 ? `${Math.min(100, ((v.tickets_sold || 0) / v.ticket_allocation) * 100)}%` : "0%" }} />
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-secondary/60 border border-border/30">
                      <p className="font-mono text-[10px] text-muted-foreground uppercase">Tables</p>
                      <p className="font-mono font-bold text-lg">
                        <span className="text-primary">{v.tables_sold || 0}</span>
                        <span className="text-muted-foreground text-sm"> / {v.table_allocation || 0}</span>
                      </p>
                      <div className="mt-1.5 bg-muted rounded-full h-1.5 overflow-hidden">
                        <div className="h-full bg-accent rounded-full transition-all"
                          style={{ width: v.table_allocation > 0 ? `${Math.min(100, ((v.tables_sold || 0) / v.table_allocation) * 100)}%` : "0%" }} />
                      </div>
                    </div>
                  </div>

                  {v.vendor_link && (
                    <div className="space-y-3 pt-1 border-t border-border/30">
                      <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">Your Unique Selling Link</p>
                      
                      {/* Link display */}
                      <div className="px-3 py-2 rounded-lg bg-accent/10 border border-accent/20">
                        <p className="text-xs font-mono text-accent break-all">{v.vendor_link}</p>
                      </div>

                      {/* Action buttons */}
                      <div className="flex gap-2 flex-wrap">
                        <Button size="sm" className="gap-1.5 flex-1 sm:flex-none" onClick={() => copyLink(v.vendor_link, v.id)}>
                          {copied === v.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          {copied === v.id ? "Copied!" : "Copy Link"}
                        </Button>
                        {v.qr_code_url && (
                          <Button size="sm" variant="outline" className="gap-1.5 flex-1 sm:flex-none" onClick={() => downloadQR(v)}>
                            <Download className="w-3.5 h-3.5" /> Download QR
                          </Button>
                        )}
                      </div>

                      {/* QR Code */}
                      {v.qr_code_url && (
                        <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/60 border border-border/30">
                          <div className="bg-white p-2 rounded-lg shrink-0">
                            <img src={v.qr_code_url} alt="Vendor QR" className="w-20 h-20 sm:w-24 sm:h-24 object-contain" />
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5">
                              <QrCode className="w-3.5 h-3.5 text-muted-foreground" />
                              <p className="font-mono text-[10px] text-muted-foreground uppercase">QR Code</p>
                            </div>
                            <p className="text-xs text-muted-foreground">Scan to purchase through your vendor link. All sales are automatically tracked to you.</p>
                          </div>
                        </div>
                      )}

                      <p className="text-xs text-muted-foreground">Share this link or QR code to track your ticket sales. Every purchase through it is credited to you.</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}