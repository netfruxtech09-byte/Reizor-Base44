import { useState, useEffect } from "react";
import { BarChart3, Users, DollarSign, TrendingUp } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { format, subDays } from "date-fns";

export default function ArtistAnalytics() {
  const [artist, setArtist] = useState(null);
  const [donations, setDonations] = useState([]);
  const [follows, setFollows] = useState([]);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.auth.me().then(async (user) => {
      const artists = await base44.entities.Artist.filter({ user_email: user.email }, null, 1);
      if (!artists[0]) { setLoading(false); return; }
      setArtist(artists[0]);
      const [d, f, p] = await Promise.all([
        base44.entities.ArtistDonation.filter({ artist_id: artists[0].id }, "-created_date", 200),
        base44.entities.ArtistFollow.filter({ artist_id: artists[0].id }, "-created_date", 500),
        base44.entities.ArtistPost.filter({ artist_id: artists[0].id }, "-created_date", 100),
      ]);
      setDonations(d);
      setFollows(f);
      setPosts(p);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;

  // Build last 7 days donation chart
  const last7 = Array.from({ length: 7 }, (_, i) => {
    const day = subDays(new Date(), 6 - i);
    const label = format(day, "MMM dd");
    const dayStr = format(day, "yyyy-MM-dd");
    const total = donations
      .filter(d => d.status === "completed" && d.created_date?.startsWith(dayStr))
      .reduce((s, d) => s + (d.net_amount || 0), 0);
    return { label, total };
  });

  const totalNet = donations.filter(d => d.status === "completed").reduce((s, d) => s + (d.net_amount || 0), 0);
  const totalComments = posts.reduce((s, p) => s + (p.comment_count || 0), 0);

  return (
    <div className="space-y-6">
      <h1 className="font-display font-black text-3xl tracking-tight">ANALYTICS</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Followers", value: follows.length, icon: Users, color: "text-primary" },
          { label: "Total Posts", value: posts.length, icon: TrendingUp, color: "text-accent" },
          { label: "Total Comments", value: totalComments, icon: BarChart3, color: "text-yellow-400" },
          { label: "Net Earnings", value: `$${totalNet.toFixed(2)}`, icon: DollarSign, color: "text-green-400" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="p-4 rounded-xl bg-card border border-border/50">
            <Icon className={`w-4 h-4 ${color} mb-2`} />
            <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
            <p className={`font-display font-black text-2xl mt-0.5 ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="p-5 rounded-xl bg-card border border-border/50">
        <h2 className="font-display font-bold mb-4">NET DONATIONS — LAST 7 DAYS</h2>
        {last7.every(d => d.total === 0) ? (
          <p className="text-center py-8 text-muted-foreground text-sm">No donations in the last 7 days</p>
        ) : (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={last7}>
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
              <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}