import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";

/**
 * My Profile — sidebar entry that redirects the logged-in artist to their
 * own public profile page (which shows the Edit Profile button for the owner).
 * If the user has no artist record yet, sends them to signup.
 */
export default function MyProfileRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    base44.auth.me().then(async (u) => {
      if (!u) { if (!cancelled) navigate("/", { replace: true }); return; }
      const artists = await base44.entities.Artist.filter({ user_email: u.email }, null, 1).catch(() => []);
      if (cancelled) return;
      if (artists && artists[0]) {
        navigate(`/artists/${artists[0].id}`, { replace: true });
      } else {
        navigate("/artist/signup", { replace: true });
      }
    }).catch(() => { if (!cancelled) navigate("/", { replace: true }); });
    return () => { cancelled = true; };
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
    </div>
  );
}