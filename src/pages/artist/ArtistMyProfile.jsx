import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import ArtistProfile from "@/pages/ArtistProfile";

/**
 * "My Profile" rendered inline inside the Artist Studio dashboard content area
 * (instead of redirecting to the separate public page).
 * Resolves the logged-in artist's own record and embeds their public profile.
 */
export default function ArtistMyProfile() {
  const navigate = useNavigate();
  const [artistId, setArtistId] = useState(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    base44.auth.me().then(async (u) => {
      if (!u) { if (!cancelled) navigate("/", { replace: true }); return; }
      const artists = await base44.entities.Artist.filter({ user_email: u.email }, null, 1).catch(() => []);
      if (cancelled) return;
      if (artists && artists[0]) {
        setArtistId(artists[0].id);
      } else {
        navigate("/artist/signup", { replace: true });
      }
      setChecked(true);
    }).catch(() => { if (!cancelled) { navigate("/", { replace: true }); setChecked(true); } });
    return () => { cancelled = true; };
  }, [navigate]);

  if (!checked || !artistId) {
    return (
      <div className="py-20 flex justify-center">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return <ArtistProfile overrideId={artistId} embedded />;
}