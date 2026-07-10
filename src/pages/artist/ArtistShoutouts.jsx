import { useState, useEffect } from "react";
import { Video, Upload, X, DollarSign, Clock, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";
import { toast } from "sonner";

const STATUS_COLOR = {
  pending:   "text-yellow-400 bg-yellow-400/10",
  completed: "text-green-400 bg-green-400/10",
  declined:  "text-destructive bg-destructive/10",
};
const STATUS_ICON = { pending: Clock, completed: CheckCircle2, declined: XCircle };

export default function ArtistShoutouts() {
  const [artist, setArtist] = useState(null);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [price, setPrice] = useState("");
  const [savingPrice, setSavingPrice] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(null); // request id being uploaded

  useEffect(() => {
    base44.auth.me().then(async (user) => {
      const artists = await base44.entities.Artist.filter({ user_email: user.email }, null, 1);
      if (!artists[0]) { setLoading(false); return; }
      const a = artists[0];
      setArtist(a);
      setPrice(String(a.shoutout_price || ""));
      const reqs = await base44.entities.ShoutoutRequest.filter({ artist_id: a.id }, "-created_date", 100);
      setRequests(reqs);
      setLoading(false);
    });
  }, []);

  const savePrice = async () => {
    const p = parseFloat(price);
    if (!p || p < 1) { toast.error("Minimum price is $1"); return; }
    setSavingPrice(true);
    await base44.entities.Artist.update(artist.id, { shoutout_price: p });
    setArtist(a => ({ ...a, shoutout_price: p }));
    toast.success("Price updated!");
    setSavingPrice(false);
  };

  const handleVideoUpload = async (e, requestId) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingVideo(requestId);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    await base44.entities.ShoutoutRequest.update(requestId, { status: "completed", video_url: file_url });
    const req = requests.find(r => r.id === requestId);
    // Notify fan by email
    await base44.integrations.Core.SendEmail({
      to: req.fan_email,
      subject: `🎤 Your shoutout from ${artist.display_name} is ready!`,
      body: `Hi ${req.fan_name || "there"},\n\n${artist.display_name} has recorded your shoutout for ${req.recipient_name}!\n\nYou can watch it here: ${file_url}\n\nThank you for supporting the artist! 🎶`,
    }).catch(() => {});
    setRequests(prev => prev.map(r => r.id === requestId ? { ...r, status: "completed", video_url: file_url } : r));
    toast.success("Video delivered to fan!");
    setUploadingVideo(null);
  };

  const declineRequest = async (id, note) => {
    await base44.entities.ShoutoutRequest.update(id, { status: "declined", artist_note: note || "" });
    setRequests(prev => prev.map(r => r.id === id ? { ...r, status: "declined" } : r));
    toast.success("Request declined");
  };

  const totalRevenue = requests.filter(r => r.status === "completed").reduce((s, r) => s + (r.net_amount || 0), 0);
  const pending = requests.filter(r => r.status === "pending");

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;
  if (!artist) return <div className="text-center py-20 text-muted-foreground">No artist profile found.</div>;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display font-black text-3xl tracking-tight">SHOUTOUTS</h1>
          <p className="text-sm text-muted-foreground font-mono mt-0.5">Fans pay for personalised video messages</p>
        </div>
        <div className="flex items-center gap-3 text-sm font-mono">
          <span className="text-green-400 font-bold">${totalRevenue.toFixed(2)}</span>
          <span className="text-muted-foreground">· {requests.length} requests</span>
        </div>
      </div>

      {/* Pricing config */}
      <div className="p-5 rounded-xl bg-card border border-border/50 space-y-3">
        <h2 className="font-display font-bold">Your Shoutout Price</h2>
        <p className="text-sm text-muted-foreground">Set the price fans pay to request a personalised video from you. Set to 0 to disable shoutouts on your profile.</p>
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <Label className="text-xs font-mono text-muted-foreground">Price per shoutout ($)</Label>
            <div className="relative mt-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono">$</span>
              <Input type="number" min="0" step="1" value={price} onChange={e => setPrice(e.target.value)}
                placeholder="e.g. 25" className="pl-7 bg-secondary border-border/50" />
            </div>
          </div>
          <Button onClick={savePrice} disabled={savingPrice} className="glow-lime font-display font-bold">
            {savingPrice ? "Saving..." : "Save Price"}
          </Button>
        </div>
        {artist.shoutout_price > 0 && (
          <p className="text-xs font-mono text-muted-foreground">
            You receive: <span className="text-green-400 font-bold">${(artist.shoutout_price * 0.9).toFixed(2)}</span> per shoutout (10% platform fee)
          </p>
        )}
      </div>

      {/* Pending requests highlight */}
      {pending.length > 0 && (
        <div className="p-4 rounded-xl bg-yellow-400/10 border border-yellow-400/20">
          <p className="font-display font-bold text-yellow-400">⏳ {pending.length} pending request{pending.length > 1 ? "s" : ""} awaiting your video</p>
        </div>
      )}

      {/* Requests list */}
      <div className="space-y-3">
        <h2 className="font-display font-bold text-lg">REQUESTS</h2>
        {requests.length === 0 ? (
          <div className="text-center py-16 bg-card rounded-xl border border-border/50">
            <Video className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground text-sm">No shoutout requests yet</p>
          </div>
        ) : requests.map(req => {
          const Icon = STATUS_ICON[req.status] || Clock;
          return (
            <div key={req.id} className="p-4 rounded-xl bg-card border border-border/50 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-display font-bold">For: {req.recipient_name}</p>
                  <p className="text-xs text-muted-foreground font-mono">From {req.fan_name || req.fan_email} · {format(new Date(req.created_date), "MMM dd, yyyy")}</p>
                  {req.occasion && <p className="text-xs text-muted-foreground mt-0.5">Occasion: {req.occasion}</p>}
                  {req.instructions && <p className="text-sm mt-1 italic text-muted-foreground">"{req.instructions}"</p>}
                </div>
                <div className="text-right shrink-0">
                  <p className="font-mono font-black text-green-400">${req.net_amount?.toFixed(2)}</p>
                  <span className={`flex items-center gap-1 font-mono text-[10px] font-bold uppercase px-2 py-0.5 rounded mt-1 ${STATUS_COLOR[req.status]}`}>
                    <Icon className="w-3 h-3" /> {req.status}
                  </span>
                </div>
              </div>
              {req.status === "pending" && (
                <div className="flex gap-2 flex-wrap pt-1 border-t border-border/30">
                  <label className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/30 text-primary text-xs font-display font-bold cursor-pointer hover:bg-primary/20 transition-colors">
                    <Upload className="w-3.5 h-3.5" />
                    {uploadingVideo === req.id ? "Uploading..." : "Upload Video"}
                    <input type="file" accept="video/*" className="hidden" onChange={e => handleVideoUpload(e, req.id)} disabled={uploadingVideo === req.id} />
                  </label>
                  <button onClick={() => declineRequest(req.id)} className="px-3 py-1.5 rounded-lg border border-destructive/30 text-destructive text-xs font-display font-bold hover:bg-destructive/10 transition-colors">
                    Decline
                  </button>
                </div>
              )}
              {req.status === "completed" && req.video_url && (
                <video src={req.video_url} controls className="w-full rounded-lg max-h-48" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}