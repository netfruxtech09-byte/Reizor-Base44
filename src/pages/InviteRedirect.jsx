import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Loader2, Link2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function InviteRedirect() {
  const { code } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState("loading"); // loading | valid | invalid | expired | exhausted
  const [link, setLink] = useState(null);

  useEffect(() => {
    if (!code) { setStatus("invalid"); return; }

    // Store invite code for post-registration attribution
    localStorage.setItem("invite_code", code);

    base44.entities.InviteLink.filter({ code }, null, 1)
      .then(async ([found]) => {
        if (!found) { setStatus("invalid"); return; }

        // Check if expired
        if (found.expires_at && new Date(found.expires_at) < new Date()) {
          setStatus("expired");
          setLink(found);
          return;
        }

        // Check if exhausted
        if (found.max_uses > 0 && found.times_used >= found.max_uses) {
          setStatus("exhausted");
          setLink(found);
          return;
        }

        // Check if disabled
        if (found.status !== "active") {
          setStatus("invalid");
          setLink(found);
          return;
        }

        setLink(found);
        setStatus("valid");

        // Increment usage counter only once per browser session (prevents double-counting on refresh)
        const sessionKey = `inv_counted_${code}`;
        if (!sessionStorage.getItem(sessionKey)) {
          sessionStorage.setItem(sessionKey, "1");
          const now = new Date().toISOString();
          await base44.entities.InviteLink.update(found.id, {
            times_used: (found.times_used || 0) + 1,
            last_used_at: now,
            ...(!found.first_used_at ? { first_used_at: now } : {}),
          }).catch(() => {});
        }

        // Check if user is already logged in
        const isAuthed = await base44.auth.isAuthenticated().catch(() => false);
        if (isAuthed) {
          // Attribute the referral to already-logged-in user
          const me = await base44.auth.me().catch(() => null);
          if (me && !me.referred_by_email) {
            await base44.auth.updateMe({
              referred_by_email: found.created_by_email,
              referred_by_name: found.created_by_name || found.created_by_email,
              referred_by_role: found.created_by_role || "admin",
            }).catch(() => {});
          }
          // Redirect to home after short delay
          setTimeout(() => navigate("/"), 1500);
        } else {
          // Redirect to login/register with referral context
          setTimeout(() => {
            base44.auth.redirectToLogin(window.location.origin + `/?inv=${code}`);
          }, 1500);
        }
      })
      .catch(() => setStatus("invalid"));
  }, [code]);

  if (status === "loading") return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <Loader2 className="w-8 h-8 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground font-mono">Validating invite link…</p>
    </div>
  );

  if (status === "valid") return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-center px-4">
      <div className="w-16 h-16 rounded-full bg-green-400/20 flex items-center justify-center">
        <CheckCircle2 className="w-8 h-8 text-green-400" />
      </div>
      <h1 className="font-display font-black text-2xl">You're In!</h1>
      <p className="text-muted-foreground text-sm">
        Invited by <span className="font-bold text-foreground">{link?.created_by_name || link?.created_by_email}</span>.
        Redirecting you now…
      </p>
      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
    </div>
  );

  if (status === "expired") return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-center px-4">
      <div className="w-16 h-16 rounded-full bg-yellow-400/20 flex items-center justify-center">
        <AlertTriangle className="w-8 h-8 text-yellow-400" />
      </div>
      <h1 className="font-display font-black text-2xl">Link Expired</h1>
      <p className="text-sm text-muted-foreground">This invite link has expired. Please ask for a new one.</p>
      <Button onClick={() => navigate("/")} variant="outline">Go to Home</Button>
    </div>
  );

  if (status === "exhausted") return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-center px-4">
      <div className="w-16 h-16 rounded-full bg-destructive/20 flex items-center justify-center">
        <AlertTriangle className="w-8 h-8 text-destructive" />
      </div>
      <h1 className="font-display font-black text-2xl">Link No Longer Available</h1>
      <p className="text-sm text-muted-foreground">This invite link has reached its maximum uses. Please ask for a new one.</p>
      <Button onClick={() => navigate("/")} variant="outline">Go to Home</Button>
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-center px-4">
      <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
        <Link2 className="w-8 h-8 text-muted-foreground" />
      </div>
      <h1 className="font-display font-black text-2xl">Invalid Invite Link</h1>
      <p className="text-sm text-muted-foreground">This invite link is not valid or has been disabled.</p>
      <Button onClick={() => navigate("/")} variant="outline">Go to Home</Button>
    </div>
  );
}