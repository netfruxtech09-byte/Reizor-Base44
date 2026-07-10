import { useState, useEffect } from "react";
import { Plus, MapPin, Calendar, Clock, DollarSign, Briefcase, Upload, X, Sparkles, ChevronDown, ChevronUp, CheckCircle2, Edit2, Trash2, Home, Plane, FileText, Phone, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { base44 } from "@/api/base44Client";
import { format, parseISO, differenceInHours } from "date-fns";
import { toast } from "sonner";

const STATUS_COLOR = {
  pending:   "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
  confirmed: "text-green-400 bg-green-400/10 border-green-400/20",
  completed: "text-muted-foreground bg-muted border-border/50",
  cancelled: "text-destructive bg-destructive/10 border-destructive/20",
};

const BLANK_FORM = {
  event_name: "", venue: "", city: "", country: "", show_date: "", soundcheck_time: "",
  performance_time: "", fee: "", booker_name: "", booker_email: "", booker_phone: "",
  contract_notes: "", hotel_name: "", hotel_address: "", contract_file_url: "",
};

export default function ArtistBookingAgency() {
  const [artist, setArtist] = useState(null);
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(BLANK_FORM);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [homeAddress, setHomeAddress] = useState("");
  const [savingHome, setSavingHome] = useState(false);
  const [activeTab, setActiveTab] = useState("upcoming");
  const [generatingPlan, setGeneratingPlan] = useState(false);
  const [aiPlan, setAiPlan] = useState(null);

  useEffect(() => {
    base44.auth.me().then(async (user) => {
      const artists = await base44.entities.Artist.filter({ user_email: user.email }, null, 1);
      if (!artists[0]) { setLoading(false); return; }
      const a = artists[0];
      setArtist(a);
      setHomeAddress(a.home_address || "");
      const c = await base44.entities.BookingContract.filter({ artist_id: a.id }, "show_date", 100);
      setContracts(c);
      setLoading(false);
    });
  }, []);

  const startNew = () => { setForm(BLANK_FORM); setEditing("new"); };
  const startEdit = (c) => {
    setForm({
      ...c,
      fee: String(c.fee || ""),
      show_date: c.show_date ? c.show_date.slice(0, 16) : "",
    });
    setEditing(c.id);
  };

  const handleContractUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setForm(f => ({ ...f, contract_file_url: file_url }));
    setUploading(false);
    toast.success("Contract uploaded");
  };

  const handleSave = async () => {
    if (!form.event_name || !form.show_date) { toast.error("Event name and show date are required"); return; }
    setSaving(true);
    const data = {
      artist_id: artist.id, artist_name: artist.display_name, artist_email: artist.user_email,
      event_name: form.event_name, venue: form.venue, city: form.city, country: form.country,
      show_date: new Date(form.show_date).toISOString(),
      soundcheck_time: form.soundcheck_time, performance_time: form.performance_time,
      fee: form.fee ? parseFloat(form.fee) : null,
      booker_name: form.booker_name, booker_email: form.booker_email, booker_phone: form.booker_phone,
      contract_notes: form.contract_notes, hotel_name: form.hotel_name,
      hotel_address: form.hotel_address, contract_file_url: form.contract_file_url || "",
      status: editing === "new" ? "confirmed" : form.status,
    };
    if (editing === "new") {
      const created = await base44.entities.BookingContract.create(data);
      setContracts(prev => [...prev, created].sort((a, b) => new Date(a.show_date) - new Date(b.show_date)));
      toast.success("Booking confirmed! ✅");
    } else {
      await base44.entities.BookingContract.update(editing, data);
      setContracts(prev => prev.map(c => c.id === editing ? { ...c, ...data } : c));
      toast.success("Booking updated!");
    }
    setEditing(null);
    setSaving(false);
  };

  const handleDelete = async (id) => {
    await base44.entities.BookingContract.delete(id);
    setContracts(prev => prev.filter(c => c.id !== id));
    toast.success("Booking removed");
  };

  const markStatus = async (id, status) => {
    await base44.entities.BookingContract.update(id, { status });
    setContracts(prev => prev.map(c => c.id === id ? { ...c, status } : c));
  };

  const saveHomeAddress = async () => {
    if (!homeAddress.trim()) { toast.error("Please enter your home address"); return; }
    setSavingHome(true);
    await base44.entities.Artist.update(artist.id, { home_address: homeAddress });
    setArtist(a => ({ ...a, home_address: homeAddress }));
    toast.success("Home base saved!");
    setSavingHome(false);
  };

  const generateAIPlan = async () => {
    const upcoming = contracts.filter(c => c.status === "confirmed" && new Date(c.show_date) >= new Date());
    if (upcoming.length === 0) { toast.error("No confirmed upcoming shows to plan"); return; }
    setGeneratingPlan(true);
    setAiPlan(null);
    const showList = upcoming.map((c, i) =>
      `Show ${i + 1}: "${c.event_name}" at ${c.venue || "TBA"}, ${c.city || ""}${c.country ? ", " + c.country : ""} — Date: ${format(new Date(c.show_date), "EEEE, MMM d yyyy")}${c.soundcheck_time ? `, Soundcheck: ${c.soundcheck_time}` : ""}${c.performance_time ? `, Performance: ${c.performance_time}` : ""}${c.hotel_name ? `, Hotel: ${c.hotel_name} (${c.hotel_address || ""})` : ""}`
    ).join("\n");

    const prompt = `You are a professional music industry booking agent and tour manager. 

The artist's home base is: ${homeAddress || "not specified (assume they start from home)"}

Here are their upcoming confirmed shows in chronological order:
${showList}

Please create a comprehensive, practical travel and schedule plan that includes:
1. **Overall Tour Overview** — total shows, date range, key cities
2. **Show-by-Show Itinerary** — for each show: recommended travel day, transport mode (flight/drive/train), arrival time, hotel check-in, soundcheck, performance, departure
3. **Travel Between Shows** — estimated travel time/distance between each city, recommended transport (flight if >4h drive, otherwise drive/train)
4. **Practical Tips** — packing essentials, recommended check-in times, any same-day travel warnings
5. **Days Off / Rest Days** — identify any gaps between shows for rest or travel

Be specific, practical, and professional. Format clearly with headers and bullet points.`;

    const result = await base44.integrations.Core.InvokeLLM({ prompt });
    setAiPlan(result);
    setGeneratingPlan(false);
  };

  const generateShowPlan = async (contract) => {
    setGeneratingPlan(contract.id);
    const prevShow = contracts
      .filter(c => c.status === "confirmed" && new Date(c.show_date) < new Date(contract.show_date))
      .sort((a, b) => new Date(b.show_date) - new Date(a.show_date))[0];

    const origin = prevShow
      ? `${prevShow.city}${prevShow.country ? ", " + prevShow.country : ""} (previous show: ${prevShow.event_name} on ${format(new Date(prevShow.show_date), "MMM d")})`
      : (homeAddress || "home base (address not set)");

    const prompt = `You are a professional tour manager. Plan the travel for ONE show:

**Show:** "${contract.event_name}"
**Venue:** ${contract.venue || "TBA"}, ${contract.city || ""}${contract.country ? ", " + contract.country : ""}
**Date:** ${format(new Date(contract.show_date), "EEEE, MMMM d yyyy")}
${contract.soundcheck_time ? `**Soundcheck:** ${contract.soundcheck_time}` : ""}
${contract.performance_time ? `**Performance time:** ${contract.performance_time}` : ""}
${contract.hotel_name ? `**Hotel:** ${contract.hotel_name}, ${contract.hotel_address || ""}` : ""}

**Travelling from:** ${origin}

Provide:
1. Recommended travel day and departure time
2. Best transport option (flight/drive/train) with estimated journey time
3. Hotel check-in recommendation
4. Day-of-show schedule (arrival at venue, soundcheck, performance, wrap-up)
5. Any warnings or tips for this specific journey

Be concise, specific, and practical.`;

    const result = await base44.integrations.Core.InvokeLLM({ prompt });
    await base44.entities.BookingContract.update(contract.id, { ai_travel_plan: result });
    setContracts(prev => prev.map(c => c.id === contract.id ? { ...c, ai_travel_plan: result } : c));
    setExpanded(contract.id);
    setGeneratingPlan(null);
    toast.success("AI travel plan generated!");
  };

  const now = new Date();
  const upcoming = contracts.filter(c => new Date(c.show_date) >= now && c.status !== "cancelled").sort((a, b) => new Date(a.show_date) - new Date(b.show_date));
  const past = contracts.filter(c => new Date(c.show_date) < now || c.status === "cancelled").sort((a, b) => new Date(b.show_date) - new Date(a.show_date));
  const displayed = activeTab === "upcoming" ? upcoming : past;

  const totalEarnings = contracts.filter(c => c.status === "confirmed" || c.status === "completed").reduce((s, c) => s + (c.fee || 0), 0);

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;
  if (!artist) return <div className="text-center py-20 text-muted-foreground">No artist profile found.</div>;

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display font-black text-3xl tracking-tight flex items-center gap-2">
            <Briefcase className="w-7 h-7 text-primary" /> BOOKING AGENCY
          </h1>
          <p className="text-sm text-muted-foreground font-mono mt-0.5">AI-powered tour management & travel planning</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="text-right">
            <p className="font-mono text-[10px] text-muted-foreground uppercase">Confirmed Income</p>
            <p className="font-display font-black text-lg text-green-400">${totalEarnings.toLocaleString()}</p>
          </div>
          {!editing && (
            <Button onClick={startNew} className="glow-lime font-display font-bold gap-2">
              <Plus className="w-4 h-4" /> Add Booking
            </Button>
          )}
        </div>
      </div>

      {/* Home Base */}
      <div className="p-4 rounded-xl bg-card border border-border/50 space-y-3">
        <div className="flex items-center gap-2">
          <Home className="w-4 h-4 text-accent" />
          <h2 className="font-display font-bold">Home Base Address</h2>
          <span className="text-xs font-mono text-muted-foreground">— used by AI to plan travel from home between shows</span>
        </div>
        <div className="flex gap-3">
          <Input value={homeAddress} onChange={e => setHomeAddress(e.target.value)}
            placeholder="e.g. 123 Main St, Los Angeles, CA 90001, USA"
            className="flex-1 bg-secondary border-border/50" />
          <Button onClick={saveHomeAddress} disabled={savingHome} variant="outline" className="font-display font-bold shrink-0">
            {savingHome ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      {/* AI Full Tour Plan */}
      {upcoming.length >= 2 && (
        <div className="p-4 rounded-xl bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              <div>
                <p className="font-display font-bold">AI Full Tour Planner</p>
                <p className="text-xs text-muted-foreground font-mono">Generate an optimised travel schedule for all {upcoming.length} upcoming shows</p>
              </div>
            </div>
            <Button onClick={generateAIPlan} disabled={generatingPlan === true}
              className="glow-lime font-display font-bold gap-2">
              <Sparkles className="w-4 h-4" />
              {generatingPlan === true ? "Planning your tour..." : "Generate Tour Plan"}
            </Button>
          </div>
          {aiPlan && (
            <div className="mt-3 p-4 rounded-lg bg-background/60 border border-border/50">
              <div className="flex items-center justify-between mb-2">
                <p className="font-display font-bold text-sm flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5 text-primary" /> AI Tour Plan</p>
                <button onClick={() => setAiPlan(null)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
              </div>
              <pre className="text-sm text-foreground/90 whitespace-pre-wrap font-mono leading-relaxed overflow-auto max-h-96">{aiPlan}</pre>
            </div>
          )}
        </div>
      )}

      {/* Add/Edit Form */}
      {editing && (
        <div className="p-5 rounded-xl bg-card border border-primary/20 space-y-4">
          <h3 className="font-display font-bold text-lg">{editing === "new" ? "✅ Confirm New Booking" : "Edit Booking"}</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label className="text-xs font-mono text-muted-foreground">Event / Show Name *</Label>
              <Input value={form.event_name} onChange={e => setForm({ ...form, event_name: e.target.value })}
                placeholder="e.g. Summer Rave 2025, Club XYZ Residency" className="mt-1 bg-secondary border-border/50" />
            </div>
            <div>
              <Label className="text-xs font-mono text-muted-foreground">Venue</Label>
              <Input value={form.venue} onChange={e => setForm({ ...form, venue: e.target.value })}
                placeholder="Venue name" className="mt-1 bg-secondary border-border/50" />
            </div>
            <div>
              <Label className="text-xs font-mono text-muted-foreground">City</Label>
              <Input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })}
                placeholder="City" className="mt-1 bg-secondary border-border/50" />
            </div>
            <div>
              <Label className="text-xs font-mono text-muted-foreground">Country</Label>
              <Input value={form.country} onChange={e => setForm({ ...form, country: e.target.value })}
                placeholder="Country" className="mt-1 bg-secondary border-border/50" />
            </div>
            <div>
              <Label className="text-xs font-mono text-muted-foreground">Show Date & Time *</Label>
              <Input type="datetime-local" value={form.show_date} onChange={e => setForm({ ...form, show_date: e.target.value })}
                className="mt-1 bg-secondary border-border/50" />
            </div>
            <div>
              <Label className="text-xs font-mono text-muted-foreground">Soundcheck Time</Label>
              <Input type="time" value={form.soundcheck_time} onChange={e => setForm({ ...form, soundcheck_time: e.target.value })}
                className="mt-1 bg-secondary border-border/50" />
            </div>
            <div>
              <Label className="text-xs font-mono text-muted-foreground">Performance Time</Label>
              <Input type="time" value={form.performance_time} onChange={e => setForm({ ...form, performance_time: e.target.value })}
                className="mt-1 bg-secondary border-border/50" />
            </div>
            <div>
              <Label className="text-xs font-mono text-muted-foreground">Booking Fee ($)</Label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono">$</span>
                <Input type="number" min="0" value={form.fee} onChange={e => setForm({ ...form, fee: e.target.value })}
                  placeholder="0" className="pl-7 bg-secondary border-border/50" />
              </div>
            </div>
            <div className="col-span-2 border-t border-border/30 pt-3">
              <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2">Booker / Promoter Details</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs font-mono text-muted-foreground">Name</Label>
                  <Input value={form.booker_name} onChange={e => setForm({ ...form, booker_name: e.target.value })}
                    placeholder="Booker name" className="mt-1 bg-secondary border-border/50 text-sm" />
                </div>
                <div>
                  <Label className="text-xs font-mono text-muted-foreground">Email</Label>
                  <Input value={form.booker_email} onChange={e => setForm({ ...form, booker_email: e.target.value })}
                    placeholder="booker@email.com" className="mt-1 bg-secondary border-border/50 text-sm" />
                </div>
                <div>
                  <Label className="text-xs font-mono text-muted-foreground">Phone</Label>
                  <Input value={form.booker_phone} onChange={e => setForm({ ...form, booker_phone: e.target.value })}
                    placeholder="+1 555..." className="mt-1 bg-secondary border-border/50 text-sm" />
                </div>
              </div>
            </div>
            <div className="col-span-2 border-t border-border/30 pt-3">
              <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2">Accommodation</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-mono text-muted-foreground">Hotel Name</Label>
                  <Input value={form.hotel_name} onChange={e => setForm({ ...form, hotel_name: e.target.value })}
                    placeholder="Hotel name" className="mt-1 bg-secondary border-border/50 text-sm" />
                </div>
                <div>
                  <Label className="text-xs font-mono text-muted-foreground">Hotel Address</Label>
                  <Input value={form.hotel_address} onChange={e => setForm({ ...form, hotel_address: e.target.value })}
                    placeholder="Full address" className="mt-1 bg-secondary border-border/50 text-sm" />
                </div>
              </div>
            </div>
            <div className="col-span-2">
              <Label className="text-xs font-mono text-muted-foreground">Contract Notes / Rider</Label>
              <Input value={form.contract_notes} onChange={e => setForm({ ...form, contract_notes: e.target.value })}
                placeholder="e.g. 2x round-trip flights included, hospitality rider, etc." className="mt-1 bg-secondary border-border/50" />
            </div>
            <div className="col-span-2">
              <Label className="text-xs font-mono text-muted-foreground">Contract File (PDF / Image)</Label>
              {form.contract_file_url ? (
                <div className="mt-1 flex items-center gap-2 p-2 rounded-lg bg-green-400/10 border border-green-400/20">
                  <FileText className="w-4 h-4 text-green-400 shrink-0" />
                  <a href={form.contract_file_url} target="_blank" rel="noopener noreferrer" className="text-xs font-mono text-green-400 flex-1 hover:underline truncate">Contract uploaded — click to view</a>
                  <button onClick={() => setForm({ ...form, contract_file_url: "" })}><X className="w-3.5 h-3.5 text-muted-foreground" /></button>
                </div>
              ) : (
                <label className="mt-1 flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary border border-dashed border-border/50 text-muted-foreground text-sm cursor-pointer hover:border-primary/40 transition-colors w-fit">
                  <Upload className="w-4 h-4" />
                  {uploading ? "Uploading..." : "Upload Contract"}
                  <input type="file" accept=".pdf,image/*" className="hidden" onChange={handleContractUpload} disabled={uploading} />
                </label>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={saving} className="glow-lime font-display font-bold gap-2">
              <CheckCircle2 className="w-4 h-4" />
              {saving ? "Saving..." : editing === "new" ? "Confirm Booking" : "Update Booking"}
            </Button>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Upcoming Shows", value: upcoming.length, color: "text-primary" },
          { label: "Completed", value: contracts.filter(c => c.status === "completed").length, color: "text-green-400" },
          { label: "Total Booked", value: contracts.filter(c => c.status !== "cancelled").length, color: "text-foreground" },
        ].map(s => (
          <div key={s.label} className="p-3 rounded-xl bg-card border border-border/50 text-center">
            <p className={`font-display font-black text-2xl ${s.color}`}>{s.value}</p>
            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex rounded-lg border border-border/50 overflow-hidden w-fit">
        {["upcoming", "past"].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-mono font-bold capitalize transition-all ${activeTab === tab ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted"}`}>
            {tab} {tab === "upcoming" ? `(${upcoming.length})` : `(${past.length})`}
          </button>
        ))}
      </div>

      {/* Bookings list */}
      <div className="space-y-3">
        {displayed.length === 0 ? (
          <div className="text-center py-16 bg-card rounded-xl border border-border/50">
            <Briefcase className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">{activeTab === "upcoming" ? "No upcoming shows. Add your first booking!" : "No past shows yet."}</p>
          </div>
        ) : displayed.map(contract => (
          <div key={contract.id} className={`rounded-xl bg-card border overflow-hidden ${STATUS_COLOR[contract.status]?.includes("border") ? "" : "border-border/50"}`}>
            {/* Show header */}
            <div className="flex items-start gap-3 p-4">
              {/* Date block */}
              <div className="shrink-0 w-14 text-center">
                <div className="rounded-lg bg-primary/10 border border-primary/20 p-2">
                  <p className="font-mono text-[10px] text-primary uppercase font-bold">{format(new Date(contract.show_date), "MMM")}</p>
                  <p className="font-display font-black text-2xl text-primary leading-none">{format(new Date(contract.show_date), "d")}</p>
                  <p className="font-mono text-[10px] text-muted-foreground">{format(new Date(contract.show_date), "EEE")}</p>
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div>
                    <p className="font-display font-bold text-base">{contract.event_name}</p>
                    {(contract.venue || contract.city) && (
                      <p className="flex items-center gap-1 text-sm text-muted-foreground mt-0.5">
                        <MapPin className="w-3 h-3 shrink-0" />
                        {[contract.venue, contract.city, contract.country].filter(Boolean).join(", ")}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-2 mt-1">
                      {contract.performance_time && (
                        <span className="flex items-center gap-1 text-xs font-mono text-muted-foreground">
                          <Clock className="w-3 h-3" /> {contract.performance_time}
                        </span>
                      )}
                      {contract.fee > 0 && (
                        <span className="flex items-center gap-1 text-xs font-mono text-green-400 font-bold">
                          <DollarSign className="w-3 h-3" /> ${contract.fee.toLocaleString()}
                        </span>
                      )}
                      <span className={`font-mono text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${STATUS_COLOR[contract.status]}`}>
                        {contract.status}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {/* AI travel plan button */}
                    {contract.status === "confirmed" && activeTab === "upcoming" && (
                      <button
                        onClick={() => generateShowPlan(contract)}
                        disabled={generatingPlan === contract.id}
                        title="Generate AI travel plan"
                        className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-primary text-xs font-display font-bold hover:bg-primary/20 transition-colors">
                        <Sparkles className="w-3.5 h-3.5" />
                        {generatingPlan === contract.id ? "..." : "AI Plan"}
                      </button>
                    )}
                    <button onClick={() => setExpanded(expanded === contract.id ? null : contract.id)}
                      className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground">
                      {expanded === contract.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    <button onClick={() => startEdit(contract)} className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground"><Edit2 className="w-4 h-4" /></button>
                    <button onClick={() => handleDelete(contract.id)} className="p-1.5 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-destructive"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              </div>
            </div>

            {/* Expanded detail */}
            {expanded === contract.id && (
              <div className="border-t border-border/30 p-4 space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  {/* Booker info */}
                  {(contract.booker_name || contract.booker_email || contract.booker_phone) && (
                    <div className="space-y-1">
                      <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Booker / Promoter</p>
                      {contract.booker_name && <p className="text-sm font-bold">{contract.booker_name}</p>}
                      {contract.booker_email && (
                        <a href={`mailto:${contract.booker_email}`} className="flex items-center gap-1.5 text-xs text-accent hover:underline">
                          <Mail className="w-3 h-3" /> {contract.booker_email}
                        </a>
                      )}
                      {contract.booker_phone && (
                        <a href={`tel:${contract.booker_phone}`} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
                          <Phone className="w-3 h-3" /> {contract.booker_phone}
                        </a>
                      )}
                    </div>
                  )}
                  {/* Hotel */}
                  {(contract.hotel_name || contract.hotel_address) && (
                    <div className="space-y-1">
                      <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Accommodation</p>
                      {contract.hotel_name && <p className="text-sm font-bold">{contract.hotel_name}</p>}
                      {contract.hotel_address && <p className="text-xs text-muted-foreground">{contract.hotel_address}</p>}
                    </div>
                  )}
                  {/* Soundcheck */}
                  {contract.soundcheck_time && (
                    <div>
                      <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Soundcheck</p>
                      <p className="text-sm font-bold mt-0.5">{contract.soundcheck_time}</p>
                    </div>
                  )}
                  {/* Contract notes */}
                  {contract.contract_notes && (
                    <div>
                      <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Contract Notes</p>
                      <p className="text-sm text-muted-foreground mt-0.5">{contract.contract_notes}</p>
                    </div>
                  )}
                </div>

                {/* Contract file */}
                {contract.contract_file_url && (
                  <a href={contract.contract_file_url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted border border-border/50 text-sm font-mono hover:border-primary/40 transition-colors w-fit">
                    <FileText className="w-4 h-4 text-primary" /> View Contract
                  </a>
                )}

                {/* AI Travel Plan */}
                {contract.ai_travel_plan && (
                  <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles className="w-4 h-4 text-primary" />
                      <p className="font-display font-bold text-sm">AI Travel Plan</p>
                    </div>
                    <pre className="text-xs text-foreground/80 whitespace-pre-wrap font-mono leading-relaxed overflow-auto max-h-64">{contract.ai_travel_plan}</pre>
                    <button onClick={() => generateShowPlan(contract)} disabled={generatingPlan === contract.id}
                      className="mt-3 text-xs font-mono text-primary hover:underline flex items-center gap-1">
                      <Sparkles className="w-3 h-3" /> {generatingPlan === contract.id ? "Regenerating..." : "Regenerate plan"}
                    </button>
                  </div>
                )}

                {/* Status actions */}
                <div className="flex gap-2 flex-wrap pt-1 border-t border-border/20">
                  {contract.status === "confirmed" && <button onClick={() => markStatus(contract.id, "completed")} className="text-xs font-mono text-green-400 hover:underline">✅ Mark Completed</button>}
                  {contract.status !== "cancelled" && <button onClick={() => markStatus(contract.id, "cancelled")} className="text-xs font-mono text-destructive hover:underline">Cancel</button>}
                  {contract.status === "cancelled" && <button onClick={() => markStatus(contract.id, "confirmed")} className="text-xs font-mono text-accent hover:underline">Restore</button>}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}