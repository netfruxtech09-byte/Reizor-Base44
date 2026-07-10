import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Trophy, BarChart3 } from "lucide-react";

export default function EmbedOrganizerRafflesPolls() {
  const params = new URLSearchParams(window.location.search);
  const { id: organizerId } = useParams();
  const theme = params.get("theme") || "dark";
  const [raffles, setRaffles] = useState([]);
  const [polls, setPolls] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const now = new Date().toISOString();
    Promise.all([
      base44.entities.EventRaffle.filter({ organizer_id: organizerId }, "-created_date", 20).catch(() => []),
      base44.entities.EventPoll.filter({ organizer_id: organizerId }, "-created_date", 20).catch(() => []),
    ]).then(([r, p]) => {
      setRaffles(r.filter(x => ["active","upcoming"].includes(x.status) && x.start_datetime <= now && x.end_datetime >= now));
      setPolls(p.filter(x => ["active","upcoming"].includes(x.status) && x.start_datetime <= now && x.end_datetime >= now));
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [organizerId]);

  const isDark = theme !== "light";
  const bg = isDark ? "#0a0d18" : "#ffffff";
  const cardBg = isDark ? "#111827" : "#f9fafb";
  const border = isDark ? "#1e2a3a" : "#e5e7eb";
  const text = isDark ? "#f1f5f9" : "#111827";
  const muted = isDark ? "#94a3b8" : "#6b7280";
  const accent = "#ff1b8d";
  const blue = "#2563eb";

  const items = [
    ...raffles.map(r => ({ ...r, _type: "raffle" })),
    ...polls.map(p => ({ ...p, _type: "poll" })),
  ];

  return (
    <div style={{ background: bg, color: text, fontFamily: "Inter, sans-serif", padding: "16px", minHeight: "100vh", boxSizing: "border-box" }}>
      {loading ? (
        <div style={{ textAlign: "center", padding: "40px", color: muted }}>Loading…</div>
      ) : items.length === 0 ? (
        <div style={{ textAlign: "center", padding: 40 }}>
          <Trophy style={{ width: 32, height: 32, margin: "0 auto 12px", opacity: 0.3 }} />
          <p style={{ color: muted, fontSize: 14 }}>No active raffles or polls</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {items.map(item => (
            <a key={item.id}
              href={`${window.location.origin}/${item._type === "raffle" ? "raffle" : "poll"}/${item.id}`}
              target="_blank" rel="noopener noreferrer"
              style={{ textDecoration: "none", background: cardBg, border: `1px solid ${border}`, borderRadius: 12, padding: "12px 14px", display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: item._type === "raffle" ? `${accent}22` : `${blue}22`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {item._type === "raffle"
                  ? <Trophy style={{ width: 16, height: 16, color: accent }} />
                  : <BarChart3 style={{ width: 16, height: 16, color: blue }} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontWeight: 700, fontSize: 13, color: text, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {item._type === "raffle" ? item.name : item.question}
                </p>
                <p style={{ fontSize: 11, color: muted, margin: "2px 0 0", fontFamily: "monospace" }}>
                  {item._type === "raffle" ? `${item.total_entries || 0} entries · ${item.num_winners} winner(s)` : `${item.total_votes || 0} votes`}
                </p>
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, color: item._type === "raffle" ? accent : blue, background: item._type === "raffle" ? `${accent}22` : `${blue}22`, padding: "3px 7px", borderRadius: 6, flexShrink: 0, fontFamily: "monospace", textTransform: "uppercase" }}>
                {item._type === "raffle" ? "Enter" : "Vote"}
              </span>
            </a>
          ))}
        </div>
      )}
      <div style={{ textAlign: "center", marginTop: 10 }}>
        <a href={window.location.origin} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10, color: muted, textDecoration: "none", fontFamily: "monospace" }}>
          Powered by Reizor
        </a>
      </div>
    </div>
  );
}