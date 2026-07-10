import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Percent, DollarSign, Edit2, Plus, Search, X, Info, Trash2, Clock } from "lucide-react";
import { format } from "date-fns";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

const FEE_BREAKDOWN = [
  { range: "$0 – $50 ticket sale", fee: "$1.00" },
  { range: "$51 – $100 ticket sale", fee: "$1.50" },
  { range: "$101 – $250 ticket sale", fee: "$2.00" },
  { range: "$251 – $500 ticket sale", fee: "$3.00" },
  { range: "$501 – $1,000 ticket sale", fee: "$5.00" },
  { range: "Table sales (any price)", fee: "$10.00" },
];

export default function AdminOrganizerFees() {
  const [organizers, setOrganizers] = useState([]);
  const [feeSettings, setFeeSettings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [feeInfoOpen, setFeeInfoOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ organizer_id: "", organizer_email: "", organizer_name: "", platform_fee_pct: 10, platform_fee_fixed: 0, notes: "" });
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [orgSearch, setOrgSearch] = useState("");
  const [orgDropOpen, setOrgDropOpen] = useState(false);
  const orgDropRef = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (orgDropRef.current && !orgDropRef.current.contains(e.target)) setOrgDropOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const [users, fees] = await Promise.all([
      base44.entities.User.list(null, 500),
      base44.entities.OrganizerFeeSettings.list(null, 200),
    ]);
    setOrganizers(users.filter((u) => u.role === "organizer"));
    setFeeSettings(fees);
    setLoading(false);
  }

  function openNew() {
    setEditing(null);
    setForm({ organizer_id: "", organizer_email: "", organizer_name: "", platform_fee_pct: "", platform_fee_fixed: "", notes: "" });
    setOrgSearch("");
    setOrgDropOpen(false);
    setOpen(true);
  }

  function openEdit(fee) {
    setEditing(fee);
    setForm({ ...fee });
    setOpen(true);
  }

  function pickOrganizer(userId) {
    const org = organizers.find((u) => u.id === userId);
    if (org) setForm((f) => ({ ...f, organizer_id: org.id, organizer_email: org.email, organizer_name: org.full_name }));
  }

  async function deleteFee(id) {
    await base44.entities.OrganizerFeeSettings.delete(id);
    setFeeSettings(prev => prev.filter(f => f.id !== id));
    setConfirmDeleteId(null);
    toast.success("Fee setting deleted");
  }

  async function save() {
    if (!form.organizer_id) return toast.error("Select an organizer");
    setSaving(true);
    if (editing) {
      await base44.entities.OrganizerFeeSettings.update(editing.id, form);
      toast.success("Fee settings updated");
    } else {
      // Check no duplicate
      const existing = feeSettings.find((f) => f.organizer_id === form.organizer_id);
      if (existing) {
        await base44.entities.OrganizerFeeSettings.update(existing.id, form);
        toast.success("Fee settings updated");
      } else {
        await base44.entities.OrganizerFeeSettings.create(form);
        toast.success("Fee settings created");
      }
    }
    setOpen(false);
    setSaving(false);
    load();
  }

  // Build map for quick lookup
  const feeMap = Object.fromEntries(feeSettings.map((f) => [f.organizer_id, f]));

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h1 className="font-display font-black text-2xl tracking-tight">ORGANIZER FEE SETTINGS</h1>
          <button
            onClick={() => setFeeInfoOpen(true)}
            className="mt-1 inline-flex items-center gap-1.5 text-sm text-primary hover:underline font-medium"
          >
            <Info className="w-3.5 h-3.5" /> Click here to see platform fee schedule
          </button>
        </div>
        <Button onClick={openNew} className="gap-2 glow-lime shrink-0">
          <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Set Custom Fee</span><span className="sm:hidden">Add Fee</span>
        </Button>
      </div>

      <div className="grid gap-4">
        {organizers.map((org) => {
          const fee = feeMap[org.id];
          const isCustom = !!fee;
          return (
            <div key={org.id} className="p-4 sm:p-5 rounded-lg bg-card border border-border/50">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <p className="font-bold truncate">{org.full_name}</p>
                  <p className="text-sm text-muted-foreground font-mono truncate">{org.email}</p>
                  {fee?.notes && <p className="text-xs text-muted-foreground mt-1 italic">{fee.notes}</p>}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {isCustom ? (
                    <div className="text-right space-y-1 min-w-[80px]">
                      <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Current Fee</p>
                      <div className="flex items-center justify-end gap-1 flex-wrap">
                        <span className="text-primary font-mono font-bold text-base sm:text-lg">{fee.platform_fee_pct}%</span>
                        {(fee.platform_fee_fixed > 0) && (
                          <>
                            <span className="text-muted-foreground text-xs">+</span>
                            <span className="text-accent font-mono font-bold text-base sm:text-lg">${fee.platform_fee_fixed?.toFixed(2)}</span>
                          </>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground font-mono">
                        {fee.platform_fee_pct != null && fee.platform_fee_pct !== '' ? `${fee.platform_fee_pct}% platform` : ''}
                        {fee.platform_fee_pct != null && fee.platform_fee_pct !== '' && fee.platform_fee_fixed > 0 ? ' + ' : ''}
                        {fee.platform_fee_fixed > 0 ? `$${fee.platform_fee_fixed?.toFixed(2)}/ticket` : ''}
                      </p>
                      {fee.updated_date && (
                        <p className="text-[9px] text-muted-foreground/60 font-mono flex items-center justify-end gap-1">
                          <Clock className="w-2.5 h-2.5" /> {format(new Date(fee.updated_date), 'MMM d, yyyy')}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="text-center min-w-[80px]">
                      <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Current Fee</p>
                      <p className="text-sm font-semibold text-muted-foreground">Default Schedule</p>
                      <p className="text-[10px] text-muted-foreground font-mono">No custom fee set</p>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    {isCustom && (
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded border uppercase tracking-widest bg-primary/10 text-primary border-primary/30 hidden sm:inline-block">
                        Custom
                      </span>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => fee ? openEdit(fee) : (() => { setForm({ organizer_id: org.id, organizer_email: org.email, organizer_name: org.full_name, platform_fee_pct: "", platform_fee_fixed: "", notes: "" }); setEditing(null); setOpen(true); })()}>
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    {isCustom ? (
                      <button
                        onClick={() => setConfirmDeleteId(fee.id)}
                        className="p-2 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        title="Delete fee setting"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    ) : (
                      <button disabled className="p-2 rounded-md text-muted-foreground/20 cursor-not-allowed" title="No custom fee to delete">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {organizers.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-12">No organizers found. Invite organizers first.</p>
        )}
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={!!confirmDeleteId} onOpenChange={(o) => { if (!o) setConfirmDeleteId(null); }}>
        <AlertDialogContent className="bg-card border-border z-[200]">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display font-black">Delete Fee Setting?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the custom fee setting. The organizer will revert to the default platform fee schedule. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteFee(confirmDeleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Fee Breakdown Modal */}
      <Dialog open={feeInfoOpen} onOpenChange={setFeeInfoOpen}>
        <DialogContent className="max-w-sm w-[calc(100vw-2rem)] bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-display font-black text-lg">Platform Fee Breakdown</DialogTitle>
          </DialogHeader>
          <div className="pt-2 space-y-1.5">
            {FEE_BREAKDOWN.map(({ range, fee }) => (
              <div key={range} className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-secondary border border-border/40">
                <span className="text-sm text-muted-foreground">{range}</span>
                <span className="font-mono font-bold text-primary">{fee}</span>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md w-[calc(100vw-2rem)] bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-display font-black text-xl tracking-tight">
              {editing ? "Edit Fee Settings" : "Set Custom Fee"}
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-1">Leave fields empty to use the default platform fee schedule</p>
          </DialogHeader>
          <div className="space-y-5 pt-3">
            {/* CREATE: searchable organizer dropdown */}
            {!editing ? (
              <div className="space-y-2">
                <Label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Select Organizer</Label>
                <div className="relative" ref={orgDropRef}>
                  <button
                    type="button"
                    onClick={() => setOrgDropOpen(o => !o)}
                    className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm text-left"
                  >
                    <span className={form.organizer_id ? "text-foreground" : "text-muted-foreground"}>
                      {form.organizer_id ? `${form.organizer_name} (${form.organizer_email})` : "Search and select an organizer..."}
                    </span>
                    <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  </button>
                  {orgDropOpen && (
                    <div className="absolute top-full left-0 right-0 z-30 mt-1 rounded-md bg-card border border-border/60 shadow-lg overflow-hidden">
                      <div className="p-2 border-b border-border/40">
                        <div className="relative">
                          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                          <input
                            autoFocus
                            value={orgSearch}
                            onChange={e => setOrgSearch(e.target.value)}
                            placeholder="Type name or email..."
                            className="w-full bg-secondary border border-border/50 rounded px-2 py-1.5 pl-7 text-sm outline-none"
                          />
                          {orgSearch && <button onClick={() => setOrgSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"><X className="w-3 h-3" /></button>}
                        </div>
                      </div>
                      <div className="max-h-48 overflow-y-auto">
                        {organizers
                          .filter(o => !orgSearch || o.full_name?.toLowerCase().includes(orgSearch.toLowerCase()) || o.email?.toLowerCase().includes(orgSearch.toLowerCase()))
                          .map(o => (
                            <button
                              key={o.id}
                              type="button"
                              onMouseDown={() => { pickOrganizer(o.id); setOrgDropOpen(false); setOrgSearch(""); }}
                              className={`w-full text-left px-3 py-2.5 text-sm hover:bg-muted transition-colors ${form.organizer_id === o.id ? "bg-primary/10 text-primary" : ""}`}
                            >
                              <span className="font-medium">{o.full_name || "—"}</span>
                              <span className="text-xs text-muted-foreground ml-2">{o.email}</span>
                            </button>
                          ))}
                        {organizers.filter(o => !orgSearch || o.full_name?.toLowerCase().includes(orgSearch.toLowerCase()) || o.email?.toLowerCase().includes(orgSearch.toLowerCase())).length === 0 && (
                          <p className="px-3 py-2 text-xs text-muted-foreground">No organizers found</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* EDIT: read-only organizer info */
              <div className="p-4 rounded-lg bg-secondary border border-border/50">
                <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1.5">Organizer</p>
                <p className="font-bold text-sm">{form.organizer_name || "—"}</p>
                <p className="text-xs font-mono text-muted-foreground mt-0.5">{form.organizer_email}</p>
              </div>
            )}

            {/* Current fee summary — only shown when editing */}
            {editing && (
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 space-y-1.5">
                <p className="text-[10px] font-mono text-primary uppercase tracking-widest">Current Fee Agreement</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-primary font-mono font-bold text-lg">{editing.platform_fee_pct != null && editing.platform_fee_pct !== '' ? `${editing.platform_fee_pct}%` : '—%'}</span>
                  {editing.platform_fee_fixed > 0 && (
                    <>
                      <span className="text-muted-foreground text-xs">+</span>
                      <span className="text-accent font-mono font-bold text-lg">${editing.platform_fee_fixed?.toFixed(2)}</span>
                      <span className="text-muted-foreground text-[10px]">/ticket</span>
                    </>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground font-mono">
                  {editing.platform_fee_pct != null && editing.platform_fee_pct !== '' ? `${editing.platform_fee_pct}% platform fee` : ''}
                  {editing.platform_fee_pct != null && editing.platform_fee_pct !== '' && editing.platform_fee_fixed > 0 ? ' + ' : ''}
                  {editing.platform_fee_fixed > 0 ? `$${editing.platform_fee_fixed?.toFixed(2)} per ticket` : ''}
                  {(!editing.platform_fee_pct || editing.platform_fee_pct === '') && !editing.platform_fee_fixed ? 'No custom fee — default schedule applies' : ''}
                </p>
                {editing.notes && <p className="text-[10px] text-muted-foreground italic mt-0.5">"{editing.notes}"</p>}
              </div>
            )}
            <div className="space-y-3 p-3 rounded-lg bg-secondary border border-border/40">
               <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Override with Custom Fee (Optional)</p>
               <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-2">
                   <Label className="flex items-center gap-1.5 text-sm font-medium">
                     <Percent className="w-3.5 h-3.5" /> Percentage
                   </Label>
                   <input
                     type="text"
                     inputMode="decimal"
                     placeholder="Leave empty for default"
                     value={form.platform_fee_pct === "" ? "" : String(form.platform_fee_pct)}
                     onFocus={e => e.target.select()}
                     onChange={e => {
                       const v = e.target.value;
                       if (v === "" || /^\d*\.?\d*$/.test(v)) setForm(f => ({ ...f, platform_fee_pct: v }));
                     }}
                     onBlur={e => {
                       const parsed = parseFloat(e.target.value);
                       if (e.target.value === "") {
                         setForm(f => ({ ...f, platform_fee_pct: "" }));
                       } else {
                         setForm(f => ({ ...f, platform_fee_pct: isNaN(parsed) ? "" : Math.min(100, parsed) }));
                       }
                     }}
                     className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring focus:border-primary"
                   />
                   <p className="text-[11px] text-muted-foreground font-mono">% of ticket subtotal</p>
                 </div>
                 <div className="space-y-2">
                   <Label className="flex items-center gap-1.5 text-sm font-medium">
                     <DollarSign className="w-3.5 h-3.5" /> Per-Ticket Fee
                   </Label>
                   <input
                     type="text"
                     inputMode="decimal"
                     placeholder="Leave empty for default"
                     value={form.platform_fee_fixed === "" ? "" : String(form.platform_fee_fixed)}
                     onFocus={e => e.target.select()}
                     onChange={e => {
                       const v = e.target.value;
                       if (v === "" || /^\d*\.?\d*$/.test(v)) setForm(f => ({ ...f, platform_fee_fixed: v }));
                     }}
                     onBlur={e => {
                       const parsed = parseFloat(e.target.value);
                       if (e.target.value === "") {
                         setForm(f => ({ ...f, platform_fee_fixed: "" }));
                       } else {
                         setForm(f => ({ ...f, platform_fee_fixed: isNaN(parsed) ? "" : parsed }));
                       }
                     }}
                     className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring focus:border-primary"
                   />
                   <p className="text-[11px] text-muted-foreground font-mono">$ added per ticket</p>
                 </div>
               </div>
             </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Notes <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Input
                placeholder="e.g. Special rate for VIP partner"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                className="bg-background border-border/50 h-10"
              />
            </div>

            <div className="flex gap-3 pt-1">
              <Button className="flex-1 glow-lime" onClick={save} disabled={saving}>
                {saving ? "Saving..." : "Save Fee Settings"}
              </Button>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}