import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { AlertTriangle, RefreshCw, Trash2, Shield, Wifi, CreditCard, Upload, HardDrive, KeyRound, Play, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

const TYPE_CONFIG = {
  api_error:       { label: "API Error",    icon: Wifi,           color: "text-blue-400 border-blue-400/30 bg-blue-400/10" },
  payment_error:   { label: "Payment",       icon: CreditCard,     color: "text-red-400 border-red-400/30 bg-red-400/10" },
  streaming_error: { label: "Streaming",     icon: Play,           color: "text-purple-400 border-purple-400/30 bg-purple-400/10" },
  storage_error:   { label: "Storage",       icon: HardDrive,      color: "text-orange-400 border-orange-400/30 bg-orange-400/10" },
  auth_error:      { label: "Auth",          icon: KeyRound,       color: "text-yellow-400 border-yellow-400/30 bg-yellow-400/10" },
  upload_error:    { label: "Upload",        icon: Upload,         color: "text-cyan-400 border-cyan-400/30 bg-cyan-400/10" },
  billing_error:   { label: "Billing",       icon: Zap,            color: "text-pink-400 border-pink-400/30 bg-pink-400/10" },
};

export default function AdminCrashLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [typeFilter, setTypeFilter] = useState("all");

  const load = async () => {
    setLoading(true);
    const data = await base44.entities.AppErrorLog.list("-created_date", 200).catch(() => []);
    setLogs(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = logs.filter(l => {
    if (typeFilter !== "all" && l.error_type !== typeFilter) return false;
    return true;
  });

  const handleDelete = async (id) => {
    await base44.entities.AppErrorLog.delete(id);
    setLogs(prev => prev.filter(l => l.id !== id));
  };

  const handleClearAll = async () => {
    if (!confirm(`Delete all ${filtered.length} log entries?`)) return;
    await Promise.all(filtered.map(l => base44.entities.AppErrorLog.delete(l.id)));
    setLogs(prev => prev.filter(l => !filtered.find(f => f.id === l.id)));
  };

  const typeCounts = {};
  logs.forEach(l => {
    const t = l.error_type || "api_error";
    typeCounts[t] = (typeCounts[t] || 0) + 1;
  });

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display font-black text-2xl tracking-tight flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" /> System Logs
          </h1>
          <p className="text-xs font-mono text-muted-foreground mt-1">Business-relevant platform events & operational alerts</p>
        </div>
        <div className="flex gap-2">
          {filtered.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleClearAll} className="gap-1.5 text-destructive hover:bg-destructive/10">
              <Trash2 className="w-3.5 h-3.5" /> Clear All
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-2">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
      </div>

      {/* Type summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2">
        <button
          onClick={() => setTypeFilter("all")}
          className={`p-3 rounded-xl border text-left transition-all ${typeFilter === "all" ? "bg-primary/10 border-primary" : "bg-card border-border/50 hover:border-primary/30"}`}
        >
          <p className="font-mono text-[10px] uppercase text-muted-foreground">All</p>
          <p className="font-display font-black text-xl">{logs.length}</p>
        </button>
        {Object.entries(TYPE_CONFIG).map(([key, cfg]) => {
          const Icon = cfg.icon;
          const count = typeCounts[key] || 0;
          return (
            <button
              key={key}
              onClick={() => setTypeFilter(typeFilter === key ? "all" : key)}
              className={`p-3 rounded-xl border text-left transition-all ${typeFilter === key ? `${cfg.color} border-current` : "bg-card border-border/50 hover:border-primary/30"}`}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <Icon className="w-3 h-3" />
                <p className="font-mono text-[10px] uppercase text-muted-foreground">{cfg.label}</p>
              </div>
              <p className="font-display font-black text-xl">{count}</p>
            </button>
          );
        })}
      </div>

      {/* Type filters */}
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setTypeFilter("all")}
          className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold border transition-all ${typeFilter === "all" ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border/50 text-muted-foreground"}`}>
          ALL
        </button>
        {Object.keys(TYPE_CONFIG).map(t => (
          <button key={t} onClick={() => setTypeFilter(typeFilter === t ? "all" : t)}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold border transition-all ${typeFilter === t ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border/50 text-muted-foreground"}`}>
            {TYPE_CONFIG[t].label.toUpperCase()}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Shield className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p className="font-mono text-sm">No system logs</p>
          <p className="text-xs mt-1">Business events and operational alerts will appear here</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((log) => {
            const cfg = TYPE_CONFIG[log.error_type] || TYPE_CONFIG.api_error;
            const Icon = cfg.icon;
            const isExpanded = expanded === log.id;
            return (
              <div key={log.id} className={`rounded-xl border-l-2 overflow-hidden bg-card border-border/50 ${cfg.color.split(" ")[1]}`}>
                <div
                  className="p-3 cursor-pointer hover:bg-muted/20 transition-colors"
                  onClick={() => setExpanded(isExpanded ? null : log.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${cfg.color.split(" ")[0]}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-0.5">
                          <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${cfg.color}`}>
                            {cfg.label}
                          </span>
                          <span className="text-[10px] font-mono text-muted-foreground">
                            {log.created_date ? format(new Date(log.created_date), "MMM d, yyyy HH:mm") : "—"}
                          </span>
                        </div>
                        <p className="text-sm font-medium truncate">{log.error_message || "Unknown event"}</p>
                        <div className="flex flex-wrap gap-3 mt-0.5 text-[10px] font-mono text-muted-foreground">
                          {log.route_url && <span>📄 {log.route_url}</span>}
                          {log.user_email && <span>👤 {log.user_email}</span>}
                          {log.platform && <span>📱 {log.platform}</span>}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(log.id); }}
                      className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {isExpanded && log.error_stack && (
                  <div className="border-t border-border/50 p-3 space-y-2 bg-background/50">
                    <div>
                      <p className="font-mono text-[10px] text-muted-foreground uppercase mb-1">Details</p>
                      <pre className="text-[10px] font-mono bg-card rounded-lg p-3 overflow-x-auto text-muted-foreground whitespace-pre-wrap break-all border border-border/50 max-h-48 overflow-y-auto">
                        {log.error_stack}
                      </pre>
                    </div>
                    {log.extra_context && (
                      <div>
                        <p className="font-mono text-[10px] text-muted-foreground uppercase mb-1">Context</p>
                        <p className="text-[10px] font-mono text-muted-foreground">{log.extra_context}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}