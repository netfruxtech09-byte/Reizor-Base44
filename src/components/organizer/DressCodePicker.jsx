import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, Check, Bookmark } from "lucide-react";
import { toast } from "sonner";

/**
 * DressCodePicker — lets organizers enter a dress code, save templates,
 * and reuse previously saved dress codes. Templates are private per organizer.
 */
export default function DressCodePicker({ value, onChange, organizerId }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSave, setShowSave] = useState(false);

  useEffect(() => {
    if (!organizerId) { setLoading(false); return; }
    base44.entities.DressCodeTemplate.filter({ organizer_id: organizerId }, "label", 50)
      .then(setTemplates)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [organizerId]);

  const handleSaveTemplate = async () => {
    if (!value?.trim()) { toast.error("Enter a dress code first"); return; }
    const label = value.trim();
    const already = templates.find(t => t.label.toLowerCase() === label.toLowerCase());
    if (already) { toast.info("This dress code is already saved"); setShowSave(false); return; }
    setSaving(true);
    const created = await base44.entities.DressCodeTemplate.create({ organizer_id: organizerId, label }).catch(() => null);
    if (created) {
      setTemplates(prev => [...prev, created].sort((a, b) => a.label.localeCompare(b.label)));
      toast.success("Dress code saved to your templates");
    }
    setSaving(false);
    setShowSave(false);
  };

  const handleDelete = async (id) => {
    await base44.entities.DressCodeTemplate.delete(id).catch(() => {});
    setTemplates(prev => prev.filter(t => t.id !== id));
    toast.success("Template removed");
  };

  const handleSelect = (label) => {
    onChange(label);
    setShowSave(false);
  };

  return (
    <div className="space-y-3">
      <Label className="text-xs text-muted-foreground font-mono">Dress Code</Label>

      {/* Saved templates */}
      {!loading && templates.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {templates.map(t => (
            <div key={t.id} className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleSelect(t.label)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold border transition-all ${
                  value === t.label
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-secondary border-border/50 text-foreground hover:border-primary/50"
                }`}
              >
                {value === t.label && <Check className="w-3 h-3 inline mr-1" />}
                {t.label}
              </button>
              <button
                type="button"
                onClick={() => handleDelete(t.id)}
                className="text-muted-foreground hover:text-destructive transition-colors p-0.5"
                title="Remove template"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Free-text input */}
      <div className="flex gap-2">
        <Input
          value={value || ""}
          onChange={e => { onChange(e.target.value); setShowSave(!!e.target.value.trim()); }}
          placeholder="e.g. Smart Casual, All White, Formal, Theme Party..."
          className="bg-card border-border/50 flex-1"
        />
        {showSave && organizerId && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleSaveTemplate}
            disabled={saving}
            className="gap-1.5 shrink-0 font-mono text-xs border-primary/40 text-primary hover:bg-primary/10"
            title="Save as template for future events"
          >
            <Bookmark className="w-3.5 h-3.5" />
            {saving ? "Saving..." : "Save"}
          </Button>
        )}
      </div>

      {templates.length === 0 && !loading && (
        <p className="text-[10px] font-mono text-muted-foreground">
          Type a dress code and click Save to store it as a reusable template.
        </p>
      )}
    </div>
  );
}