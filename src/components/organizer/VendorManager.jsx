import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Copy, Check, Download, Users, Edit2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { sendEmail } from "@/utils/emailService";
import { buildEmailBody } from "@/utils/emailTemplate";

const EMPTY_FORM = {
  company_name: "", full_name: "", email: "", phone: "",
  city: "", state: "", country: "",
  ticket_allocation: "", table_allocation: "",
  seller_fee: "", seller_fee_type: "fixed",
  vendor_code: "",
};

function generateVendorCode() {
  return "VND-" + Math.random().toString(36).slice(2, 7).toUpperCase();
}

function VendorForm({ initial, onSave, onCancel, saving, eventId }) {
  const [form, setForm] = useState(() => ({
    ...EMPTY_FORM,
    vendor_code: generateVendorCode(),
    ...(initial || {}),
  }));
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="p-4 rounded-xl bg-secondary/50 border border-border/50 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-[10px] font-mono text-muted-foreground">Full Name *</Label>
          <Input value={form.full_name} onChange={e => set("full_name", e.target.value)}
            placeholder="Jane Smith" className="mt-1 bg-background border-border/50 text-sm" />
        </div>
        <div>
          <Label className="text-[10px] font-mono text-muted-foreground">Email *</Label>
          <Input value={form.email} onChange={e => set("email", e.target.value)}
            placeholder="vendor@example.com" className="mt-1 bg-background border-border/50 text-sm" />
        </div>
        <div>
          <Label className="text-[10px] font-mono text-muted-foreground">Company Name (optional)</Label>
          <Input value={form.company_name} onChange={e => set("company_name", e.target.value)}
            placeholder="Event Pros LLC" className="mt-1 bg-background border-border/50 text-sm" />
        </div>
        <div>
          <Label className="text-[10px] font-mono text-muted-foreground">Phone</Label>
          <Input value={form.phone} onChange={e => set("phone", e.target.value)}
            placeholder="+1 555 000 0000" className="mt-1 bg-background border-border/50 text-sm" />
        </div>
        <div>
          <Label className="text-[10px] font-mono text-muted-foreground">City</Label>
          <Input value={form.city} onChange={e => set("city", e.target.value)}
            placeholder="New York" className="mt-1 bg-background border-border/50 text-sm" />
        </div>
        <div>
          <Label className="text-[10px] font-mono text-muted-foreground">State</Label>
          <Input value={form.state} onChange={e => set("state", e.target.value)}
            placeholder="NY" className="mt-1 bg-background border-border/50 text-sm" />
        </div>
        <div>
          <Label className="text-[10px] font-mono text-muted-foreground">Country</Label>
          <Input value={form.country} onChange={e => set("country", e.target.value)}
            placeholder="USA" className="mt-1 bg-background border-border/50 text-sm" />
        </div>
      </div>

      {/* Tracking Code */}
      <div>
        <Label className="text-[10px] font-mono text-muted-foreground">Tracking Code / Vendor Code *</Label>
        <div className="flex gap-2 mt-1">
          <Input
            value={form.vendor_code}
            onChange={e => set("vendor_code", e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ""))}
            placeholder="VND-ABC12"
            className="font-mono bg-background border-border/50 text-sm flex-1"
          />
          <Button type="button" size="sm" variant="outline" className="gap-1 shrink-0"
            onClick={() => set("vendor_code", generateVendorCode())}>
            <RefreshCw className="w-3 h-3" /> New
          </Button>
        </div>
        {form.vendor_code && eventId && (
          <div className="mt-1.5 px-3 py-2 rounded-lg bg-accent/10 border border-accent/20">
            <p className="text-[10px] font-mono text-muted-foreground mb-0.5">Vendor sale link preview:</p>
            <p className="text-xs font-mono text-accent break-all">
              {window.location.origin}/events/{eventId}?ref={form.vendor_code}
            </p>
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 pt-1">
        <div>
          <Label className="text-[10px] font-mono text-muted-foreground">Ticket Allocation</Label>
          <Input type="number" value={form.ticket_allocation} onChange={e => set("ticket_allocation", e.target.value)}
            placeholder="50" className="mt-1 bg-background border-border/50 text-sm" />
          <p className="text-[10px] text-muted-foreground mt-0.5">Max tickets this vendor can sell</p>
        </div>
        <div>
          <Label className="text-[10px] font-mono text-muted-foreground">Table Allocation</Label>
          <Input type="number" value={form.table_allocation} onChange={e => set("table_allocation", e.target.value)}
            placeholder="5" className="mt-1 bg-background border-border/50 text-sm" />
          <p className="text-[10px] text-muted-foreground mt-0.5">Max tables this vendor can sell</p>
        </div>
      </div>

      {/* Seller Fee */}
      <div className="pt-1 space-y-2">
        <Label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Seller Commission (above platform fee)</Label>
        <div className="flex gap-2 items-center flex-wrap">
          <button type="button" onClick={() => set("seller_fee_type", "fixed")}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold border transition-all ${form.seller_fee_type === "fixed" ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border/50 text-muted-foreground"}`}>
            $ Fixed
          </button>
          <button type="button" onClick={() => set("seller_fee_type", "percentage")}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold border transition-all ${form.seller_fee_type === "percentage" ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border/50 text-muted-foreground"}`}>
            % Per Ticket
          </button>
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-mono text-muted-foreground">{form.seller_fee_type === "fixed" ? "$" : ""}</span>
            <Input type="number" value={form.seller_fee} onChange={e => set("seller_fee", e.target.value)}
              placeholder="0" className="w-24 bg-background border-border/50 text-sm" />
            <span className="text-xs font-mono text-muted-foreground">{form.seller_fee_type === "percentage" ? "%" : ""} per ticket</span>
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground font-mono">Commission paid to seller on each ticket sold through their link</p>
      </div>
      <div className="flex gap-2 pt-1">
        <Button size="sm" disabled={saving || !form.full_name || !form.email}
          onClick={() => onSave(form)} className="gap-1.5">
          {saving ? "Saving…" : "Save Vendor"}
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

export default function VendorManager({ event }) {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [createdVendor, setCreatedVendor] = useState(null); // post-save confirmation

  const load = useCallback(async () => {
    const [data, user] = await Promise.all([
      base44.entities.EventVendor.filter({ event_id: event.id }, "-created_date", 50).catch(() => []),
      base44.auth.me().catch(() => null),
    ]);
    setVendors(data);
    setCurrentUser(user);
    setLoading(false);
  }, [event.id]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (form, existingId) => {
    if (!form.full_name || !form.email) { toast.error("Name and email are required"); return; }
    if (!form.vendor_code?.trim()) { toast.error("Tracking code is required"); return; }
    setSaving(true);
    const vendorCode = (form.vendor_code || "").trim().toUpperCase() || (existingId
      ? vendors.find(v => v.id === existingId)?.vendor_code || generateVendorCode()
      : generateVendorCode());
    const vendorLink = `${window.location.origin}/events/${event.id}?ref=${vendorCode}`;

    // Generate QR code
    let qrUrl = "";
    try {
      const qrRes = await base44.functions.invoke("generateEventQR", {
        event_id: event.id,
        ticket_url: vendorLink,
      });
      if (qrRes.data?.success) qrUrl = qrRes.data.qr_code_url;
    } catch {}

    const payload = {
      organizer_id: currentUser?.id || event.organizer_id,
      event_id: event.id,
      event_title: event.title,
      company_name: form.company_name || "",
      full_name: form.full_name,
      email: form.email,
      phone: form.phone || "",
      city: form.city || "",
      state: form.state || "",
      country: form.country || "",
      ticket_allocation: Number(form.ticket_allocation) || 0,
      table_allocation: Number(form.table_allocation) || 0,
      seller_fee: Number(form.seller_fee) || 0,
      seller_fee_type: form.seller_fee_type || "fixed",
      vendor_code: vendorCode,
      vendor_link: vendorLink,
      qr_code_url: qrUrl,
      status: "active",
    };

    let savedVendor;
    if (existingId) {
      savedVendor = await base44.entities.EventVendor.update(existingId, payload);
      toast.success("Vendor updated");
    } else {
      savedVendor = await base44.entities.EventVendor.create(payload);
      // Send invite email
      try {
        const vendorPortalUrl = `${window.location.origin}/vendor-dashboard?vendor_id=${savedVendor.id}&event_id=${event.id}&email=${encodeURIComponent(form.email)}`;
        await sendEmail({
          _source: "VendorManager/invite",
          to: form.email,
          subject: `You've been added as a vendor for ${event.title}`,
          body: buildEmailBody({
            title: "🎟️ Vendor Invitation",
            greeting: `Hi ${form.full_name},`,
            message: `You've been assigned as a ticket vendor for <strong>${event.title}</strong>.`,
            infoBox: {
              rows: [
                { label: "Event", value: event.title },
                { label: "Your Code", value: vendorCode },
                { label: "Ticket Allocation", value: String(Number(form.ticket_allocation) || 0) },
                { label: "Table Allocation", value: String(Number(form.table_allocation) || 0) },
                ...(Number(form.seller_fee) > 0 ? [{ label: "Your Commission", value: form.seller_fee_type === "percentage" ? `${form.seller_fee}% per ticket` : `$${Number(form.seller_fee).toFixed(2)} per ticket` }] : []),
              ],
            },
            extraLines: ["Click the button below to access your vendor portal where you can view your unique selling link and QR code."],
            ctaText: "Access My Vendor Portal →",
            ctaUrl: vendorPortalUrl,
            footerNote: "Your vendor code: " + vendorCode,
          }),
        });
        await base44.entities.EventVendor.update(savedVendor.id, { invite_sent: true });
      } catch {}
      // Show post-creation confirmation with the shareable link
      setCreatedVendor({ name: form.full_name, email: form.email, vendor_code: vendorCode, vendor_link: vendorLink, qr_code_url: qrUrl });
      toast.success(`Vendor added! Invite sent to ${form.email}.`);
    }

    setShowForm(false);
    setEditingId(null);
    load();
    setSaving(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Remove this vendor from the event?")) return;
    await base44.entities.EventVendor.delete(id);
    setVendors(v => v.filter(x => x.id !== id));
    toast.success("Vendor removed");
  };

  const copyLink = (link, id) => {
    navigator.clipboard.writeText(link);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
    toast.success("Link copied!");
  };

  const downloadQR = (v) => {
    if (!v.qr_code_url) return;
    const a = document.createElement("a");
    a.href = v.qr_code_url;
    a.download = `vendor_${v.vendor_code}_QR.png`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  if (loading) return <div className="py-4 flex justify-center"><div className="w-5 h-5 border-2 border-muted border-t-primary rounded-full animate-spin" /></div>;

  const totalTicketsSold = vendors.reduce((s, v) => s + (v.tickets_sold || 0), 0);
  const totalTablesSold = vendors.reduce((s, v) => s + (v.tables_sold || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            <h3 className="font-display font-bold text-lg">TICKET SELLERS / AFFILIATES</h3>
            {vendors.length > 0 && (
              <span className="font-mono text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded font-bold">
                {vendors.length} vendor{vendors.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">Add ticket sellers & affiliates — assign allocations, set commissions, and share unique tracking links.</p>
        </div>
        {!showForm && (
          <Button size="sm" onClick={() => { setShowForm(true); setEditingId(null); setCreatedVendor(null); }} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Add Vendor
          </Button>
        )}
      </div>

      {/* Post-creation confirmation panel */}
      {createdVendor && (
        <div className="p-4 rounded-xl bg-green-400/10 border border-green-400/40 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">🎉</span>
              <p className="font-display font-bold text-sm">Vendor Created — Share this link with {createdVendor.name}!</p>
            </div>
            <button onClick={() => setCreatedVendor(null)} className="text-muted-foreground hover:text-foreground font-bold text-lg leading-none">×</button>
          </div>
          <p className="text-xs font-mono text-muted-foreground">
            Tracking Code: <span className="text-accent font-bold">{createdVendor.vendor_code}</span>
            &nbsp;·&nbsp;Email: <span className="text-foreground">{createdVendor.email}</span>
          </p>
          <div className="flex gap-2 items-center flex-wrap">
            <div className="flex-1 min-w-0 px-3 py-2 rounded-lg bg-secondary border border-border/50 font-mono text-xs text-accent truncate">
              {createdVendor.vendor_link}
            </div>
            <Button size="sm" className="shrink-0 gap-1.5 glow-lime font-bold" onClick={() => {
              navigator.clipboard.writeText(createdVendor.vendor_link);
              toast.success("Vendor link copied!");
            }}>
              <Copy className="w-3.5 h-3.5" /> Copy Link
            </Button>
          </div>
          {createdVendor.qr_code_url && (
            <div className="flex items-center gap-3">
              <div className="bg-white p-2 rounded-lg shrink-0">
                <img src={createdVendor.qr_code_url} alt="QR" className="w-16 h-16" />
              </div>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => {
                const a = document.createElement("a");
                a.href = createdVendor.qr_code_url;
                a.download = `vendor_${createdVendor.vendor_code}_QR.png`;
                a.click();
              }}>
                <Download className="w-3.5 h-3.5" /> Download QR
              </Button>
            </div>
          )}
        </div>
      )}

      {showForm && !editingId && (
        <VendorForm saving={saving} eventId={event.id} onCancel={() => setShowForm(false)} onSave={(f) => handleSave(f, null)} />
      )}

      {vendors.length > 0 && (
        <>
          {/* Summary row */}
          <div className="grid grid-cols-3 gap-3">
            <div className="p-3 rounded-lg bg-card border border-border/50 text-center">
              <p className="font-mono text-[10px] text-muted-foreground uppercase">Vendors</p>
              <p className="font-mono font-bold text-primary text-xl">{vendors.length}</p>
            </div>
            <div className="p-3 rounded-lg bg-card border border-border/50 text-center">
              <p className="font-mono text-[10px] text-muted-foreground uppercase">Tickets Sold</p>
              <p className="font-mono font-bold text-xl">{totalTicketsSold}</p>
            </div>
            <div className="p-3 rounded-lg bg-card border border-border/50 text-center">
              <p className="font-mono text-[10px] text-muted-foreground uppercase">Tables Sold</p>
              <p className="font-mono font-bold text-xl">{totalTablesSold}</p>
            </div>
          </div>

          {/* Vendor cards */}
          {vendors.map(v => (
            <div key={v.id} className="p-4 rounded-xl bg-card border border-border/50 space-y-3">
              {editingId === v.id ? (
                <VendorForm
                  initial={{
                    company_name: v.company_name || "", full_name: v.full_name, email: v.email,
                    phone: v.phone || "", city: v.city || "", state: v.state || "", country: v.country || "",
                    ticket_allocation: v.ticket_allocation || "", table_allocation: v.table_allocation || "",
                    seller_fee: v.seller_fee || "", seller_fee_type: v.seller_fee_type || "fixed",
                    vendor_code: v.vendor_code || generateVendorCode(),
                  }}
                  saving={saving}
                  eventId={event.id}
                  onCancel={() => setEditingId(null)}
                  onSave={(f) => handleSave(f, v.id)}
                />
              ) : (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-bold">{v.full_name}{v.company_name && <span className="text-muted-foreground font-normal text-xs ml-2">({v.company_name})</span>}</p>
                      <p className="font-mono text-xs text-muted-foreground">{v.email}{v.phone && ` · ${v.phone}`}</p>
                      {(v.city || v.country) && (
                        <p className="font-mono text-xs text-muted-foreground">{[v.city, v.state, v.country].filter(Boolean).join(", ")}</p>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingId(v.id)}>
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(v.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Seller Fee Badge */}
                  {v.seller_fee > 0 && (
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-green-400/10 border border-green-400/20">
                      <span className="font-mono text-[10px] text-green-400 font-bold uppercase tracking-wider">
                        Commission: {v.seller_fee_type === "percentage" ? `${v.seller_fee}% per ticket` : `$${v.seller_fee.toFixed(2)} per ticket`}
                      </span>
                    </div>
                  )}

                  {/* Performance */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2 rounded-lg bg-secondary/60 border border-border/30">
                      <p className="font-mono text-[10px] text-muted-foreground uppercase">Tickets</p>
                      <p className="font-mono font-bold text-sm">
                        <span className="text-primary">{v.tickets_sold || 0}</span>
                        <span className="text-muted-foreground"> / {v.ticket_allocation || 0}</span>
                      </p>
                    </div>
                    <div className="p-2 rounded-lg bg-secondary/60 border border-border/30">
                      <p className="font-mono text-[10px] text-muted-foreground uppercase">Tables</p>
                      <p className="font-mono font-bold text-sm">
                        <span className="text-primary">{v.tables_sold || 0}</span>
                        <span className="text-muted-foreground"> / {v.table_allocation || 0}</span>
                      </p>
                    </div>
                  </div>

                  {/* Ticket Sale Link & QR */}
                  {v.vendor_link && (
                    <div className="space-y-2 pt-1 border-t border-border/30">
                      <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">🔗 Ticket Sale Link & QR Code</p>
                      <div className="flex gap-2">
                        <input readOnly value={v.vendor_link}
                          className="flex-1 rounded-md bg-secondary border border-border/50 px-2 py-1.5 text-xs font-mono text-muted-foreground min-w-0" />
                        <Button size="icon" variant="outline" className="h-8 w-8 shrink-0" title="Copy sale link" onClick={() => copyLink(v.vendor_link, v.id)}>
                          {copied === v.id ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </Button>
                      </div>
                      <p className="font-mono text-[10px] text-muted-foreground">
                        Vendor Code: <span className="text-foreground font-bold">{v.vendor_code}</span>
                        {v.invite_sent && <span className="ml-2 text-green-400">✓ Invite sent</span>}
                      </p>
                      {/* QR Code display */}
                      {v.qr_code_url ? (
                        <div className="flex items-start gap-3 p-3 rounded-lg bg-secondary/60 border border-border/30">
                          <div className="bg-white p-2 rounded-lg shrink-0">
                            <img src={v.qr_code_url} alt="Vendor QR" className="w-20 h-20 object-contain" />
                          </div>
                          <div className="space-y-1.5 min-w-0">
                            <p className="font-mono text-[10px] text-muted-foreground">Scan to purchase through this vendor's link. Sales are automatically tracked to <strong className="text-foreground">{v.full_name}</strong>.</p>
                            <Button size="sm" variant="outline" onClick={() => downloadQR(v)} className="gap-1.5 text-xs h-7">
                              <Download className="w-3 h-3" /> Download QR
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-[10px] text-muted-foreground font-mono">QR code not yet generated — edit and save to regenerate.</p>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </>
      )}

      {vendors.length === 0 && !showForm && (
        <div className="py-8 text-center text-muted-foreground text-sm font-mono">
          No vendors yet — click Add Vendor to get started.
        </div>
      )}
    </div>
  );
}