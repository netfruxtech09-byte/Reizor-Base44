import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ExternalLink, Clock } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";

export default function WhiteLabelQuickAccess() {
  const [agents, setAgents] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    Promise.all([
      base44.entities.WhiteLabel.list("-created_date", 20).catch(() => []),
      base44.entities.WhiteLabelFeeProposal.filter({ status: "pending" }, null, 100).catch(() => []),
    ]).then(([wls, proposals]) => {
      setAgents(wls);
      setPendingCount(proposals.length);
    });
  }, []);

  if (agents.length === 0) return null;

  return (
    <div className="space-y-2">
      {pendingCount > 0 && (
        <Link to="/admin/sub-wl" className="flex items-center gap-2 p-3 rounded-xl bg-yellow-400/10 border border-yellow-400/20 hover:border-yellow-400/40 transition-colors">
          <Clock className="w-4 h-4 text-yellow-400 shrink-0" />
          <p className="text-sm font-mono text-yellow-400 font-bold">{pendingCount} pending Sub-WL proposal{pendingCount !== 1 ? "s" : ""} need review</p>
        </Link>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {agents.map(agent => (
          <Link
            key={agent.id}
            to={`/agent-dashboard?id=${agent.id}`}
            className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border/50 hover:border-primary/30 transition-colors group"
          >
            {agent.logo_url ? (
              <img src={agent.logo_url} className="w-8 h-8 rounded-full object-cover shrink-0" alt="" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-sm shrink-0">
                {(agent.brand_name || agent.name || "?")[0]}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="font-bold text-sm truncate">{agent.brand_name || agent.name}</p>
              <p className="text-[10px] font-mono text-muted-foreground truncate">{agent.email}</p>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${agent.is_active !== false ? "text-green-400 bg-green-400/10" : "text-yellow-400 bg-yellow-400/10"}`}>
                {agent.is_active !== false ? "Active" : "Pending"}
              </span>
              <ExternalLink className="w-3 h-3 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}