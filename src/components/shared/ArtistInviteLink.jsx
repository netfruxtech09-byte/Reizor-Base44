import { useState } from "react";
import { Music, Copy, Check, Mail, Link as LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { getAppUrl } from "@/lib/appUrl";

/**
 * ArtistInviteLink — generates a shareable artist signup invite link.
 * Works for both admins and organizers.
 * The link directs recipients to /artist/signup with a ?ref= code
 * so the platform can track who invited them.
 */
export default function ArtistInviteLink({ compact = false }) {
  const [link, setLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [sending, setSending] = useState(false);
  const [showEmail, setShowEmail] = useState(false);

  const generateLink = async () => {
    if (link) return; // already generated
    setGenerating(true);
    const user = await base44.auth.me().catch(() => null);
    const refCode = user ? `artist_${user.id.slice(-8)}` : `artist_${Date.now().toString(36)}`;
    const url = getAppUrl(`/artist/signup?ref=${refCode}&invited_by=${encodeURIComponent(user?.email || "")}`);
    setLink(url);
    setGenerating(false);
  };

  const copyLink = async () => {
    if (!link) await generateLink();
    try {
      await navigator.clipboard.writeText(link || "");
      setCopied(true);
      toast.success("Invite link copied!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  const sendEmail = async () => {
    if (!emailInput.trim()) return toast.error("Enter an email address");
    if (!link) await generateLink();
    setSending(true);
    try {
      const user = await base44.auth.me().catch(() => null);
      const inviterName = user?.full_name || user?.email || "Reizor";
      await base44.functions.invoke("inviteWithCustomEmail", {
        email: emailInput.trim(),
        role: "artist",
        joinUrl: link,
        customMessage: inviterName,
      });
      toast.success(`Invite sent to ${emailInput.trim()}`);
      setEmailInput("");
    } catch {
      toast.error("Failed to send email. Please copy the invite link and share it manually.");
    }
    setSending(false);
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          className="gap-1.5 border-primary bg-primary text-white hover:bg-primary/90"
          onClick={async () => {
            await generateLink();
            copyLink();
          }}
          disabled={generating}
        >
          <LinkIcon className="w-3.5 h-3.5" />
          {generating ? "Generating..." : "Copy Artist Invite Link"}
        </Button>
      </div>
    );
  }

  return (
    <div className="p-5 rounded-xl bg-card border border-border/50 space-y-4">
      <div className="flex items-center gap-2">
        <Music className="w-4 h-4 text-primary" />
        <h3 className="font-display font-bold text-sm uppercase tracking-wider">Invite an Artist</h3>
      </div>
      <p className="text-sm text-foreground font-mono">
        Generate a unique invite link to share with artists. They'll be directed to the artist signup page and tracked back to you.
      </p>

      {/* Link display */}
      <div className="space-y-2">
        {!link ? (
          <Button
            onClick={generateLink}
            disabled={generating}
            className="w-full glow-lime font-display font-bold gap-2"
          >
            <LinkIcon className="w-4 h-4" />
            {generating ? "Generating..." : "Generate Invite Link"}
          </Button>
        ) : (
          <div className="flex gap-2">
            <div className="flex-1 px-3 py-2 rounded-lg bg-secondary border border-border/50 text-xs font-mono text-muted-foreground truncate">
              {link}
            </div>
            <Button
              size="sm"
              variant="outline"
              className="shrink-0 gap-1.5"
              onClick={copyLink}
            >
              {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "Copied!" : "Copy"}
            </Button>
          </div>
        )}
      </div>

      {/* Email option */}
      {link && (
        <div className="space-y-2">
          <button
            onClick={() => setShowEmail(v => !v)}
            className="text-base font-semibold text-foreground flex items-center gap-2 px-3 py-2 rounded-lg border border-border/50 bg-secondary hover:bg-secondary/80 transition-colors"
          >
            <Mail className="w-4 h-4" />
            {showEmail ? "Hide email form" : "Send via email"}
          </button>
          {showEmail && (
            <div className="flex gap-2">
              <input
                type="email"
                placeholder="artist@email.com"
                value={emailInput}
                onChange={e => setEmailInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && sendEmail()}
                className="flex-1 h-9 px-3 rounded-md border border-input bg-background text-sm font-mono placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
              <Button size="sm" onClick={sendEmail} disabled={sending} className="gap-1.5 shrink-0">
                <Mail className="w-3.5 h-3.5" />
                {sending ? "Sending..." : "Send"}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}