import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Music, CheckCircle, XCircle, ExternalLink, Loader2, Clock } from "lucide-react";
import { Link } from "react-router-dom";

const FIELD_LABELS = {
  display_name: "Artist Name",
  bio: "Bio",
  genre: "Genres",
  profile_image: "Profile Image",
  city: "City",
  state: "State / Region",
  country: "Country",
  location: "Location",
  contact_email: "Contact Email",
  website: "Website",
  instagram: "Instagram",
  twitter: "Twitter / X",
  soundcloud: "SoundCloud",
  spotify: "Spotify",
  tiktok: "TikTok",
};

function prettyGenre(g) {
  if (!g) return "—";
  return String(g).split(",").map(x => x.trim().replace(/_/g, " ")).filter(Boolean)
    .map(x => x.replace(/\b\w/g, c => c.toUpperCase())).join(", ");
}

function FieldDiff({ field, oldVal, newVal }) {
  const isImage = field === "profile_image";
  const isBio = field === "bio";
  const displayVal = (v, isGenre) => {
    if (v === undefined || v === null || v === "") return "—";
    if (field === "genre") return prettyGenre(v);
    return String(v);
  };

  if (isImage) {
    return (
      <div className="grid grid-cols-2 gap-3 items-center">
        <div className="text-center">
          <p className="text-[10px] font-mono text-muted-foreground uppercase mb-1">Current</p>
          {oldVal ? (
            <img src={oldVal} alt="current" className="w-16 h-16 rounded-full object-cover mx-auto border border-border/50" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto border border-border/50">
              <Music className="w-5 h-5 text-muted-foreground/50" />
            </div>
          )}
        </div>
        <div className="text-center">
          <p className="text-[10px] font-mono text-primary uppercase mb-1">New</p>
          {newVal ? (
            <img src={newVal} alt="new" className="w-16 h-16 rounded-full object-cover mx-auto border-2 border-primary/60" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto border-2 border-primary/60">
              <Music className="w-5 h-5 text-muted-foreground/50" />
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="rounded-lg bg-muted/30 border border-border/30 p-2 min-w-0">
        <p className="text-[10px] font-mono text-muted-foreground uppercase mb-1">Current</p>
        <p className={`text-xs text-muted-foreground break-words ${isBio ? "whitespace-pre-wrap line-clamp-4" : "truncate"}`}>{displayVal(oldVal)}</p>
      </div>
      <div className="rounded-lg bg-primary/5 border border-primary/30 p-2 min-w-0">
        <p className="text-[10px] font-mono text-primary uppercase mb-1">New</p>
        <p className={`text-xs text-foreground break-words ${isBio ? "whitespace-pre-wrap line-clamp-4" : "truncate"}`}>{displayVal(newVal)}</p>
      </div>
    </div>
  );
}

export default function ArtistProfileEditReview({ onRefresh }) {
  const [edits, setEdits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [actionLoading, setActionLoading] = useState(null);

  const load = async () => {
    setLoading(true);
    const data = await base44.entities.ArtistProfileEdit.filter({ status: "pending_review" }, "-created_date", 100).catch(() => []);
    setEdits(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const unsub = base44.entities.ArtistProfileEdit.subscribe((event) => {
      if (event.type === "create" && event.data?.status === "pending_review") {
        setEdits(prev => [event.data, ...prev.filter(e => e.id !== event.data.id)]);
      } else if (event.type === "update") {
        if (event.data?.status === "pending_review") {
          setEdits(prev => [event.data, ...prev.filter(e => e.id !== event.data.id)]);
        } else {
          setEdits(prev => prev.filter(e => e.id !== event.data.id));
        }
      }
    });
    return unsub;
  }, []);

  const approve = async (edit) => {
    if (actionLoading) return;
    setActionLoading(edit.id);
    try {
      const res = await base44.functions.invoke("reviewArtistProfileEdit", { edit_id: edit.id, action: "approve" });
      if (res?.data?.success) {
        toast.success("Profile changes approved and applied.");
        setEdits(prev => prev.filter(e => e.id !== edit.id));
        if (onRefresh) onRefresh();
      } else {
        toast.error(res?.data?.error || "Could not approve. Try again.");
      }
    } catch (err) {
      toast.error(err?.response?.data?.error || err?.message || "Could not approve.");
    } finally {
      setActionLoading(null);
    }
  };

  const reject = async (edit) => {
    if (actionLoading) return;
    setActionLoading(edit.id);
    try {
      const res = await base44.functions.invoke("reviewArtistProfileEdit", { edit_id: edit.id, action: "reject", rejection_reason: rejectionReason });
      if (res?.data?.success) {
        toast.success("Profile update request rejected. Artist notified.");
        setEdits(prev => prev.filter(e => e.id !== edit.id));
        setRejectingId(null);
        setRejectionReason("");
        if (onRefresh) onRefresh();
      } else {
        toast.error(res?.data?.error || "Could not reject. Try again.");
      }
    } catch (err) {
      toast.error(err?.response?.data?.error || err?.message || "Could not reject.");
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  if (edits.length === 0) {
    return (
      <div className="py-16 text-center">
        <CheckCircle className="w-10 h-10 text-green-400/40 mx-auto mb-3" />
        <p className="text-muted-foreground font-mono text-sm">No pending profile edits 🎉</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {edits.map((edit) => {
        const pd = edit.pending_data || {};
        const od = edit.original_data || {};
        const changed = (edit.changed_fields && edit.changed_fields.length) ? edit.changed_fields : Object.keys(pd);
        const imageChanged = changed.includes("profile_image");
        const textChangedFields = changed.filter(f => f !== "profile_image");
        return (
          <div key={edit.id} className="p-4 rounded-xl bg-card border border-yellow-400/20 space-y-4">
            {/* Header */}
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3 min-w-0">
                <div className="shrink-0">
                  {pd.profile_image ? (
                    <img src={pd.profile_image} alt={pd.display_name} className="w-12 h-12 rounded-full object-cover border border-primary/40" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <Music className="w-5 h-5 text-primary" />
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="font-display font-bold truncate">{pd.display_name || edit.artist_name}</p>
                  <p className="text-xs font-mono text-muted-foreground truncate">{edit.artist_email}</p>
                  <p className="text-xs font-mono text-muted-foreground/70">
                    Submitted {edit.created_date ? format(new Date(edit.created_date), "MMM dd, yyyy 'at' h:mm a") : "—"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Link to={`/artists/${edit.artist_id}`} target="_blank"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-secondary hover:bg-muted text-muted-foreground border border-border/40">
                  <ExternalLink className="w-3.5 h-3.5" /> View Live
                </Link>
                <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-yellow-400/10 text-yellow-400 font-mono text-[10px] font-bold uppercase">
                  <Clock className="w-3 h-3" /> Pending
                </span>
              </div>
            </div>

            {/* Changed fields */}
            {changed.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">No field changes detected.</p>
            ) : (
              <div className="space-y-3">
                {imageChanged && (
                  <div className="p-3 rounded-lg bg-secondary/40 border border-border/30">
                    <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-2">Profile Image</p>
                    <FieldDiff field="profile_image" oldVal={od.profile_image} newVal={pd.profile_image} />
                  </div>
                )}
                {textChangedFields.length > 0 && (
                  <div className="space-y-2.5">
                    {textChangedFields.map((f) => (
                      <div key={f}>
                        <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider mb-1">{FIELD_LABELS[f] || f}</p>
                        <FieldDiff field={f} oldVal={od[f]} newVal={pd[f]} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            {rejectingId === edit.id ? (
              <div className="space-y-2">
                <Input
                  value={rejectionReason}
                  onChange={e => setRejectionReason(e.target.value)}
                  placeholder="Reason for rejection (optional)"
                  className="bg-secondary border-border/50 text-sm"
                />
                <div className="flex gap-2">
                  <Button onClick={() => reject(edit)} disabled={actionLoading === edit.id} size="sm"
                    className="bg-destructive hover:bg-destructive/90 text-destructive-foreground gap-2">
                    <XCircle className="w-3.5 h-3.5" /> {actionLoading === edit.id ? "Rejecting..." : "Confirm Reject"}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => { setRejectingId(null); setRejectionReason(""); }}>Cancel</Button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button onClick={() => approve(edit)} disabled={actionLoading === edit.id} size="sm" className="glow-lime gap-2 font-bold">
                  <CheckCircle className="w-3.5 h-3.5" /> {actionLoading === edit.id ? "Approving..." : "Approve Changes"}
                </Button>
                <Button onClick={() => setRejectingId(edit.id)} variant="outline" size="sm"
                  className="border-destructive/40 text-destructive hover:bg-destructive/10 gap-2">
                  <XCircle className="w-3.5 h-3.5" /> Reject Changes
                </Button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}