import { useState, useEffect } from "react";
import { Plus, MapPin, Clock, Calendar, Trash2, Edit2, ExternalLink, Upload, Music } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { format } from "date-fns";
import TourShareButton from "@/components/artist/TourShareButton";

const BLANK = {
  venue_name: "", full_address: "", city: "", state: "", country: "", lineup: "",
  set_time: "", date: "", social_link: "", ticket_link: "",
  promo_image: "", promo_video_url: "", notes: "",
};

export default function ArtistTourSchedule() {
  const [shows, setShows] = useState([]);
  const [artist, setArtist] = useState(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(BLANK);
  const [saving, setSaving] = useState(false);
  const [uploadingImg, setUploadingImg] = useState(false);

  useEffect(() => {
    const load = async () => {
      const user = await base44.auth.me();
      const artists = await base44.entities.Artist.filter({ user_email: user.email }, null, 1);
      if (!artists[0]) { setLoading(false); return; }
      setArtist(artists[0]);
      const data = await base44.entities.ArtistTourSchedule.filter({ artist_id: artists[0].id }, "-date", 100);
      setShows(data);
      setLoading(false);
    };
    load();
  }, []);

  const openNew = () => { setEditing(null); setForm(BLANK); setOpen(true); };

  const openEdit = (show) => {
    setEditing(show);
    setForm({
      venue_name: show.venue_name || "",
      full_address: show.full_address || "",
      city: show.city || "",
      state: show.state || "",
      country: show.country || "",
      lineup: show.lineup || "",
      set_time: show.set_time || "",
      date: show.date ? show.date.slice(0, 16) : "",
      social_link: show.social_link || "",
      ticket_link: show.ticket_link || "",
      promo_image: show.promo_image || "",
      promo_video_url: show.promo_video_url || "",
      notes: show.notes || "",
    });
    setOpen(true);
  };

  const handleSave = async () => {
    if (!form.venue_name || !form.full_address || !form.date || !form.set_time) {
      toast.error("Venue name, full address, date, and set time are required");
      return;
    }
    setSaving(true);
    const payload = {
      ...form,
      artist_id: artist.id,
      artist_name: artist.display_name,
      artist_email: artist.user_email,
      date: new Date(form.date).toISOString(),
    };
    if (editing) {
      const updated = await base44.entities.ArtistTourSchedule.update(editing.id, payload);
      setShows(prev => prev.map(s => s.id === editing.id ? { ...s, ...updated } : s));
      toast.success("Show updated");
    } else {
      const created = await base44.entities.ArtistTourSchedule.create(payload);
      setShows(prev => [created, ...prev]);
      toast.success("Show added to tour schedule");
    }
    setSaving(false);
    setOpen(false);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Remove this show from your schedule?")) return;
    await base44.entities.ArtistTourSchedule.delete(id);
    setShows(prev => prev.filter(s => s.id !== id));
    toast.success("Show removed");
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImg(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setForm(f => ({ ...f, promo_image: file_url }));
    setUploadingImg(false);
  };

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;

  if (!artist) return (
    <div className="text-center py-20">
      <Music className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
      <p className="text-muted-foreground">Artist profile not found.</p>
    </div>
  );

  const upcoming = shows.filter(s => s.status !== "completed" && new Date(s.date) >= new Date());
  const past = shows.filter(s => s.status === "completed" || new Date(s.date) < new Date());

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <span className="font-mono text-xs text-primary tracking-[0.3em] uppercase">Artist</span>
          <h1 className="font-display font-black text-2xl sm:text-3xl tracking-tight mt-1">TOUR SCHEDULE</h1>
        </div>
        <Button onClick={openNew} className="glow-lime font-display font-bold gap-2 self-start sm:self-auto">
          <Plus className="w-4 h-4" /> Add Show
        </Button>
      </div>

      <div className="p-3 rounded-lg bg-accent/10 border border-accent/20 text-xs font-mono text-accent">
        ℹ Fans following you will receive alerts 7 days and 1 day before each show. No platform ticket needed.
      </div>

      {shows.length === 0 ? (
        <div className="text-center py-16 bg-card rounded-xl border border-border/50">
          <MapPin className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground font-display font-bold">No shows scheduled yet</p>
          <p className="text-xs text-muted-foreground mt-1">Add upcoming performances to your tour schedule</p>
        </div>
      ) : (
        <>
          {upcoming.length > 0 && (
            <div className="space-y-3">
              <h2 className="font-display font-bold text-sm uppercase tracking-widest text-muted-foreground">Upcoming Shows</h2>
              {upcoming.map(show => <ShowCard key={show.id} show={show} onEdit={openEdit} onDelete={handleDelete} artistId={artist?.id} />)}
            </div>
          )}
          {past.length > 0 && (
            <div className="space-y-3">
              <h2 className="font-display font-bold text-sm uppercase tracking-widest text-muted-foreground">Past Shows</h2>
              {past.map(show => <ShowCard key={show.id} show={show} onEdit={openEdit} onDelete={handleDelete} past artistId={artist?.id} />)}
            </div>
          )}
        </>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-card border-border max-w-lg w-[calc(100vw-2rem)] max-h-[92dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display font-black">{editing ? "Edit Show" : "Add Show to Tour"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {/* Promo Image */}
            <div>
              <Label className="text-xs font-mono text-muted-foreground">Promo Image</Label>
              <div className="mt-1 flex items-center gap-3">
                {form.promo_image && <img src={form.promo_image} className="w-16 h-10 object-cover rounded" alt="" />}
                <label className="flex items-center gap-2 px-3 py-2 rounded-md border border-border/50 bg-secondary text-xs cursor-pointer hover:border-primary/40 transition-colors">
                  <Upload className="w-3.5 h-3.5" />
                  {uploadingImg ? "Uploading..." : "Upload Image"}
                  <input type="file" accept="image/*,video/*" className="hidden" onChange={handleImageUpload} disabled={uploadingImg} />
                </label>
              </div>
            </div>
            <div>
              <Label className="text-xs font-mono text-muted-foreground">Promo Video URL (optional)</Label>
              <Input value={form.promo_video_url} onChange={e => setForm(f => ({ ...f, promo_video_url: e.target.value }))}
                placeholder="https://youtube.com/..." className="mt-1 bg-secondary border-border/50" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label className="text-xs font-mono text-muted-foreground">Venue / Place Name *</Label>
                <Input value={form.venue_name} onChange={e => setForm(f => ({ ...f, venue_name: e.target.value }))}
                  placeholder="Club XYZ" className="mt-1 bg-secondary border-border/50" />
              </div>
              <div className="col-span-2">
                <Label className="text-xs font-mono text-muted-foreground">Full Address *</Label>
                <Input value={form.full_address} onChange={e => setForm(f => ({ ...f, full_address: e.target.value }))}
                  placeholder="123 Main St, New York, NY 10001, USA" className="mt-1 bg-secondary border-border/50" />
              </div>
              <div>
                <Label className="text-xs font-mono text-muted-foreground">City</Label>
                <Input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                  placeholder="New York" className="mt-1 bg-secondary border-border/50" />
              </div>
              <div>
                <Label className="text-xs font-mono text-muted-foreground">State / Region</Label>
                <Input value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))}
                  placeholder="NY" className="mt-1 bg-secondary border-border/50" />
              </div>
              <div>
                <Label className="text-xs font-mono text-muted-foreground">Country</Label>
                <Input value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))}
                  placeholder="USA" className="mt-1 bg-secondary border-border/50" />
              </div>
              <div>
                <Label className="text-xs font-mono text-muted-foreground">Date & Time *</Label>
                <Input type="datetime-local" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  className="mt-1 bg-secondary border-border/50" />
              </div>
              <div>
                <Label className="text-xs font-mono text-muted-foreground">Set Time</Label>
                <Input value={form.set_time} onChange={e => setForm(f => ({ ...f, set_time: e.target.value }))}
                  placeholder="e.g. 11pm - 1am" className="mt-1 bg-secondary border-border/50" />
              </div>
              <div className="col-span-2">
                <Label className="text-xs font-mono text-muted-foreground">Lineup</Label>
                <Input value={form.lineup} onChange={e => setForm(f => ({ ...f, lineup: e.target.value }))}
                  placeholder="DJ A, DJ B, Live Band..." className="mt-1 bg-secondary border-border/50" />
              </div>
              <div className="col-span-2">
                <Label className="text-xs font-mono text-muted-foreground">Show / Social Link</Label>
                <Input value={form.social_link} onChange={e => setForm(f => ({ ...f, social_link: e.target.value }))}
                  placeholder="https://instagram.com/p/..." className="mt-1 bg-secondary border-border/50" />
              </div>
              <div className="col-span-2">
                <Label className="text-xs font-mono text-muted-foreground">Ticket Link (if external)</Label>
                <Input value={form.ticket_link} onChange={e => setForm(f => ({ ...f, ticket_link: e.target.value }))}
                  placeholder="https://tickets.example.com/..." className="mt-1 bg-secondary border-border/50" />
              </div>
              <div className="col-span-2">
                <Label className="text-xs font-mono text-muted-foreground">Notes</Label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2} placeholder="Any additional info..."
                  className="mt-1 w-full rounded-md bg-secondary border border-border/50 px-3 py-2 text-sm resize-none" />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <Button onClick={handleSave} disabled={saving} className="flex-1 glow-lime font-display font-bold">
                {saving ? "Saving..." : editing ? "Update Show" : "Add Show"}
              </Button>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ShowCard({ show, onEdit, onDelete, past, artistId }) {
  const address = show.full_address || [show.city, show.state, show.country].filter(Boolean).join(", ");

  return (
    <div className={`p-4 rounded-xl bg-card border transition-colors ${past ? "border-border/30 opacity-70" : "border-border/50 hover:border-primary/30"}`}>
      <div className="flex gap-3">
        {show.promo_image && (
          <img src={show.promo_image} alt="" className="w-16 h-12 sm:w-20 sm:h-14 rounded-lg object-cover shrink-0"
          onError={e => { e.target.style.display="none"; }}
        />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="font-display font-bold truncate">{show.venue_name}</p>
              {address && (
                <div className="flex items-start gap-1 mt-0.5 text-xs text-muted-foreground font-mono">
                  <MapPin className="w-3 h-3 shrink-0 mt-0.5" />
                  <span className="break-words">{address}</span>
                </div>
              )}
              <div className="flex items-center gap-3 mt-1 flex-wrap">
                <span className="flex items-center gap-1 text-xs font-mono text-primary">
                  <Calendar className="w-3 h-3" />
                  {show.date ? format(new Date(show.date), "MMM dd, yyyy") : "—"}
                </span>
                {show.set_time && (
                  <span className="flex items-center gap-1 text-xs font-mono text-muted-foreground">
                    <Clock className="w-3 h-3" /> {show.set_time}
                  </span>
                )}
              </div>
              {show.lineup && <p className="text-xs text-muted-foreground mt-1 truncate">Lineup: {show.lineup}</p>}
              <div className="flex items-center gap-1 mt-2 flex-wrap">
                {show.social_link && (
                  <a href={show.social_link} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded text-muted-foreground hover:text-foreground transition-colors">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
                {show.ticket_link && (
                  <a href={show.ticket_link} target="_blank" rel="noopener noreferrer" className="px-2 py-1 rounded text-[10px] font-mono font-bold bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
                    Tickets
                  </a>
                )}
                {artistId && <TourShareButton show={show} artistId={artistId} />}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={() => onEdit(show)} className="p-1.5 rounded text-muted-foreground hover:text-foreground transition-colors" title="Edit">
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => onDelete(show.id)} className="p-1.5 rounded text-muted-foreground hover:text-destructive transition-colors" title="Delete">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}