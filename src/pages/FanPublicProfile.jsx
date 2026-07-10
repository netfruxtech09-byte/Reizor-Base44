import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { User, Music2 } from "lucide-react";
import BackButton from "@/components/shared/BackButton";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";

export default function FanPublicProfile() {
  const { id } = useParams();
  const [profile, setProfile] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.functions.invoke("getPublicFanProfile", { userId: id })
      .then(res => setProfile(res.data))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center space-y-4">
          <User className="w-12 h-12 text-muted-foreground mx-auto" />
          <p className="font-display font-bold text-xl">Profile not found</p>
          <p className="text-sm text-muted-foreground">This fan profile is private or doesn't exist.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8 px-4 sm:px-6 max-w-xl mx-auto">
      <BackButton />
      <div className="mt-4 p-6 rounded-2xl bg-card border border-border/50 text-center space-y-4">
        <div className="w-20 h-20 rounded-full bg-primary/10 border-2 border-primary/30 flex items-center justify-center mx-auto">
          <span className="font-display font-black text-3xl text-primary">{profile.full_name[0]?.toUpperCase() || "?"}</span>
        </div>
        <div>
          <h1 className="font-display font-black text-2xl">{profile.full_name}</h1>
          {profile.created_date && (
            <p className="text-xs text-muted-foreground font-mono mt-1">
              Fan since {format(new Date(profile.created_date), "MMM yyyy")}
            </p>
          )}
        </div>
        {profile.preferred_genres?.length > 0 && (
          <div className="pt-3 border-t border-border/30">
            <div className="flex items-center justify-center gap-1.5 mb-2">
              <Music2 className="w-3.5 h-3.5 text-primary" />
              <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Favorite Genres</span>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {profile.preferred_genres.map(g => (
                <span key={g} className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-primary/10 text-primary">
                  {g.replace(/_/g, " ")}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}