import { useState, useEffect } from "react";
import { ArrowLeft, BarChart3, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";

export default function AdminPollDetail({ poll, onBack, STATUS_BADGE }) {
  const [votes, setVotes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.entities.PollVote.filter({ poll_id: poll.id }, "-created_date", 1000)
      .then(v => { setVotes(v); setLoading(false); })
      .catch(() => setLoading(false));
  }, [poll.id]);

  const options = poll.options?.length > 0 ? poll.options : [poll.option_a, poll.option_b].filter(Boolean);
  const voteCounts = options.map((_, i) => {
    if (poll.vote_counts?.length > 0) return poll.vote_counts[i] || 0;
    if (i === 0) return poll.votes_a || 0;
    if (i === 1) return poll.votes_b || 0;
    return 0;
  });
  const totalVotes = poll.total_votes || voteCounts.reduce((s, c) => s + c, 0);
  const maxVotes = Math.max(...voteCounts, 1);

  const exportCSV = () => {
    const rows = [["Voter Email", "Voter Name", "Choice", "Voted At"]];
    votes.forEach(v => rows.push([v.voter_email, v.voter_name || "", v.choice || "", v.created_date ? format(new Date(v.created_date), "yyyy-MM-dd HH:mm") : ""]));
    const csv = rows.map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `poll-votes-${poll.id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 max-w-4xl w-full">
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={onBack} className="p-2 rounded-lg hover:bg-muted transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1">
          <h1 className="font-display font-black text-xl line-clamp-2">{poll.question}</h1>
          <p className="text-muted-foreground text-sm">{poll.event_title}</p>
        </div>
        <span className={`text-xs font-mono font-bold uppercase px-3 py-1 rounded-full ${STATUS_BADGE[poll.status] || STATUS_BADGE.upcoming}`}>
          {poll.status}
        </span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Votes", value: totalVotes },
          { label: "Options", value: options.length },
          { label: "Multiple Select", value: poll.allow_multiple ? "Yes" : "No" },
          { label: "Show Results", value: poll.show_results_immediately ? "Immediately" : "After end" },
        ].map(({ label, value }) => (
          <div key={label} className="p-4 rounded-xl bg-card border border-border/50 text-center">
            <p className="font-mono text-[10px] text-muted-foreground uppercase">{label}</p>
            <p className="font-display font-black text-xl mt-1">{value}</p>
          </div>
        ))}
      </div>

      {/* Results chart */}
      <div className="bg-card border border-border/50 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-bold text-sm flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-accent" /> RESULTS
          </h2>
          <span className="text-xs font-mono text-muted-foreground">{totalVotes} total votes</span>
        </div>
        <div className="space-y-3">
          {options.map((opt, i) => {
            const count = voteCounts[i] || 0;
            const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
            const isWinner = count === maxVotes && count > 0;
            return (
              <div key={i} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className={`font-medium ${isWinner ? "text-accent" : ""}`}>{opt}</span>
                  <span className="font-mono text-xs text-muted-foreground">{count} votes ({pct}%)</span>
                </div>
                <div className="h-2.5 rounded-full bg-secondary overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${isWinner ? "bg-accent" : "bg-muted-foreground/40"}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Duration */}
      <div className="text-xs font-mono text-muted-foreground bg-secondary rounded-lg px-4 py-2 w-fit">
        {poll.start_datetime ? format(new Date(poll.start_datetime), "MMM d, yyyy HH:mm") : "—"} → {poll.end_datetime ? format(new Date(poll.end_datetime), "MMM d, yyyy HH:mm") : "—"}
      </div>

      {/* Export */}
      <Button variant="outline" onClick={exportCSV} className="gap-2" disabled={votes.length === 0}>
        <Download className="w-4 h-4" /> Export Votes CSV
      </Button>

      {/* Votes table */}
      <div className="space-y-3">
        <h2 className="font-display font-bold text-lg">VOTERS ({votes.length})</h2>
        <div className="bg-card rounded-xl border border-border/50 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <div className="w-6 h-6 border-4 border-muted border-t-accent rounded-full animate-spin" />
            </div>
          ) : votes.length === 0 ? (
            <p className="text-center py-10 text-muted-foreground text-sm">No votes yet</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50">
                    {["Name", "Email", "Choice", "Voted At"].map(h => (
                      <th key={h} className="text-left p-3 font-mono text-[10px] text-muted-foreground uppercase tracking-wider">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {votes.slice(0, 100).map(vote => (
                    <tr key={vote.id} className="border-b border-border/30 last:border-0 hover:bg-muted/10">
                      <td className="p-3 text-xs font-medium">{vote.voter_name || "—"}</td>
                      <td className="p-3 text-xs text-muted-foreground">{vote.voter_email}</td>
                      <td className="p-3 text-xs">
                        {vote.choice_index !== undefined && options[vote.choice_index]
                          ? options[vote.choice_index]
                          : vote.choice || "—"}
                      </td>
                      <td className="p-3 font-mono text-[10px] text-muted-foreground">
                        {vote.created_date ? format(new Date(vote.created_date), "MMM dd, yyyy HH:mm") : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {votes.length > 100 && (
                <p className="text-center py-3 text-xs text-muted-foreground border-t border-border/30">
                  Showing 100 of {votes.length} votes — export CSV for full list
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}