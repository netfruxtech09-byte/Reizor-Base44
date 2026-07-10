import { useState } from "react";
import { Link2, Copy, Check, Music, Users, UserPlus, Ticket, Mail, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { getAppUrl } from "@/lib/appUrl";

const INVITE_CONFIGS = [
  { role: "artist",   icon: Music,    label: "Artist",        signupPath: "/artist/signup",    color: "text-pink-400",   bg: "bg-pink-400/10" },
  { role: "user",     icon: Users,    label: "Fan",           signupPath: "/",                 color: "text-green-400",  bg: "bg-green-400/10" },
  { role: "organizer",icon: UserPlus, label: "Organizer",     signupPath: "/organizer/signup", color: "text-accent",     bg: "bg-accent/10" },
  { role: "manager",  icon: Ticket,   label: "Ticket Seller", signupPath: "/organizer/signup", color: "text-yellow-400", bg: "bg-yellow-400/10" },
];

function QuickLinkItem({ config, compact }) {
  const [link, setLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [sending, setSending] = useState(false);

  const buildLink = async () => {
    if (link) return link;
    const user = await base44.auth.me().catch(() => null);
    const refCode = user ? `${config.role}_${user.id.slice(-8)}` : `${config.role}_${Date.now().toString(36)}`;
    const url = getAppUrl(`${config.signupPath}?ref=${refCode}&invited_by=${encodeURIComponent(user?.email || "")}`);
    setLink(url);
    return url;
  };

  const copyLink = async () => {
    setGenerating(true);
    const url = await buildLink();
    setGenerating(false);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success(`Invite link copied!`);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  const sendEmail = async () => {
    if (!emailInput.trim()) return toast.error("Enter an email address");
    setSending(true);
    const url = await buildLink();
    try {
      const user = await base44.auth.me().catch(() => null);
      const inviterName = user?.full_name || user?.email || "Reizor";
      await base44.functions.invoke("inviteWithCustomEmail", {
        email: emailInput.trim(),
        role: config.role,
        joinUrl: url,
        customMessage: inviterName,
      });
      toast.success(`Invite sent to ${emailInput.trim()}`);
      setEmailInput("");
    } catch {
      toast.error("Failed to send email");
    }
    setSending(false);
  };

  if (compact) {
    return (
      <button
        onClick={copyLink}
        disabled={generating}
        className="flex items-center gap-2 px-3 py-2.5 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors w-full text-left"
      >
        <config.icon className="w-4 h-4 shrink-0" />
        <span className="flex-1">Invite {config.label}</span>
        {generating ? (
          <span className="text-[10px] font-mono text-muted-foreground animate-pulse shrink-0">Copying...</span>
        ) : copied ? (
          <span className="flex items-center gap-1 text-[10px] font-mono text-green-400 shrink-0">
            <Check className="w-3 h-3" />Copied!
          </span>
        ) : (
          <Copy className="w-3 h-3 shrink-0 opacity-40" />
        )}
      </button>
    );
  }

  return (
    <div className="p-4 rounded-xl bg-card border border-border/50 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className={`w-8 h-8 rounded-lg ${config.bg} flex items-center justify-center shrink-0`}>
          <config.icon className={`w-4 h-4 ${config.color}`} />
        </div>
        <p className="font-display font-bold text-sm">Invite {config.label}</p>
      </div>

      {/* Email input — always visible */}
      <div className="flex gap-2">
        <input
          type="email"
          placeholder={`${config.label.toLowerCase()}@email.com`}
          value={emailInput}
          onChange={e => setEmailInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && sendEmail()}
          className="flex-1 h-9 px-3 rounded-md border border-input bg-background text-sm font-mono placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
        <Button size="sm" onClick={sendEmail} disabled={sending} className="gap-1.5 shrink-0">
          <Send className="w-3.5 h-3.5" />
          {sending ? "Sending..." : "Send"}
        </Button>
      </div>

      {/* Copy link */}
      <button
        onClick={copyLink}
        disabled={generating}
        className="text-xs font-semibold text-muted-foreground flex items-center gap-2 px-3 py-2 rounded-lg border border-border/50 bg-secondary hover:bg-secondary/80 transition-colors w-full"
      >
        {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Link2 className="w-3.5 h-3.5" />}
        {generating ? "Generating..." : copied ? "Copied!" : "Copy Invite Link"}
      </button>
    </div>
  );
}

export default function QuickLinks({ compact = false }) {
  if (compact) {
    return (
      <div className="space-y-0.5">
        <div className="px-3 py-1.5 text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Quick Links</div>
        {INVITE_CONFIGS.map(config => (
          <QuickLinkItem key={config.role} config={config} compact />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Mail className="w-4 h-4 text-primary" />
        <h2 className="font-display font-bold text-base section-title">Send Invites</h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {INVITE_CONFIGS.map(config => (
          <QuickLinkItem key={config.role} config={config} />
        ))}
      </div>
    </div>
  );
}