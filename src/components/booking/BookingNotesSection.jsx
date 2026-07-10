import { useState, useEffect } from "react";
import { MessageSquare, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";
import { toast } from "sonner";

export default function BookingNotesSection({ bookingId, currentUser, onHistoryLog }) {
  const [notes, setNotes] = useState([]);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities.BookingNote.filter({ booking_id: bookingId }, "-created_date", 100)
      .then(setNotes)
      .finally(() => setLoading(false));
  }, [bookingId]);

  const handleAdd = async () => {
    if (!text.trim()) return;
    setSaving(true);
    const note = await base44.entities.BookingNote.create({
      booking_id: bookingId,
      author_email: currentUser.email,
      author_name: currentUser.full_name || currentUser.email,
      text: text.trim(),
    });
    setNotes(prev => [note, ...prev]);
    setText("");
    onHistoryLog?.("Note added", text.trim().slice(0, 80));
    toast.success("Note saved");
    setSaving(false);
  };

  return (
    <div className="rounded-xl bg-card border border-border/50 overflow-hidden">
      <div className="p-4 border-b border-border/30 flex items-center gap-2">
        <MessageSquare className="w-4 h-4 text-accent" />
        <h2 className="font-display font-bold">Internal Notes</h2>
        <span className="text-[10px] font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">
          {notes.length} note{notes.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="p-4 space-y-4">
        {/* Add note */}
        <div className="space-y-2">
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            rows={3}
            placeholder="Add an internal note about this booking..."
            className="w-full rounded-lg bg-secondary border border-border/50 px-3 py-2 text-sm resize-none outline-none focus:ring-1 focus:ring-ring"
          />
          <Button
            size="sm"
            onClick={handleAdd}
            disabled={saving || !text.trim()}
            className="gap-1.5 font-display font-bold"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            {saving ? "Saving..." : "Add Note"}
          </Button>
        </div>

        {/* Notes list */}
        {loading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : notes.length === 0 ? (
          <p className="text-xs text-muted-foreground italic text-center py-4">No notes yet</p>
        ) : (
          <div className="space-y-3">
            {notes.map(note => (
              <div key={note.id} className="p-3 rounded-lg bg-secondary border border-border/30 space-y-1">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-xs font-bold text-foreground">{note.author_name}</span>
                  <span className="text-[10px] font-mono text-muted-foreground">
                    {note.created_date ? format(new Date(note.created_date), "MMM dd, yyyy · h:mm a") : ""}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{note.text}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}