import { useState, useRef } from "react";
import { UserPlus, Link, Mail, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

export default function InviteOrganizerPanel() {
  const [email, setEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [copied, setCopied] = useState(false);
  const inviteAbortRef = useRef(false);

  const joinLink = `${window.location.origin}/?role=organizer&join=1`;

  const copyLink = () => {
    navigator.clipboard.writeText(joinLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Join link copied!");
  };

  const cancelInvite = () => {
    inviteAbortRef.current = true;
    setInviting(false);
    setEmail("");
  };

  const sendInvite = async () => {
    if (!email || !email.includes("@")) return toast.error("Enter a valid email");
    inviteAbortRef.current = false;
    setInviting(true);
    try {
      await base44.functions.invoke("inviteWithCustomEmail", {
        email,
        role: "organizer",
        joinUrl: joinLink,
        customMessage: "Once registered, you'll be able to create events, sell tickets, manage your team, and access powerful analytics. Welcome to the network!",
      });
      if (inviteAbortRef.current) return;
      toast.success(`Invite sent to ${email}`);
      setEmail("");
    } catch (e) {
      if (!inviteAbortRef.current) toast.error("Failed to invite: " + e.message);
    }
    if (!inviteAbortRef.current) setInviting(false);
  };

  return (
    <div className="p-4 rounded-xl bg-card border border-border/50 space-y-4">
      <div className="flex items-center gap-2">
        <UserPlus className="w-4 h-4 text-primary" />
        <h2 className="font-display font-bold text-base">INVITE ORGANIZER</h2>
      </div>

      {/* Send invite by email */}
      <div className="space-y-2">
        <p className="text-xs font-mono text-muted-foreground">Send a personal invite via email — they'll join as an organizer</p>
        <div className="flex gap-2">
          <Input
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === "Enter" && sendInvite()}
            placeholder="organizer@email.com"
            className="bg-secondary border-border/50 text-sm"
          />
          <Button onClick={sendInvite} disabled={inviting} className="gap-1.5 shrink-0 glow-lime font-display font-bold">
            <Mail className="w-3.5 h-3.5" />
            {inviting ? "Sending..." : "Send Invite"}
          </Button>
          {inviting && (
            <Button variant="outline" onClick={cancelInvite} className="shrink-0">Cancel</Button>
          )}
        </div>
      </div>

      {/* Shareable link */}
      <div className="space-y-2">
        <p className="text-xs font-mono text-muted-foreground">Or share this link — anyone who registers via it will be tagged as an organizer</p>
        <div className="flex gap-2 items-center">
          <div className="flex-1 px-3 py-2 rounded-md bg-secondary border border-border/50 text-xs font-mono text-muted-foreground truncate">
            {joinLink}
          </div>
          <Button variant="outline" size="sm" onClick={copyLink} className="gap-1.5 shrink-0">
            {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? "Copied!" : "Copy"}
          </Button>
        </div>
      </div>
    </div>
  );
}