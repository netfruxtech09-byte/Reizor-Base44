import { CheckCircle2 } from "lucide-react";

export default function PollOptions({ options, localVoteCounts, showResults, totalVotes, myVotes, hasVoted, isActive, voting, user, handleVote }) {
  return (
    <>
      {options.map((option, i) => {
        const count = localVoteCounts[i] || 0;
        const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
        const voted = myVotes.includes(String(i));
        return (
          <button
            key={i}
            onClick={() => handleVote(i)}
            disabled={!!hasVoted || !isActive || voting || !user}
            className={`w-full text-left rounded-xl border p-4 transition-all relative overflow-hidden ${
              voted ? "border-primary bg-primary/10" :
              hasVoted || !isActive ? "border-border/40 cursor-default" :
              "border-border/50 hover:border-primary/50 cursor-pointer"
            }`}
          >
            {showResults && (
              <div className="absolute inset-y-0 left-0 bg-primary/10 rounded-xl transition-all duration-700" style={{ width: `${pct}%` }} />
            )}
            <div className="relative flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full border border-border/50 flex items-center justify-center text-xs font-mono font-bold shrink-0">
                  {String.fromCharCode(65 + i)}
                </span>
                <span className="font-medium text-sm">{option}</span>
                {voted && <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />}
              </div>
              {showResults && (
                <span className="font-mono font-bold text-sm shrink-0">{pct}%</span>
              )}
            </div>
            {showResults && (
              <p className="text-[10px] font-mono text-muted-foreground mt-1 relative ml-9">{count} vote{count !== 1 ? "s" : ""}</p>
            )}
          </button>
        );
      })}
    </>
  );
}