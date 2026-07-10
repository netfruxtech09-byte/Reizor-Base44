import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const DEFAULT_GENRES = [
  "techno", "house", "drum_and_bass", "trance", "hip_hop", "rnb",
  "pop", "rock", "jazz", "electronic", "latin", "reggaeton", "afrobeats", "other",
];

const toKey = (name) => name.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
const toLabel = (key) => key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());

// Genre selector with inline "Add custom genre" input, persisted to DB
export default function GenreSelector({ value, onChange, className = "" }) {
  const [allGenres, setAllGenres] = useState(DEFAULT_GENRES);
  const [newGenre, setNewGenre] = useState("");
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    base44.entities.CustomGenre.list(null, 200).then(customs => {
      if (customs.length > 0) {
        const customKeys = customs.map(c => c.key).filter(k => !DEFAULT_GENRES.includes(k));
        setAllGenres([...DEFAULT_GENRES, ...customKeys]);
      }
    }).catch(() => {});
  }, []);

  const handleAdd = async () => {
    const trimmed = newGenre.trim();
    if (!trimmed) return;
    const key = toKey(trimmed);
    if (!key) return toast.error("Invalid genre name");

    // Duplicate check (case-insensitive)
    if (allGenres.some(g => g.toLowerCase() === key)) {
      toast.error("Genre already exists");
      setNewGenre("");
      onChange(key); // auto-select it
      return;
    }

    setAdding(true);
    try {
      // Save to DB
      await base44.entities.CustomGenre.create({ name: trimmed, key });
      setAllGenres(prev => [...prev, key]);
      onChange(key);
      setNewGenre("");
      toast.success(`"${trimmed}" added and selected!`);
    } catch {
      toast.error("Failed to save genre");
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="mt-1 bg-card border-border/50">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {allGenres.map(g => (
            <SelectItem key={g} value={g}>{toLabel(g)}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Add custom genre inline */}
      <div className="flex gap-2">
        <Input
          value={newGenre}
          onChange={e => setNewGenre(e.target.value)}
          onKeyDown={e => e.key === "Enter" && handleAdd()}
          placeholder="Custom genre..."
          className="bg-secondary border-white/25 hover:border-white/40 text-sm h-8"
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={handleAdd}
          disabled={adding || !newGenre.trim()}
          className="shrink-0 h-8 border-primary/40 text-primary hover:bg-primary/10"
        >
          {adding ? "..." : "+ Add"}
        </Button>
      </div>
      <p className="text-[10px] text-muted-foreground font-mono">New genres are saved and available for all future events</p>
    </div>
  );
}