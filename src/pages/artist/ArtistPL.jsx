import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import PLReport from "../../components/reports/PLReport";

export default function ArtistPL() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [artist, setArtist] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const user = await base44.auth.me();
        const artists = await base44.entities.Artist.filter({ user_email: user.email }, null, 1);
        const a = artists[0];
        setArtist(a);

        if (a) {
          const [donations, raffles, shoutouts, tiers, bookings, expenses, merch] = await Promise.all([
            base44.entities.ArtistDonation.filter({ artist_id: a.id }, "-created_date", 500).catch(() => []),
            base44.entities.ArtistRaffle.filter({ artist_id: a.id }, "-created_date", 500).catch(() => []),
            base44.entities.ShoutoutRequest.filter({ artist_email: a.user_email }, "-created_date", 500).catch(() => []),
            base44.entities.FanSubscription.filter({ artist_email: a.user_email }, "-created_date", 500).catch(() => []),
            base44.entities.ArtistBooking.filter({ artist_email: a.user_email }, "-created_date", 500).catch(() => []),
            base44.entities.Expense.filter({ artist_id: a.id }, "-created_date", 500).catch(() => []),
            base44.entities.MerchOrder.filter({ artist_email: a.user_email }, "-created_date", 500).catch(() => []),
          ]);

          const txs = [
            ...donations.filter((d) => d.status === "completed").map((d) => ({
              id: d.id,
              created_date: d.created_date,
              transaction_type: "donation",
              amount: d.net_amount || 0,
              description: `Donation from ${d.donor_name || "Anonymous"}`,
            })),
            ...shoutouts.filter((s) => s.status === "completed").map((s) => ({
              id: s.id,
              created_date: s.created_date,
              transaction_type: "shoutout",
              amount: s.net_amount || 0,
              description: `Shoutout`,
            })),
            ...tiers.filter((t) => t.status === "active").map((t) => ({
              id: t.id,
              created_date: t.started_at,
              transaction_type: "fan_tier",
              amount: t.amount || 0,
              description: `${t.tier_name} tier from ${t.fan_name}`,
            })),
            ...bookings.filter((b) => b.status === "accepted").map((b) => ({
              id: b.id,
              created_date: b.created_date,
              transaction_type: "booking",
              amount: b.budget || 0,
              description: `Booking for ${b.event_title || "event"}`,
            })),
            ...merch.filter((m) => m.status === "completed").map((m) => ({
              id: m.id,
              created_date: m.created_date,
              transaction_type: "merch_sale",
              amount: m.artist_payout || 0,
              description: `Merch sale - ${m.quantity || 1} items`,
            })),
            ...expenses.map((e) => ({
              id: e.id,
              created_date: e.created_date,
              transaction_type: "expense",
              amount: -(e.amount || 0),
              description: e.description || "Expense",
            })),
          ];

          setTransactions(txs);
        }
      } catch (error) {
        console.error("Error fetching P&L data:", error);
      }
      setLoading(false);
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!artist) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">No artist profile found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="font-display font-black text-3xl tracking-tight">MY P&L</h1>
        <p className="text-sm text-muted-foreground mt-1">Your earnings and expenses</p>
      </div>
      <PLReport transactions={transactions} title="Artist Profit & Loss" />
    </div>
  );
}