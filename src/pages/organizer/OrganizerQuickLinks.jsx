import { useState, useEffect } from "react";
import { Link2, Copy, Check, Music, Users, UserPlus, Ticket, Mail, Share2, Globe, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { getAppUrl } from "@/lib/appUrl";

const INVITE_CONFIGS = [
  {
    role: "artist",
    icon: Music,
    label: "Invite Artist",
    signupPath: "/artist/signup",
    color: "text-pink-400",
    bg: "bg-pink-400/10",
    border: "border-pink-400/30",
    description: "Share an invite link with artists. They'll be directed to the artist signup page and tracked back to you.",
  },
  {
    role: "user",
    icon: Users,
    label: "Invite Fan",
    signupPath: "/",
    color: "text-green-400",
    bg: "bg-green-400/10",
    border: "border-green-400/30",
    description: "Invite fans to join the platform. They'll see events from your organizer profile and get notified about your upcoming events.",
  },
  {
    role: "organizer",
    icon: UserPlus,
    label: "Invite Organizer",
    signupPath: "/organizer/signup",
    color: "text-accent",
    bg: "bg-accent/10",
    border: "border-accent/30",
    description: "Bring other event organizers onto the platform. They'll be able to create and manage their own events.",
  },
  {
    role: "manager",
    icon: Ticket,
    label: "Invite Ticket Seller",
    signupPath: "/organizer/signup",
    color: "text-yellow-400",
    bg: "bg-yellow-400/10",
    border: "border-yellow-400/30",
    description: "Invite ticket sellers who can help with ticket distribution and sales for your events.",
  },
];

function PublicPageCard({ user }) {
  const [copied, setCopied] = useState(false);

  if (!user) return null;

  // Determine public page URL and label based on role
  let pageUrl = null;
  let label = "Share Your Public Page";
  let description = "";

  if (user.role === "organizer" || user.role === "admin") {
    pageUrl = getAppUrl(`/organizers/${user.id}`);
    label = "Share Organizer Page";
    description = "Share your public organizer profile so fans can discover your events, follow you, and see your loyalty program.";
  } else if (user.role === "artist") {
    // Try to derive artist page — artist profile uses user.id
    pageUrl = getAppUrl(`/artists/${user.id}`);
    label = "Share Artist Page";
    description = "Share your public artist profile so fans can follow you, view your posts, and book you for events.";
  } else {
    // Fallback for other roles
    pageUrl = getAppUrl(`/organizers/${user.id}`);
    label = "Share Your Public Page";
    description = "Share your public profile page so people can discover and follow you on the platform.";
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(pageUrl);
      setCopied(true);
      toast.success("Page link copied!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy link");
    }
  };

  const shareLink = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: label, url: pageUrl });
      } catch {
        // User cancelled share — no error needed
      }
    } else {
      copyLink();
    }
  };

  return (
    <div className="rounded-xl bg-gradient-to-br from-primary/10 to-accent/5 border border-primary/40 p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
          <Globe className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-display font-bold text-base">{label}</p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{description}</p>
        </div>
      </div>

      {/* URL display */}
      <div className="flex gap-2">
        <div className="flex-1 px-3 py-2 rounded-lg bg-secondary border border-border/50 text-xs font-mono text-muted-foreground truncate select-all">
          {pageUrl}
        </div>
        <a
          href={pageUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 flex items-center justify-center w-9 h-9 rounded-lg border border-border/50 bg-secondary hover:border-primary/40 transition-colors"
          title="Open page"
        >
          <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
        </a>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <Button onClick={copyLink} className="flex-1 font-display font-bold gap-2 glow-lime">
          {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
          {copied ? "Copied!" : "Copy Page Link"}
        </Button>
        {typeof navigator !== "undefined" && navigator.share && (
          <Button onClick={shareLink} variant="outline" className="gap-2 font-display font-bold">
            <Share2 className="w-4 h-4" />
            Share
          </Button>
        )}
      </div>
    </div>
  );
}

function InviteCard({ config }) {
  const [link, setLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [sending, setSending] = useState(false);

  const generateLink = async () => {
    if (link) return;
    setGenerating(true);
    const user = await base44.auth.me().catch(() => null);
    const refCode = user
      ? `${config.role}_${user.id.slice(-8)}`
      : `${config.role}_${Date.now().toString(36)}`;
    const url = getAppUrl(
      `${config.signupPath}?ref=${refCode}&invited_by=${encodeURIComponent(user?.email || "")}`
    );
    setLink(url);
    setGenerating(false);
  };

  const copyLink = async () => {
    if (!link) await generateLink();
    const currentLink = link || "";
    try {
      await navigator.clipboard.writeText(currentLink);
      setCopied(true);
      toast.success(`${config.label} link copied!`);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  const sendEmail = async () => {
    if (!emailInput.trim()) return toast.error("Enter an email address");
    if (!link) await generateLink();
    const currentLink = link || "";
    setSending(true);
    try {
      const user = await base44.auth.me().catch(() => null);
      const inviterName = user?.full_name || user?.email || "Reizor";
      await base44.functions.invoke("inviteWithCustomEmail", {
        email: emailInput.trim(),
        role: config.role,
        joinUrl: currentLink,
        customMessage: inviterName,
      });
      toast.success(`Invite sent to ${emailInput.trim()}`);
      setEmailInput("");
    } catch {
      toast.error("Failed to send email");
    }
    setSending(false);
  };

  return (
    <div className={`rounded-xl bg-card border ${config.border} p-5 space-y-4 hover:border-primary/50 transition-all`}>
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-xl ${config.bg} flex items-center justify-center shrink-0`}>
          <config.icon className={`w-5 h-5 ${config.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-display font-bold text-base">{config.label}</p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{config.description}</p>
        </div>
      </div>

      {/* Actions */}
      {!link ? (
        <Button
          onClick={generateLink}
          disabled={generating}
          className="w-full font-display font-bold gap-2 glow-lime"
        >
          <Link2 className="w-4 h-4" />
          {generating ? "Generating..." : "Generate Invite Link"}
        </Button>
      ) : (
        <div className="space-y-3">
          <div className="flex gap-2">
            <div className="flex-1 px-3 py-2 rounded-lg bg-secondary border border-border/50 text-xs font-mono text-muted-foreground truncate select-all">
              {link}
            </div>
            <Button size="sm" variant="outline" className="shrink-0 gap-1.5" onClick={copyLink}>
              {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "Copied!" : "Copy"}
            </Button>
          </div>
          <button
            onClick={() => setShowEmail((v) => !v)}
            className="text-sm font-semibold text-foreground flex items-center gap-2 px-3 py-2 rounded-lg border border-border/50 bg-secondary hover:bg-secondary/80 transition-colors w-full"
          >
            <Mail className="w-4 h-4" />
            {showEmail ? "Hide email form" : "Send via email"}
          </button>
          {showEmail && (
            <div className="flex gap-2">
              <input
                type="email"
                placeholder="email@example.com"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendEmail()}
                className="flex-1 h-9 px-3 rounded-md border border-input bg-background text-sm font-mono placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
              <Button size="sm" onClick={sendEmail} disabled={sending} className="gap-1.5 shrink-0">
                <Mail className="w-3.5 h-3.5" />
                {sending ? "..." : "Send"}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function OrganizerQuickLinks() {
  const [user, setUser] = useState(null);
  useEffect(() => { base44.auth.me().then(setUser).catch(() => {}); }, []);

  return (
    <div className="space-y-6 mobile-bottom-nav-spacing">
      {/* Page Header */}
      <div>
        <h1 className="font-display font-black text-3xl tracking-tight">QUICK LINKS</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Generate and share invite links for artists, fans, organizers, and ticket sellers.
        </p>
      </div>

      {/* ── Public Page Link — first card, above invite links ── */}
      <PublicPageCard user={user} />

      {/* ── Invite Cards Grid — primary action area at the top ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {INVITE_CONFIGS.map((config) => (
          <InviteCard key={config.role} config={config} />
        ))}
      </div>



      {/* Sharing Tips */}
      <div className="rounded-xl bg-card border border-border/50 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Share2 className="w-4 h-4 text-primary" />
          <h2 className="font-display font-bold text-base">Sharing Tips</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-lg bg-secondary/60 p-3 space-y-1">
            <p className="font-mono text-xs font-bold text-foreground">Copy & Share Anywhere</p>
            <p className="text-[11px] text-muted-foreground">
              Copy the generated link and paste it on social media, messaging apps, or anywhere you connect with your audience.
            </p>
          </div>
          <div className="rounded-lg bg-secondary/60 p-3 space-y-1">
            <p className="font-mono text-xs font-bold text-foreground">Email Directly</p>
            <p className="text-[11px] text-muted-foreground">
              Use the built-in email feature to send personalized invitations directly to specific people you want to invite.
            </p>
          </div>
          <div className="rounded-lg bg-secondary/60 p-3 space-y-1">
            <p className="font-mono text-xs font-bold text-foreground">Track Attribution</p>
            <p className="text-[11px] text-muted-foreground">
              Every signup through your link is tracked back to you, helping you measure your outreach impact.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}