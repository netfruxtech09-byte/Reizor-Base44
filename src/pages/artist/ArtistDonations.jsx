import { useState, useEffect } from "react";
import { DollarSign, Info } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";

export default function ArtistDonations() {
  const [donations, setDonations] = useState([]);
  const [artist, setArtist] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.auth.me().then(async (user) => {
      const artists = await base44.entities.Artist.filter({ user_email: user.email }, null, 1);
      if (!artists[0]) { setLoading(false); return; }
      setArtist(artists[0]);
      const d = await base44.entities.ArtistDonation.filter({ artist_id: artists[0].id }, "-created_date", 200);
      setDonations(d);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;

  const completed = donations.filter(d => d.status === "completed");
  const totalGross = completed.reduce((s, d) => s + (d.amount || 0), 0);
  const totalFee = completed.reduce((s, d) => s + (d.platform_fee || 0), 0);
  const totalNet = completed.reduce((s, d) => s + (d.net_amount || 0), 0);

  return (
    <div className="space-y-6">
      <h1 className="font-display font-black text-2xl sm:text-3xl tracking-tight">DONATIONS</h1>

      {/* Fee notice */}
      <div className="flex items-start gap-3 p-4 rounded-xl bg-accent/10 border border-accent/20">
        <Info className="w-4 h-4 text-accent mt-0.5 shrink-0" />
        <p className="text-sm text-muted-foreground">
          Reizor collects a <span className="font-bold text-foreground">10% platform fee</span> on all donations.
          Payments are processed through Reizor's Stripe system and deposited to your account.
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Gross Total", value: `$${totalGross.toFixed(2)}`, color: "text-foreground" },
          { label: "Platform Fee (10%)", value: `-$${totalFee.toFixed(2)}`, color: "text-destructive" },
          { label: "Net Earnings", value: `$${totalNet.toFixed(2)}`, color: "text-green-400" },
        ].map(({ label, value, color }) => (
          <div key={label} className="p-4 rounded-xl bg-card border border-border/50 text-center">
            <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
            <p className={`font-display font-black text-xl mt-1 ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {donations.length === 0 ? (
        <div className="text-center py-20 bg-card rounded-xl border border-border/50">
          <DollarSign className="w-10 h-10 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-muted-foreground">No donations received yet</p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden sm:block rounded-xl bg-card border border-border/50 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left p-3 font-mono text-[10px] text-muted-foreground uppercase">Date</th>
                    <th className="text-left p-3 font-mono text-[10px] text-muted-foreground uppercase">From</th>
                    <th className="text-left p-3 font-mono text-[10px] text-muted-foreground uppercase">Message</th>
                    <th className="text-left p-3 font-mono text-[10px] text-muted-foreground uppercase">Gross</th>
                    <th className="text-left p-3 font-mono text-[10px] text-muted-foreground uppercase">Net</th>
                    <th className="text-left p-3 font-mono text-[10px] text-muted-foreground uppercase">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {donations.map((d) => (
                    <tr key={d.id} className="border-b border-border/30 last:border-0">
                      <td className="p-3 font-mono text-xs text-muted-foreground whitespace-nowrap">{format(new Date(d.created_date), "MMM d, yyyy")}</td>
                      <td className="p-3 font-medium">{d.donor_name || "Anonymous"}</td>
                      <td className="p-3 text-xs text-muted-foreground italic max-w-[160px] truncate">{d.message || "—"}</td>
                      <td className="p-3 font-mono font-bold whitespace-nowrap">${d.amount?.toFixed(2)}</td>
                      <td className="p-3 font-mono font-bold text-green-400 whitespace-nowrap">${d.net_amount?.toFixed(2)}</td>
                      <td className="p-3">
                        <span className={`font-mono text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                          d.status === "completed" ? "text-green-400 bg-green-400/10" :
                          d.status === "failed" ? "text-destructive bg-destructive/10" :
                          "text-yellow-400 bg-yellow-400/10"
                        }`}>{d.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {/* Mobile cards */}
          <div className="sm:hidden space-y-3">
            {donations.map((d) => (
              <div key={d.id} className="p-4 rounded-xl bg-card border border-border/50 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium truncate">{d.donor_name || "Anonymous"}</p>
                  <span className={`font-mono text-[10px] font-bold uppercase px-2 py-0.5 rounded shrink-0 ${
                    d.status === "completed" ? "text-green-400 bg-green-400/10" :
                    d.status === "failed" ? "text-destructive bg-destructive/10" :
                    "text-yellow-400 bg-yellow-400/10"
                  }`}>{d.status}</span>
                </div>
                {d.message && <p className="text-xs text-muted-foreground italic">"{d.message}"</p>}
                <div className="flex items-center justify-between text-xs font-mono text-muted-foreground">
                  <span>{format(new Date(d.created_date), "MMM d, yyyy")}</span>
                  <div className="flex gap-3">
                    <span>Gross: ${d.amount?.toFixed(2)}</span>
                    <span className="text-green-400 font-bold">Net: ${d.net_amount?.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}