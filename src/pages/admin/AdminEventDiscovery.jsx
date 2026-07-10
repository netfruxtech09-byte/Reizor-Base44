import { useState, useEffect } from "react";
import { CheckCircle2, XCircle, Send, Search, AlertCircle, Zap, Globe, Calendar, MapPin, User, RefreshCw, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";
import { toast } from "sonner";

const STATUS_CONFIG = {
  discovered:          { label: "Discovered",          color: "text-blue-400 bg-blue-400/10 border-blue-400/20" },
  approved:            { label: "Approved",             color: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20" },
  outreach_sent:       { label: "Outreach Sent",        color: "text-purple-400 bg-purple-400/10 border-purple-400/20" },
  organizer_contacted: { label: "Contacted",            color: "text-orange-400 bg-orange-400/10 border-orange-400/20" },
  listed:              { label: "Listed",               color: "text-green-400 bg-green-400/10 border-green-400/20" },
  declined:            { label: "Declined",             color: "text-red-400 bg-red-400/10 border-red-400/20" },
};

const FILTERS = Object.keys(STATUS_CONFIG);

export default function AdminEventDiscovery() {
  const [discoveries, setDiscoveries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState("discovered");
  const [outreachModal, setOutreachModal] = useState(null);
  const [customText, setCustomText] = useState("");
  const [sending, setSending] = useState(false);
  const [adminEmail, setAdminEmail] = useState("");
  const [counts, setCounts] = useState({});
  const [previewMode, setPreviewMode] = useState(false);

  useEffect(() => {
    base44.auth.me().then(u => { if (u?.email) setAdminEmail(u.email); }).catch(() => {});
    loadCounts();
  }, []);

  useEffect(() => {
    loadDiscoveries();
  }, [filter]);

  const loadCounts = async () => {
    const all = await base44.entities.EventDiscovery.list(null, 1000).catch(() => []);
    const c = {};
    FILTERS.forEach(s => { c[s] = all.filter(d => d.status === s).length; });
    setCounts(c);
  };

  const loadDiscoveries = async () => {
    setLoading(true);
    const data = await base44.entities.EventDiscovery.filter({ status: filter }, "-created_date", 500).catch(() => []);
    setDiscoveries(data);
    setLoading(false);
  };

  const handleDiscover = async () => {
    if (!searchQuery.trim()) { toast.error("Enter a search query"); return; }
    setSearching(true);
    try {
      const response = await base44.functions.invoke("discoverMusicEvents", { query: searchQuery });
      if (response.data.success) {
        toast.success(`Discovered ${response.data.discovered_count} events`);
        setSearchQuery("");
        await loadDiscoveries();
        await loadCounts();
      } else {
        toast.error(response.data.error || "Discovery failed");
      }
    } catch (error) {
      toast.error(error.message || "Discovery failed");
    } finally {
      setSearching(false);
    }
  };

  const handleApprove = async (discovery) => {
    await base44.entities.EventDiscovery.update(discovery.id, { status: "approved" });
    setDiscoveries(prev => prev.filter(d => d.id !== discovery.id));
    await loadCounts();
    toast.success("Event approved");
  };

  const handleDecline = async (discovery) => {
    await base44.entities.EventDiscovery.update(discovery.id, { status: "declined" });
    setDiscoveries(prev => prev.filter(d => d.id !== discovery.id));
    await loadCounts();
    toast.success("Event declined");
  };

  const openOutreachModal = (discovery) => {
    setOutreachModal(discovery);
    setCustomText("");
    setPreviewMode(false);
  };

  const buildEmailBody = (discovery, customText) => {
    const eventDateStr = discovery.event_date && !isNaN(new Date(discovery.event_date))
      ? format(new Date(discovery.event_date), "MMM dd, yyyy")
      : "an upcoming date";
    const integrationToken = `token_${Math.random().toString(36).slice(2)}`;
    const customSection = customText.trim()
      ? `<p style="color:#b0b8d4;background:#131929;border-left:3px solid #ff1b8d;padding:10px 14px;border-radius:0 6px 6px 0;margin:12px 0;">${customText.trim().replace(/\n/g, "<br/>")}</p>`
      : "";
    const body = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#07091a;font-family:Arial,sans-serif;"><table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px;"><table width="100%" style="max-width:520px;background:#0d1024;border-radius:14px;border:1px solid #1e2545;"><tr><td style="padding:24px 32px 18px;border-bottom:1px solid #1a2040;"><span style="font-size:20px;font-weight:900;color:#fff;">REIZOR</span></td></tr><tr><td style="padding:28px 32px 24px;"><h1 style="margin:0 0 16px;font-size:22px;font-weight:900;color:#fff;">List Your Event on Reizor 🎟️</h1><p style="color:#d0d4e8;">Hi ${discovery.organizer_name || 'Event Organizer'},</p><p style="color:#b0b8d4;">We discovered your upcoming event <strong style="color:#fff;">"${discovery.event_name}"</strong> on ${eventDateStr} in ${discovery.city}.</p>${customSection}<p style="color:#b0b8d4;">We'd love to help you sell tickets on Reizor:</p><ul style="color:#b0b8d4;"><li>Only 5% commission</li><li>Automatic payment processing</li><li>Real-time sales analytics</li><li>Mobile ticket delivery</li></ul><div style="text-align:center;margin:24px 0;"><a href="https://api.reizor.com/integrate?token=${integrationToken}" style="display:inline-block;background:linear-gradient(135deg,#ff1b8d,#d4006e);color:#fff;font-size:15px;font-weight:800;text-decoration:none;padding:14px 36px;border-radius:8px;">Get Started →</a></div></td></tr><tr><td style="padding:16px 32px;border-top:1px solid #1a2040;background:#09102a;"><p style="margin:0;font-size:11px;color:#4a5470;text-align:center;">Questions? Reply to this email — Reizor Partnerships</p></td></tr></table></td></tr></table></body></html>`;
    return { body, integrationToken };
  };

  const handleSendOutreach = async () => {
    const discovery = outreachModal;
    if (!discovery) return;
    setSending(true);
    try {
      const { body: emailBody, integrationToken } = buildEmailBody(discovery, customText);

      await base44.functions.invoke("emailService", {
        _source: "AdminEventDiscovery",
        to: discovery.organizer_email || "support@example.com",
        subject: `List "${discovery.event_name}" on Reizor — Instant Ticketing`,
        body: emailBody,
      });

      if (adminEmail) {
        await base44.functions.invoke("emailService", {
          _source: "AdminEventDiscovery",
          to: adminEmail,
          subject: `[ADMIN COPY] Outreach sent to ${discovery.organizer_email} for "${discovery.event_name}"`,
          body: emailBody,
        }).catch(() => {});
      }

      const now = new Date().toISOString();
      await base44.entities.EventDiscovery.update(discovery.id, {
        status: "outreach_sent",
        outreach_attempts: (discovery.outreach_attempts || 0) + 1,
        last_outreach_at: now,
        api_integration_token: integrationToken,
      });

      setDiscoveries(prev =>
        prev.map(d => d.id === discovery.id
          ? { ...d, status: "outreach_sent", last_outreach_at: now, outreach_attempts: (d.outreach_attempts || 0) + 1 }
          : d)
      );
      await loadCounts();
      setOutreachModal(null);
      setPreviewMode(false);
      toast.success("Outreach email sent!");
    } catch (err) {
      console.error("Outreach send error:", err);
      toast.error(err?.message || "Failed to send outreach. Please try again.");
    } finally {
      setSending(false);
    }
  };

  const confidenceColor = (score) => {
    if (score >= 85) return "text-green-400 bg-green-400/10";
    if (score >= 70) return "text-yellow-400 bg-yellow-400/10";
    return "text-orange-400 bg-orange-400/10";
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display font-black text-2xl tracking-tight flex items-center gap-2">
            <Zap className="w-6 h-6 text-primary" /> Event Discovery
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Find external events and outreach organizers to join the platform</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadDiscoveries} className="gap-1.5 shrink-0">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </Button>
      </div>

      {/* Discover Panel */}
      <div className="p-5 rounded-xl bg-card border border-border/50 space-y-3">
        <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider font-bold">🔍 Auto-Discover via AI</p>
        <div className="flex gap-2">
          <Input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleDiscover()}
            placeholder="e.g. electronic music festivals New York 2026"
            className="bg-secondary border-border/50 flex-1"
          />
          <Button onClick={handleDiscover} disabled={searching} className="glow-lime font-display font-bold gap-1.5 shrink-0">
            <Search className="w-4 h-4" />
            <span className="hidden sm:inline">{searching ? "Searching..." : "Discover"}</span>
          </Button>
        </div>
        <p className="text-xs text-muted-foreground font-mono">Web search + AI extraction. Only events with &gt;70% confidence are saved.</p>
      </div>

      {/* Status Tabs */}
      <div className="flex gap-2 flex-wrap">
        {FILTERS.map(status => {
          const cfg = STATUS_CONFIG[status];
          const count = counts[status] || 0;
          return (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`flex items-center gap-1.5 text-xs font-mono font-bold px-3 py-1.5 rounded-lg border transition-all ${
                filter === status
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card border-border/50 text-muted-foreground hover:text-foreground hover:border-primary/30"
              }`}
            >
              {cfg.label}
              {count > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${filter === status ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
        </div>
      ) : discoveries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
          <AlertCircle className="w-10 h-10 text-muted-foreground/40" />
          <p className="text-muted-foreground font-medium">No events in "{STATUS_CONFIG[filter]?.label}"</p>
          <p className="text-xs text-muted-foreground font-mono">Use the Discover tool above to find new events</p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground font-mono">{discoveries.length} event{discoveries.length !== 1 ? "s" : ""}</p>
          {discoveries.map(discovery => {
            const statusCfg = STATUS_CONFIG[discovery.status] || STATUS_CONFIG.discovered;
            return (
              <div key={discovery.id} className="rounded-xl bg-card border border-border/50 hover:border-border transition-all overflow-hidden">
                <div className="p-4 sm:p-5">
                  <div className="flex items-start gap-3">
                    {/* Main info */}
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-start gap-2 flex-wrap">
                        <h3 className="font-display font-bold text-base leading-tight">{discovery.event_name}</h3>
                        <span className={`inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${statusCfg.color} shrink-0`}>
                          {statusCfg.label}
                        </span>
                        {discovery.confidence_score && (
                          <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded ${confidenceColor(discovery.confidence_score)}`}>
                            {discovery.confidence_score}% match
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        {discovery.event_date && !isNaN(new Date(discovery.event_date)) && (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 shrink-0" />
                            {format(new Date(discovery.event_date), "MMM d, yyyy")}
                          </span>
                        )}
                        {(discovery.venue_name || discovery.city) && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 shrink-0" />
                            {[discovery.venue_name, discovery.city].filter(Boolean).join(", ")}
                          </span>
                        )}
                        {discovery.organizer_name && (
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3 shrink-0" />
                            {discovery.organizer_name}
                            {discovery.organizer_email && <span className="text-muted-foreground/60">({discovery.organizer_email})</span>}
                          </span>
                        )}
                        {discovery.discovered_url && (() => {
                          try {
                            return (
                              <a href={discovery.discovered_url} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-1 text-primary hover:underline">
                                <Globe className="w-3 h-3 shrink-0" />
                                {new URL(discovery.discovered_url).hostname}
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            );
                          } catch {
                            return (
                              <a href={discovery.discovered_url} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-1 text-primary hover:underline">
                                <Globe className="w-3 h-3 shrink-0" /> Source
                              </a>
                            );
                          }
                        })()}
                      </div>

                      {discovery.event_description && (
                        <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{discovery.event_description}</p>
                      )}

                      {/* Outreach meta */}
                      {(discovery.outreach_attempts > 0 || discovery.last_outreach_at) && (
                        <div className="flex items-center gap-3 text-[10px] font-mono text-muted-foreground">
                          {discovery.outreach_attempts > 0 && (
                            <span className="flex items-center gap-1">
                              <Send className="w-3 h-3" /> {discovery.outreach_attempts} outreach attempt{discovery.outreach_attempts > 1 ? "s" : ""}
                            </span>
                          )}
                          {discovery.last_outreach_at && (
                            <span>Last: {format(new Date(discovery.last_outreach_at), "MMM d, h:mm a")}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                {(discovery.status === "discovered" || discovery.status === "approved") && (
                  <div className="border-t border-border/30 px-4 sm:px-5 py-3 bg-muted/20 flex gap-2">
                    {discovery.status === "discovered" && (
                      <>
                        <Button onClick={() => handleApprove(discovery)} size="sm" variant="outline"
                          className="flex-1 border-green-400/30 text-green-400 hover:bg-green-400/10 gap-1.5 font-mono font-bold">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                        </Button>
                        <Button onClick={() => handleDecline(discovery)} size="sm" variant="outline"
                          className="flex-1 border-red-400/30 text-red-400 hover:bg-red-400/10 gap-1.5 font-mono font-bold">
                          <XCircle className="w-3.5 h-3.5" /> Decline
                        </Button>
                      </>
                    )}
                    {discovery.status === "approved" && (
                      <Button onClick={() => openOutreachModal(discovery)} size="sm"
                        className="flex-1 glow-lime font-display font-bold gap-1.5">
                        <Send className="w-3.5 h-3.5" /> Send Outreach Email
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Outreach Modal */}
      {outreachModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-card border border-border/60 rounded-2xl w-full max-w-lg shadow-2xl">
            {!previewMode ? (
              /* Step 1: Compose */
              <div className="p-6 space-y-5">
                <div className="space-y-1">
                  <h3 className="font-display font-black text-lg">Send Outreach Email</h3>
                  <div className="text-xs text-muted-foreground font-mono space-y-0.5">
                    <p>To: <span className="text-primary">{outreachModal.organizer_name || "Event Organizer"}</span> &lt;{outreachModal.organizer_email}&gt;</p>
                    <p>Subject: <span className="text-foreground">List "{outreachModal.event_name}" on Reizor — Instant Ticketing</span></p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Custom message (optional)</label>
                  <Textarea
                    value={customText}
                    onChange={e => setCustomText(e.target.value)}
                    placeholder="Add a personal note to include in the email..."
                    className="bg-secondary border-border/50 min-h-[90px] resize-none"
                  />
                  <p className="text-[10px] text-muted-foreground font-mono">
                    Appears highlighted in the email. A copy is sent to {adminEmail || "admin"}.
                  </p>
                </div>

                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setOutreachModal(null)} className="flex-1">Cancel</Button>
                  <Button onClick={() => setPreviewMode(true)} className="flex-1 font-display font-bold gap-1.5">
                    Preview Email →
                  </Button>
                </div>
              </div>
            ) : (
              /* Step 2: Preview */
              <div className="flex flex-col max-h-[85vh]">
                <div className="p-5 border-b border-border/50 space-y-1 shrink-0">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display font-black text-lg">Email Preview</h3>
                    <span className="text-[10px] font-mono text-muted-foreground bg-yellow-400/10 text-yellow-400 border border-yellow-400/20 px-2 py-0.5 rounded">Not sent yet</span>
                  </div>
                  <div className="text-xs text-muted-foreground font-mono space-y-0.5">
                    <p><span className="text-muted-foreground/60">To:</span> {outreachModal.organizer_name || "Event Organizer"} &lt;<span className="text-primary">{outreachModal.organizer_email}</span>&gt;</p>
                    <p><span className="text-muted-foreground/60">Subject:</span> <span className="text-foreground">List "{outreachModal.event_name}" on Reizor — Instant Ticketing</span></p>
                    <p><span className="text-muted-foreground/60">From:</span> Reizor Partnerships</p>
                  </div>
                </div>

                <div className="overflow-y-auto flex-1 p-4">
                  <div className="rounded-lg overflow-hidden border border-border/30 bg-[#07091a]">
                    <iframe
                      srcDoc={buildEmailBody(outreachModal, customText).body}
                      className="w-full"
                      style={{ height: 480, border: "none" }}
                      title="Email Preview"
                      sandbox="allow-same-origin"
                    />
                  </div>
                </div>

                <div className="p-4 border-t border-border/50 flex gap-3 shrink-0">
                  <Button variant="outline" onClick={() => setPreviewMode(false)} className="flex-1" disabled={sending}>← Edit</Button>
                  <Button variant="outline" onClick={() => setOutreachModal(null)} className="border-destructive/30 text-destructive hover:bg-destructive/10" disabled={sending}>Cancel</Button>
                  <Button onClick={handleSendOutreach} disabled={sending} className="flex-1 glow-lime font-display font-bold gap-1.5">
                    <Send className="w-3.5 h-3.5" /> {sending ? "Sending..." : "Send Email"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}