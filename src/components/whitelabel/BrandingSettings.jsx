import { useState } from "react";
import { Upload, Globe, Palette, Code2, Image, Link } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

export default function BrandingSettings({ agent, onUpdate }) {
  const [form, setForm] = useState({
    primary_color: agent.primary_color || "#ff1b8d",
    secondary_color: agent.secondary_color || "#1e64ff",
    custom_domain: agent.custom_domain || "",
    custom_css: agent.custom_css || "",
  });
  const [logoUploading, setLogoUploading] = useState(false);
  const [faviconUploading, setFaviconUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);

  const uploadFile = async (file, field, setSaving) => {
    setSaving(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    await base44.entities.WhiteLabel.update(agent.id, { [field]: file_url });
    onUpdate({ [field]: file_url });
    setSaving(false);
    toast.success("Uploaded!");
  };

  const saveSettings = async () => {
    setSaving(true);
    await base44.entities.WhiteLabel.update(agent.id, {
      primary_color: form.primary_color,
      secondary_color: form.secondary_color,
      custom_domain: form.custom_domain,
      custom_css: form.custom_css,
    });
    onUpdate(form);
    setSaving(false);
    toast.success("Branding settings saved!");
  };

  return (
    <div className="space-y-4">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between p-4 rounded-xl bg-card border border-border/50 hover:border-primary/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Palette className="w-5 h-5 text-primary" />
          <div className="text-left">
            <p className="font-display font-bold">Branding & Customization</p>
            <p className="text-xs text-muted-foreground">Logo, colors, domain, custom CSS</p>
          </div>
        </div>
        <span className="text-xs font-mono text-muted-foreground">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="p-5 rounded-xl bg-card border border-border/50 space-y-6">
          {/* Logo & Favicon */}
          <div>
            <h3 className="font-display font-bold text-sm uppercase tracking-wider mb-3 text-muted-foreground flex items-center gap-2">
              <Image className="w-4 h-4" /> Logo & Favicon
            </h3>
            <div className="grid sm:grid-cols-2 gap-4">
              {/* Logo */}
              <div className="space-y-2">
                <p className="text-xs font-mono text-muted-foreground">Brand Logo</p>
                {agent.logo_url && (
                  <img src={agent.logo_url} alt="Logo" className="h-12 w-auto rounded object-contain bg-secondary p-1" />
                )}
                <label className={`flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-border/50 text-xs font-mono text-muted-foreground cursor-pointer hover:border-primary/40 hover:text-primary transition-colors w-full ${logoUploading ? "opacity-50 pointer-events-none" : ""}`}>
                  <Upload className="w-3.5 h-3.5" />
                  {logoUploading ? "Uploading..." : "Upload Logo"}
                  <input type="file" accept="image/*" className="hidden"
                    onChange={e => { if (e.target.files?.[0]) uploadFile(e.target.files[0], "logo_url", setLogoUploading); }}
                    disabled={logoUploading}
                  />
                </label>
              </div>
              {/* Favicon */}
              <div className="space-y-2">
                <p className="text-xs font-mono text-muted-foreground">Favicon (ICO/PNG, 32×32)</p>
                {agent.favicon_url && (
                  <img src={agent.favicon_url} alt="Favicon" className="h-8 w-8 rounded object-contain bg-secondary p-0.5" />
                )}
                <label className={`flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-border/50 text-xs font-mono text-muted-foreground cursor-pointer hover:border-primary/40 hover:text-primary transition-colors w-full ${faviconUploading ? "opacity-50 pointer-events-none" : ""}`}>
                  <Upload className="w-3.5 h-3.5" />
                  {faviconUploading ? "Uploading..." : "Upload Favicon"}
                  <input type="file" accept="image/png,image/x-icon,image/ico" className="hidden"
                    onChange={e => { if (e.target.files?.[0]) uploadFile(e.target.files[0], "favicon_url", setFaviconUploading); }}
                    disabled={faviconUploading}
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Color Scheme */}
          <div>
            <h3 className="font-display font-bold text-sm uppercase tracking-wider mb-3 text-muted-foreground flex items-center gap-2">
              <Palette className="w-4 h-4" /> Color Scheme
            </h3>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <p className="text-xs font-mono text-muted-foreground">Primary Color</p>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={form.primary_color}
                    onChange={e => setForm(f => ({ ...f, primary_color: e.target.value }))}
                    className="w-10 h-10 rounded-lg border border-border/50 cursor-pointer bg-transparent"
                  />
                  <Input
                    value={form.primary_color}
                    onChange={e => setForm(f => ({ ...f, primary_color: e.target.value }))}
                    className="bg-secondary border-border/50 font-mono text-sm"
                    placeholder="#ff1b8d"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-mono text-muted-foreground">Secondary Color</p>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={form.secondary_color}
                    onChange={e => setForm(f => ({ ...f, secondary_color: e.target.value }))}
                    className="w-10 h-10 rounded-lg border border-border/50 cursor-pointer bg-transparent"
                  />
                  <Input
                    value={form.secondary_color}
                    onChange={e => setForm(f => ({ ...f, secondary_color: e.target.value }))}
                    className="bg-secondary border-border/50 font-mono text-sm"
                    placeholder="#1e64ff"
                  />
                </div>
              </div>
            </div>
            {/* Preview swatch */}
            <div className="mt-3 flex gap-2 items-center">
              <div className="h-6 w-16 rounded" style={{ background: form.primary_color }} />
              <div className="h-6 w-16 rounded" style={{ background: form.secondary_color }} />
              <span className="text-xs font-mono text-muted-foreground">Color preview</span>
            </div>
          </div>

          {/* Custom Domain */}
          <div>
            <h3 className="font-display font-bold text-sm uppercase tracking-wider mb-3 text-muted-foreground flex items-center gap-2">
              <Globe className="w-4 h-4" /> Custom Domain
            </h3>
            <Input
              value={form.custom_domain}
              onChange={e => setForm(f => ({ ...f, custom_domain: e.target.value }))}
              placeholder="e.g. music.yourbrand.com"
              className="bg-secondary border-border/50 font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground mt-2">
              Point your domain's CNAME to <span className="font-mono text-accent">app.reizor.com</span> then enter it here.
            </p>
          </div>

          {/* Custom CSS */}
          <div>
            <h3 className="font-display font-bold text-sm uppercase tracking-wider mb-3 text-muted-foreground flex items-center gap-2">
              <Code2 className="w-4 h-4" /> Custom CSS
            </h3>
            <textarea
              value={form.custom_css}
              onChange={e => setForm(f => ({ ...f, custom_css: e.target.value }))}
              placeholder={`:root {\n  /* Override CSS variables here */\n}`}
              rows={6}
              className="w-full rounded-lg border border-border/50 bg-secondary p-3 font-mono text-xs text-foreground resize-y focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <p className="text-xs text-muted-foreground mt-1">Advanced: override CSS variables or add custom styles for your white-label instance.</p>
          </div>

          <Button onClick={saveSettings} disabled={saving} className="w-full glow-lime font-display font-bold">
            {saving ? "Saving..." : "Save Branding Settings"}
          </Button>
        </div>
      )}
    </div>
  );
}