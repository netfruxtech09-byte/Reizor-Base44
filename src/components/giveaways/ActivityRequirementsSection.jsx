import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { Trash2, Save, Pencil, X } from "lucide-react";

export default function ActivityRequirementsSection({ user, value, onChange }) {
  const [templates, setTemplates] = useState([]);
  const [showManage, setShowManage] = useState(false);
  const [showSave, setShowSave] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [editText, setEditText] = useState("");

  useEffect(() => {
    if (!user) return;
    base44.entities.SavedRequirementTemplate.filter({ organizer_id: user.id }, "-created_date", 50)
      .then(setTemplates).catch(() => {});
  }, [user?.id]);

  const applyTemplate = (id) => {
    const t = templates.find(t => t.id === id);
    if (t) onChange(t.requirements_text);
  };

  const saveTemplate = async () => {
    if (!newTemplateName.trim() || !value?.trim()) {
      toast.error("Enter a template name and requirement text first");
      return;
    }
    const created = await base44.entities.SavedRequirementTemplate.create({
      organizer_id: user.id,
      organizer_email: user.email,
      template_name: newTemplateName.trim(),
      requirements_text: value,
    });
    setTemplates(prev => [created, ...prev]);
    setNewTemplateName("");
    setShowSave(false);
    toast.success("Requirement template saved");
  };

  const deleteTemplate = async (id) => {
    await base44.entities.SavedRequirementTemplate.delete(id);
    setTemplates(prev => prev.filter(t => t.id !== id));
    toast.success("Template deleted");
  };

  const startEdit = (t) => {
    setEditingId(t.id);
    setEditName(t.template_name);
    setEditText(t.requirements_text);
  };

  const cancelEdit = () => setEditingId(null);

  const saveEdit = async (id) => {
    if (!editName.trim() || !editText.trim()) {
      toast.error("Name and text can't be empty");
      return;
    }
    await base44.entities.SavedRequirementTemplate.update(id, {
      template_name: editName.trim(),
      requirements_text: editText,
    });
    setTemplates(prev => prev.map(t => t.id === id ? { ...t, template_name: editName.trim(), requirements_text: editText } : t));
    setEditingId(null);
    toast.success("Template updated");
  };

  return (
    <div>
      <Label className="text-xs font-mono text-muted-foreground">Activity Requirement / What must the Fan do?</Label>

      {templates.length > 0 && (
        <select
          onChange={e => { if (e.target.value) applyTemplate(e.target.value); e.target.value = ""; }}
          defaultValue=""
          className="mt-2 mb-2 w-full px-3 py-2 rounded-md border border-white/25 bg-secondary text-sm text-foreground"
        >
          <option value="">Use Saved Requirement...</option>
          {templates.map(t => <option key={t.id} value={t.id}>{t.template_name}</option>)}
        </select>
      )}

      <textarea
        value={value || ""} onChange={e => onChange(e.target.value)}
        placeholder="Example: Follow our Instagram page and show proof at the venue."
        className="mt-2 w-full px-3 py-2 rounded-md border border-white/25 bg-transparent text-sm resize-none h-20 focus:outline-none focus:border-primary"
      />

      <div className="flex items-center gap-3 mt-2">
        <button type="button" onClick={() => setShowSave(s => !s)} className="text-xs font-mono text-primary hover:underline flex items-center gap-1">
          <Save className="w-3 h-3" /> Save this requirement for future use
        </button>
        {templates.length > 0 && (
          <button type="button" onClick={() => setShowManage(s => !s)} className="text-xs font-mono text-muted-foreground hover:underline">
            {showManage ? "Hide templates" : "Manage templates"}
          </button>
        )}
      </div>

      {showSave && (
        <div className="mt-2 flex gap-2">
          <Input value={newTemplateName} onChange={e => setNewTemplateName(e.target.value)} placeholder="Template name" className="text-sm" />
          <Button type="button" size="sm" onClick={saveTemplate}>Save</Button>
        </div>
      )}

      {showManage && templates.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {templates.map(t => (
            <div key={t.id} className="px-3 py-2 rounded-lg bg-secondary/40 border border-border/50">
              {editingId === t.id ? (
                <div className="space-y-2">
                  <Input value={editName} onChange={e => setEditName(e.target.value)} placeholder="Template name" className="text-sm" />
                  <textarea value={editText} onChange={e => setEditText(e.target.value)}
                    className="w-full px-3 py-2 rounded-md border border-white/25 bg-transparent text-sm resize-none h-16 focus:outline-none focus:border-primary" />
                  <div className="flex items-center gap-2">
                    <Button type="button" size="sm" onClick={() => saveEdit(t.id)}>Save</Button>
                    <button type="button" onClick={cancelEdit} className="text-muted-foreground hover:text-foreground">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs truncate">{t.template_name}</span>
                  <div className="flex items-center gap-2 shrink-0">
                    <button type="button" onClick={() => startEdit(t)} className="text-muted-foreground hover:text-primary">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button type="button" onClick={() => deleteTemplate(t.id)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}