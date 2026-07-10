import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { AlertCircle, CheckCircle, Clock, Trash2, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

export default function AdminDataCleanup() {
  const [phase, setPhase] = useState(null); // null | 'preview' | 'executing' | 'complete'
  const [previewData, setPreviewData] = useState(null);
  const [executeData, setExecuteData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handlePreview = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke("adminDataCleanup", { phase: "preview" });
      setPreviewData(res.data);
      setPhase("preview");
    } catch (err) {
      toast.error("Preview failed: " + err.response?.data?.error || err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExecute = async () => {
    setPhase("executing");
    setLoading(true);
    try {
      const res = await base44.functions.invoke("adminDataCleanup", { phase: "execute" });
      setExecuteData(res.data);
      setPhase("complete");
      toast.success(`Cleanup complete! ${res.data.totalDeleted} records deleted.`);
    } catch (err) {
      toast.error("Cleanup failed: " + err.response?.data?.error || err.message);
      setPhase("preview");
    } finally {
      setLoading(false);
      setShowConfirm(false);
    }
  };

  if (!previewData && phase === null) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-6 mb-6">
          <h1 className="text-2xl font-bold text-destructive mb-2">⚠️ Full Test Data Cleanup</h1>
          <p className="text-sm text-muted-foreground mb-4">
            This will DELETE all test data while preserving admin account, integrations, and platform settings.
          </p>
          <ul className="text-xs text-muted-foreground space-y-1 mb-4 ml-4">
            <li>✓ Deleted: All events, orders, organizers, artists, financial records</li>
            <li>✓ Preserved: Admin account, Stripe/Gmail/DO, platform config</li>
            <li>✓ Safe: Cannot delete main admin account</li>
          </ul>
        </div>

        <Button
          onClick={handlePreview}
          disabled={loading}
          size="lg"
          className="w-full"
        >
          <Eye className="w-4 h-4 mr-2" />
          {loading ? "Previewing..." : "Preview Cleanup"}
        </Button>
      </div>
    );
  }

  if (phase === "preview" && previewData) {
    const sortedEntities = Object.entries(previewData.counts).sort(
      ([, a], [, b]) => (b.count || 0) - (a.count || 0)
    );
    const toDelete = sortedEntities.filter(([, { count }]) => count > 0);

    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Cleanup Preview</h1>
          <span className="text-lg font-bold text-muted-foreground">
            Total records: {previewData.total}
          </span>
        </div>

        <div className="grid gap-4 mb-6">
          {/* Admin User */}
          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
            <p className="text-xs font-bold text-green-400 uppercase">PRESERVED</p>
            <p className="text-sm mt-1">Admin: {previewData.adminUser?.email}</p>
          </div>

          {/* Records to Delete */}
          <div className="bg-card border border-destructive/20 rounded-lg p-4">
            <h2 className="font-bold text-sm mb-3">Records to Delete ({toDelete.length})</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-96 overflow-y-auto">
              {toDelete.map(([entity, { label, count, capped }]) => (
                <div key={entity} className="bg-destructive/5 border border-destructive/20 rounded p-3">
                  <p className="text-[11px] font-mono font-bold text-muted-foreground">{entity}</p>
                  <p className="text-lg font-bold text-foreground mt-1">{count}</p>
                  <p className="text-[10px] text-muted-foreground">{label}</p>
                  {capped && <p className="text-[10px] text-yellow-400 mt-1">⚠️ Count capped at 1000</p>}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={() => { setPhase(null); setPreviewData(null); }}
            variant="outline"
          >
            Back
          </Button>
          <Button
            onClick={() => setShowConfirm(true)}
            className="flex-1 bg-destructive hover:bg-destructive/90"
            disabled={toDelete.length === 0}
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Execute Cleanup
          </Button>
        </div>

        {/* Confirmation Dialog */}
        <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Cleanup</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                This will permanently delete <strong>{previewData.total}</strong> test records.
              </p>
              <p className="text-xs text-muted-foreground">
                Admin account and platform settings will be preserved.
              </p>
              <div className="flex gap-2">
                <Button
                  onClick={() => setShowConfirm(false)}
                  variant="outline"
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleExecute}
                  disabled={loading}
                  className="flex-1 bg-destructive hover:bg-destructive/90"
                >
                  {loading ? "Processing..." : "I Understand. Delete Everything"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  if (phase === "executing") {
    return (
      <div className="p-6 max-w-2xl mx-auto text-center">
        <Clock className="w-16 h-16 mx-auto text-primary mb-4 animate-spin" />
        <h1 className="text-2xl font-bold mb-2">Cleanup in Progress</h1>
        <p className="text-muted-foreground">Please wait — processing deletion...</p>
      </div>
    );
  }

  if (phase === "complete" && executeData) {
    const successCount = executeData.results.filter(r => r.status === "ok").length;
    const errorCount = executeData.results.filter(r => r.status === "error").length;

    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-6 mb-6">
          <div className="flex items-start gap-3">
            <CheckCircle className="w-6 h-6 text-green-400 flex-shrink-0 mt-0.5" />
            <div>
              <h1 className="text-2xl font-bold text-green-400 mb-1">Cleanup Complete!</h1>
              <p className="text-sm text-muted-foreground">
                {executeData.totalDeleted} records deleted in {(executeData.durationMs / 1000).toFixed(1)}s
              </p>
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-card border border-border rounded-lg p-4">
            <p className="text-xs font-mono text-muted-foreground uppercase">Total Deleted</p>
            <p className="text-3xl font-bold mt-2">{executeData.totalDeleted}</p>
          </div>
          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
            <p className="text-xs font-mono text-green-400 uppercase">Successful</p>
            <p className="text-3xl font-bold mt-2">{successCount}</p>
          </div>
          <div className={`rounded-lg p-4 border ${errorCount > 0 ? "bg-yellow-500/10 border-yellow-500/30" : "bg-card border-border"}`}>
            <p className="text-xs font-mono text-muted-foreground uppercase">Errors</p>
            <p className="text-3xl font-bold mt-2">{errorCount}</p>
          </div>
        </div>

        {/* Results */}
        <div className="bg-card border border-border rounded-lg p-4 mb-6 max-h-64 overflow-y-auto">
          <h2 className="font-bold text-sm mb-3">Deletion Results</h2>
          <div className="space-y-2">
            {executeData.results.map((r, i) => (
              <div key={i} className="flex justify-between text-xs border-b border-border/30 pb-2">
                <div>
                  <span className="font-mono text-muted-foreground">{r.entity}</span>
                  <p className="text-[10px] text-muted-foreground">{r.label}</p>
                </div>
                <div className="text-right">
                  <span className="font-bold">{r.deleted}</span>
                  <p className={`text-[10px] ${r.status === "ok" ? "text-green-400" : "text-yellow-400"}`}>
                    {r.status === "ok" ? "✓" : "⚠"} {r.error || "OK"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Verification */}
        {executeData.verification && (
          <div className="bg-card border border-border rounded-lg p-4 mb-6">
            <h2 className="font-bold text-sm mb-3">Post-Cleanup Verification</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {Object.entries(executeData.verification).map(([entity, count]) => (
                <div key={entity} className={`rounded p-2 text-center ${count === 0 ? "bg-green-500/10 border border-green-500/30" : "bg-yellow-500/10 border border-yellow-500/30"}`}>
                  <p className="text-[10px] font-mono text-muted-foreground">{entity}</p>
                  <p className={`text-lg font-bold ${count === 0 ? "text-green-400" : "text-yellow-400"}`}>{count}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="text-xs text-muted-foreground text-center">
          Completed: {new Date(executeData.completedAt).toLocaleString()} by {executeData.executedBy}
        </div>
      </div>
    );
  }

  return null;
}