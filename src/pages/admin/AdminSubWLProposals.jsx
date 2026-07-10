import { useState, useEffect, useRef } from "react";
import { Check, X, RefreshCw, ChevronDown, LayoutDashboard, Clock, CheckCircle, History, Trash2, Building2, Mail, Calendar, AlertTriangle } from "lucide-react";
import BulkActionBar from "@/components/shared/BulkActionBar";
import { Button } from "@/components/ui/button";
import StatCard from "../../components/shared/StatCard";
import SubWLDetailModal from "../../components/admin/SubWLDetailModal";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { format } from "date-fns";

const STATUS_STYLE = {
  pending:   { label: "Pending",   color: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30" },
  accepted:  { label: "Accepted",  color: "text-green-400 bg-green-400/10 border-green-400/30" },
  agreed:    { label: "Agreed",    color: "text-green-400 bg-green-400/10 border-green-400/30" },
  refused:   { label: "Refused",   color: "text-destructive bg-destructive/10 border-destructive/30" },
  countered: { label: "Countered", color: "text-accent bg-accent/10 border-accent/30" },
};

const SECTIONS = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "pending",  label: "Pending",  icon: Clock },
  { key: "history",  label: "History",  icon: History },
];

export default function AdminSubWLProposals() {
  const [proposals, setProposals] = useState([]);
  const [whiteLabelMap, setWhiteLabelMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState("overview");
  const [menuOpen, setMenuOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [detailProposal, setDetailProposal] = useState(null);
  const menuRef = useRef(null);

  const toggleSelect = (id) => setSelectedIds(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const bulkDelete = async () => {
    const ids = [...selectedIds];
    await Promise.all(ids.map(id => base44.entities.WhiteLabelFeeProposal.delete(id).catch(() => {})));
    setProposals(prev => prev.filter(p => !ids.includes(p.id)));
    setSelectedIds(new Set());
    setConfirmBulkDelete(false);
    toast.success(`${ids.length} proposal${ids.length !== 1 ? "s" : ""} deleted`);
  };

  const deleteProposal = async (id) => {
    await base44.entities.WhiteLabelFeeProposal.delete(id).catch(() => {});
    setProposals(prev => prev.filter(p => p.id !== id));
    setConfirmDelete(null);
    toast.success("Deleted.");
  };

  useEffect(() => {
    const h = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    const [data, whiteLabels] = await Promise.all([
      base44.entities.WhiteLabelFeeProposal.list("-created_date", 200),
      base44.entities.WhiteLabel.list(null, 200).catch(() => []),
    ]);
    const wlMap = {};
    whiteLabels.forEach(wl => { wlMap[wl.id] = wl; });
    const wlIds = new Set(whiteLabels.map(wl => wl.id));
    const valid = data.filter(p => p.parent_wl_id && wlIds.has(p.parent_wl_id));
    const orphans = data.filter(p => !p.parent_wl_id || !wlIds.has(p.parent_wl_id));
    await Promise.all(orphans.map(p => base44.entities.WhiteLabelFeeProposal.delete(p.id).catch(() => {})));
    setWhiteLabelMap(wlMap);
    setProposals(valid);
    setLoading(false);
  };

  const activeSection = SECTIONS.find(s => s.key === section);
  const pending = proposals.filter(p => p.status === "pending");
  const rest = proposals.filter(p => p.status !== "pending");

  if (loading) return (
    <div className="flex justify-center py-20">
      <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Detail Modal */}
      {detailProposal && (
        <SubWLDetailModal
          proposal={detailProposal}
          parentWL={whiteLabelMap[detailProposal.parent_wl_id] || null}
          onClose={() => setDetailProposal(null)}
          onUpdate={(updated) => {
            setProposals(prev => prev.map(p => p.id === updated.id ? updated : p));
            setDetailProposal(updated);
          }}
          onDelete={(id) => {
            setProposals(prev => prev.filter(p => p.id !== id));
            setDetailProposal(null);
          }}
        />
      )}

      {/* Bulk Delete Confirmation */}
      {confirmBulkDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-card border border-border/80 rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <p className="font-display font-bold text-base">Delete {selectedIds.size} Proposal{selectedIds.size !== 1 ? "s" : ""}?</p>
            <p className="text-sm text-muted-foreground">This action cannot be undone.</p>
            <div className="flex gap-2">
              <button className="flex-1 px-4 py-2 rounded-lg border border-border/50 text-sm font-mono font-medium hover:bg-muted transition-colors" onClick={() => setConfirmBulkDelete(false)}>Cancel</button>
              <button className="flex-1 px-4 py-2 rounded-lg bg-destructive text-white text-sm font-mono font-bold hover:bg-destructive/90 transition-colors" onClick={bulkDelete}>Delete Selected</button>
            </div>
          </div>
        </div>
      )}

      {/* Single Delete Confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-card border border-border/80 rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <p className="font-display font-bold text-base">Delete Sub-WL Record?</p>
                <p className="text-xs text-muted-foreground mt-0.5">This cannot be undone.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setConfirmDelete(null)}>Cancel</Button>
              <Button className="flex-1 bg-destructive hover:bg-destructive/90 text-white border-0" onClick={() => deleteProposal(confirmDelete)}>
                <Trash2 className="w-4 h-4 mr-1.5" /> Delete
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h1 className="font-display font-black text-xl sm:text-2xl tracking-tight">SUB-WHITE-LABEL PROPOSALS</h1>
          <p className="text-sm text-muted-foreground mt-1">Review, accept, refuse, or counter fee proposals from white labels</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={load} className="gap-2">
            <RefreshCw className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Refresh</span>
          </Button>
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(o => !o)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all ${menuOpen ? "border-primary bg-primary/10 text-primary" : "border-border/50 bg-secondary text-foreground hover:border-primary/40"}`}
            >
              {activeSection && <activeSection.icon className="w-4 h-4" />}
              <span>{activeSection?.label}</span>
              <ChevronDown className={`w-4 h-4 transition-transform ${menuOpen ? "rotate-180" : ""}`} />
            </button>
            {menuOpen && (
              <div className="absolute right-0 mt-2 w-48 rounded-xl bg-card border border-border/80 shadow-xl overflow-hidden z-50">
                {SECTIONS.map(s => (
                  <button key={s.key} onClick={() => { setSection(s.key); setMenuOpen(false); }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors ${section === s.key ? "text-primary bg-primary/10" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}>
                    <s.icon className="w-4 h-4" /> {s.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Overview */}
      {section === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Total Proposals" value={proposals.length} icon={LayoutDashboard} accent />
            <StatCard label="Pending Review" value={pending.length} icon={Clock} />
            <StatCard label="Accepted" value={proposals.filter(p => p.status === "accepted" || p.status === "agreed").length} icon={CheckCircle} />
            <StatCard label="Refused" value={proposals.filter(p => p.status === "refused").length} icon={X} />
          </div>
          {proposals.length === 0 && (
            <div className="py-16 text-center rounded-xl bg-card border border-border/50">
              <p className="text-muted-foreground">No proposals yet</p>
            </div>
          )}
          {proposals.length > 0 && (
            <div className="space-y-4">
              {pending.length > 0 && (
                <div>
                  <h2 className="font-display font-bold text-sm uppercase tracking-wider mb-3 text-yellow-400">Pending Review ({pending.length})</h2>
                  <div className="space-y-2">
                    {pending.map(p => (
                      <ProposalCard
                        key={p.id}
                        proposal={p}
                        parentWL={whiteLabelMap[p.parent_wl_id]}
                        onOpen={() => setDetailProposal(p)}
                        onDelete={() => setConfirmDelete(p.id)}
                        highlight
                      />
                    ))}
                  </div>
                </div>
              )}
              <div>
                <h2 className="font-display font-bold text-sm uppercase tracking-wider mb-3 text-muted-foreground">All Proposals</h2>
                <div className="space-y-2">
                  {proposals.map(p => (
                    <ProposalCard
                      key={p.id}
                      proposal={p}
                      parentWL={whiteLabelMap[p.parent_wl_id]}
                      onOpen={() => setDetailProposal(p)}
                      onDelete={() => setConfirmDelete(p.id)}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Pending */}
      {section === "pending" && (
        <div className="space-y-3">
          {pending.length === 0 && (
            <div className="py-16 text-center rounded-xl bg-card border border-border/50">
              <p className="text-muted-foreground">No pending proposals</p>
            </div>
          )}
          {pending.map(p => (
            <ProposalCard
              key={p.id}
              proposal={p}
              parentWL={whiteLabelMap[p.parent_wl_id]}
              onOpen={() => setDetailProposal(p)}
              onDelete={() => setConfirmDelete(p.id)}
              highlight
              expanded
            />
          ))}
        </div>
      )}

      {/* History */}
      {section === "history" && (
        <div className="space-y-2">
          <BulkActionBar
            selectedCount={selectedIds.size}
            totalCount={rest.length}
            onSelectAll={() => setSelectedIds(new Set(rest.map(p => p.id)))}
            onClearSelection={() => setSelectedIds(new Set())}
            onDeleteSelected={() => setConfirmBulkDelete(true)}
            deleteLabel={`Delete ${selectedIds.size} Proposal${selectedIds.size !== 1 ? "s" : ""}`}
          />
          {rest.length === 0 && (
            <div className="py-16 text-center rounded-xl bg-card border border-border/50">
              <p className="text-muted-foreground">No history yet</p>
            </div>
          )}
          {rest.map(p => {
            const isSelected = selectedIds.has(p.id);
            return (
              <div key={p.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${isSelected ? "border-primary/50 bg-primary/5" : "bg-card border-border/50"}`}>
                <button
                  onClick={() => toggleSelect(p.id)}
                  className={`shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${isSelected ? "bg-primary border-primary" : "border-border/60 hover:border-primary/50"}`}
                >
                  {isSelected && <Check className="w-3 h-3 text-white" />}
                </button>
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setDetailProposal(p)}>
                  <ProposalCard
                    proposal={p}
                    parentWL={whiteLabelMap[p.parent_wl_id]}
                    onOpen={() => setDetailProposal(p)}
                    onDelete={() => setConfirmDelete(p.id)}
                    inline
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ProposalCard({ proposal: p, parentWL, onOpen, onDelete, highlight, expanded, inline }) {
  const st = STATUS_STYLE[p.status] || STATUS_STYLE.pending;
  const feeLabel = () => {
    if (p.proposed_fee_type === "percentage") return `${p.proposed_fee_percent || 0}% / ticket`;
    if (p.proposed_fee_type === "flat") return `$${(p.proposed_fee_flat || 0).toFixed(2)} / ticket`;
    return `${p.proposed_fee_percent || 0}% + $${(p.proposed_fee_flat || 0).toFixed(2)} / ticket`;
  };
  const parentName = parentWL?.brand_name || parentWL?.name || p.parent_wl_name || "—";
  const parentEmail = parentWL?.email || p.parent_wl_email || "";

  if (inline) {
    return (
      <div className="min-w-0 flex items-start justify-between gap-2 flex-wrap">
        <div className="min-w-0">
          <p className="font-bold text-sm truncate">{p.sub_wl_brand || p.sub_wl_name}</p>
          <div className="flex items-center gap-1 mt-0.5">
            <Building2 className="w-3 h-3 text-primary shrink-0" />
            <p className="text-xs font-mono text-primary truncate">{parentName}</p>
          </div>
          <p className="text-[10px] font-mono text-muted-foreground">{feeLabel()}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded border ${st.color}`}>{st.label}</span>
          <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-1.5 rounded-lg text-destructive/60 hover:text-destructive hover:bg-destructive/10 transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={onOpen}
      className={`group rounded-xl border p-4 cursor-pointer transition-all hover:border-primary/40 hover:bg-card/80 ${highlight ? "border-yellow-400/20 bg-card" : "border-border/50 bg-card"}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {/* Sub-WL name + status */}
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-bold text-sm group-hover:text-primary transition-colors truncate">{p.sub_wl_brand || p.sub_wl_name}</p>
            <span className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded border ${st.color}`}>{st.label}</span>
            {p.created_wl_id && <span className="text-[10px] font-mono text-green-400 font-bold">✓ WL Created</span>}
          </div>

          {/* Sub-WL email */}
          <div className="flex items-center gap-1 mt-1">
            <Mail className="w-3 h-3 text-muted-foreground shrink-0" />
            <p className="text-xs font-mono text-muted-foreground truncate">{p.sub_wl_email}</p>
          </div>

          {/* Parent WL — prominent */}
          <div className="flex items-center gap-1.5 mt-1.5 px-2 py-1 rounded-lg bg-primary/5 border border-primary/15 w-fit max-w-full">
            <Building2 className="w-3 h-3 text-primary shrink-0" />
            <p className="text-xs font-mono">
              <span className="text-muted-foreground">Belongs to: </span>
              <span className="text-primary font-bold truncate">{parentName}</span>
              {parentEmail && <span className="text-muted-foreground"> · {parentEmail}</span>}
            </p>
          </div>

          {/* Fee + date */}
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <span className="text-xs font-mono text-yellow-400">{feeLabel()}</span>
            {p.created_date && (
              <span className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground">
                <Calendar className="w-3 h-3" />
                {format(new Date(p.created_date), "MMM dd, yyyy")}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {p.status === "pending" && expanded && (
            <span className="text-xs font-mono text-yellow-400 font-bold hidden sm:block">Tap to review →</span>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-1.5 rounded-lg text-destructive/50 hover:text-destructive hover:bg-destructive/10 transition-colors"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}