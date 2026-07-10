import { useState } from "react";
import { Upload, Download, X, Send, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

export default function BulkTicketUpload({ event, ticketTypes }) {
  const [guests, setGuests] = useState([]); // [{email, name, ticketTypeId, status}]
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [defaultTicketTypeId, setDefaultTicketTypeId] = useState(ticketTypes[0]?.id || "");
  const [defaultStatus, setDefaultStatus] = useState("active");

  const parseCSV = (text) => {
    const lines = text.trim().split("\n").filter(Boolean);
    // Skip header if present
    const start = lines[0].toLowerCase().includes("email") ? 1 : 0;
    return lines.slice(start).map(line => {
      const cols = line.split(",").map(c => c.trim().replace(/^"|"$/g, ""));
      return {
        email: cols[0] || "",
        name: cols[1] || cols[0]?.split("@")[0] || "Guest",
        ticketTypeId: defaultTicketTypeId,
        status: defaultStatus,
      };
    }).filter(g => g.email.includes("@"));
  };

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const parsed = parseCSV(ev.target.result);
      setGuests(parsed);
      setDone(false);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const updateGuest = (i, field, value) => {
    setGuests(prev => prev.map((g, idx) => idx === i ? { ...g, [field]: value } : g));
  };

  const removeGuest = (i) => setGuests(prev => prev.filter((_, idx) => idx !== i));

  const handleSend = async () => {
    if (!guests.length) return;
    setSending(true);
    const user = await base44.auth.me();
    const orderId = `BULK-${Date.now().toString(36).toUpperCase()}`;

    for (const guest of guests) {
      const tt = ticketTypes.find(t => t.id === guest.ticketTypeId) || ticketTypes[0];
      if (!tt) continue;
      const ticketCode = `TKT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      await base44.entities.Ticket.create({
        ticket_code: ticketCode,
        event_id: event.id,
        ticket_type_id: tt.id,
        order_id: orderId,
        owner_email: guest.email,
        owner_name: guest.name,
        status: guest.status,
        event_title: event.title,
        ticket_type_name: tt.name,
        price_paid: guest.status === "active" ? (tt.price || 0) : 0,
        qr_data: JSON.stringify({ code: ticketCode, event: event.id, type: tt.id }),
      });

      const statusLabel = guest.status === "active" ? "" : ` (${guest.status === "cancelled" ? "Cancelled" : "Complimentary"})`;
      await base44.integrations.Core.SendEmail({
        to: guest.email,
        subject: `🎟️ Your ticket to ${event.title}`,
        body: `Hi ${guest.name},\n\nYou're on the list! Here are your ticket details:\n\nEvent: ${event.title}\n📍 ${event.venue_name}, ${event.city}\n📅 ${event.date ? new Date(event.date).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" }) : "TBA"}\n🕐 Doors: ${event.doors_open || "Check event page"}\n\nTicket Type: ${tt.name}${statusLabel}\nTicket Code: ${ticketCode}\n\nPresent this code at the door. View it anytime at ${window.location.origin}/my-tickets\n\nSee you there! 🎉`,
      });
    }

    setSending(false);
    setDone(true);
    toast.success(`${guests.length} ticket${guests.length > 1 ? "s" : ""} sent!`);
  };

  const downloadTemplate = () => {
    const csv = "email,name\njohn@example.com,John Doe\njane@example.com,Jane Smith";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "guest-list-template.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  if (!ticketTypes.length) return (
    <p className="text-sm text-muted-foreground">No ticket types found for this event.</p>
  );

  return (
    <div className="space-y-4">
      {/* Defaults */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Default Ticket Type</label>
          <Select value={defaultTicketTypeId} onValueChange={setDefaultTicketTypeId}>
            <SelectTrigger className="mt-1 bg-card border-border/50 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {ticketTypes.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Default Status</label>
          <Select value={defaultStatus} onValueChange={setDefaultStatus}>
            <SelectTrigger className="mt-1 bg-card border-border/50 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active (Standard)</SelectItem>
              <SelectItem value="active-vip">Active (VIP)</SelectItem>
              <SelectItem value="active">Complimentary</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Upload */}
      <div className="flex gap-2 flex-wrap">
        <label className="flex items-center gap-2 px-4 py-2 rounded-lg border border-dashed border-primary/40 cursor-pointer hover:border-primary/70 transition-colors text-sm font-mono">
          <Upload className="w-4 h-4 text-primary" />
          Upload CSV
          <input type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} />
        </label>
        <button onClick={downloadTemplate}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border/50 text-sm font-mono text-muted-foreground hover:text-foreground transition-colors">
          <Download className="w-3.5 h-3.5" /> Template
        </button>
      </div>

      <p className="text-[11px] font-mono text-muted-foreground">CSV format: <code className="bg-muted px-1 rounded">email, name</code> (header optional)</p>

      {/* Guest list */}
      {guests.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-mono text-xs text-muted-foreground">{guests.length} guest{guests.length > 1 ? "s" : ""} loaded</p>
            {done && <span className="flex items-center gap-1 text-xs text-green-400 font-mono"><CheckCircle2 className="w-3.5 h-3.5" /> All sent</span>}
          </div>
          <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
            {guests.map((g, i) => (
              <div key={i} className="flex items-center gap-2 p-2.5 rounded-lg bg-card border border-border/40">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{g.name}</p>
                  <p className="text-xs text-muted-foreground font-mono truncate">{g.email}</p>
                </div>
                <Select value={g.ticketTypeId} onValueChange={v => updateGuest(i, "ticketTypeId", v)}>
                  <SelectTrigger className="w-32 h-7 text-xs bg-secondary border-border/50"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ticketTypes.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <button onClick={() => removeGuest(i)} className="text-muted-foreground hover:text-destructive transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
          <Button onClick={handleSend} disabled={sending || done} className="glow-lime font-display font-bold gap-2 w-full">
            <Send className="w-4 h-4" />
            {sending ? `Sending... (${guests.length} emails)` : done ? "All Sent!" : `Send ${guests.length} Ticket${guests.length > 1 ? "s" : ""}`}
          </Button>
        </div>
      )}
    </div>
  );
}