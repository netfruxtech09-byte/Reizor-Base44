import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { getStorageSettings, clearStorageSettingsCache } from "@/lib/storageSettingsHelper";
import { HardDrive, Loader2, Settings2, Save, RefreshCw, ChevronDown, ChevronUp, Users, User, Clock, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { format } from "date-fns";
import StorageUsersList from "@/components/admin/storage/StorageUsersList";
import StreamingUsersList from "@/components/admin/streaming/StreamingUsersList";

const BYTES_PER_GB = 1_073_741_824;
const CATEGORY_LABELS = {
  event_image: "Event Images",
  event_video: "Event Videos",
  flyer: "Flyers",
  ai_flyer: "AI Flyers (legacy)",
  ai_flyer_upload: "AI Flyer Uploads",
  ai_flyer_generated_image: "AI Generated Images",
  ai_flyer_generated_video: "AI Generated Videos",
  media_library: "Media Library",
  video_360: "360 Videos",
  community: "Community Posts (legacy)",
  community_image: "Community Images",
  community_video: "Community Videos",
  other: "Other",
};

function fmtBytes(b) {
  if (!b) return "0 B";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(1)} MB`;
  return `${(b / BYTES_PER_GB).toFixed(3)} GB`;
}

function fmtGb(gb) {
  return `${gb.toFixed(4)} GB`;
}

export default function AdminStorageUsage() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState({ free_gb: 10, price_per_gb: 0.3, billing_enabled: false });
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSaveSuccess, setSettingsSaveSuccess] = useState(false);
  const [filterMonth, setFilterMonth] = useState(new Date().toISOString().slice(0, 7));
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterSearch, setFilterSearch] = useState("");
  const [userTypeFilter, setUserTypeFilter] = useState("all"); // all, organizer, artist
  const [expandedOrg, setExpandedOrg] = useState(null);
  const [minuteSettings, setMinuteSettings] = useState({
    minute_billing_enabled: false,
    per_minute_rate: 0.0016,
    free_minutes_per_user_monthly: 500,
  });
  const [savingMinuteSettings, setSavingMinuteSettings] = useState(false);
  const [streamingTab, setStreamingTab] = useState(false);
  const [streamingUsers, setStreamingUsers] = useState([]);
  const [loadingStreaming, setLoadingStreaming] = useState(false);
  const [streamingMonthKey, setStreamingMonthKey] = useState(new Date().toISOString().slice(0, 7));
  const [inputErrors, setInputErrors] = useState({});

  const loadData = async () => {
    setLoading(true);
    const recs = await base44.entities.OrganizerStorageRecord.filter({ deleted: false }, "-created_date", 2000).catch(() => []);
    const { freeGb, pricePerGb, billingEnabled } = await getStorageSettings();

    // Fetch minute billing pricing
    const pricingRes = await base44.functions.invoke("videoMinuteBilling", { action: "get_pricing" }).catch(() => null);
    if (pricingRes?.data) {
      setMinuteSettings({
        minute_billing_enabled: pricingRes.data.minute_billing_enabled || false,
        per_minute_rate: pricingRes.data.per_minute_rate || 0.0016,
        free_minutes_per_user_monthly: pricingRes.data.free_minutes_per_user_monthly || 500,
      });
    }

    const markedRecs = recs.map(r => ({
      ...r,
      user_type: r.user_type || "organizer",
    }));
    setRecords(markedRecs);
    setSettings({
      free_gb: freeGb,
      price_per_gb: pricePerGb,
      billing_enabled: billingEnabled,
    });
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const validateStorageSettings = () => {
    const errors = {};
    const freeGb = parseFloat(settings.free_gb);
    const pricePerGb = parseFloat(settings.price_per_gb);
    
    if (isNaN(freeGb) || freeGb < 0) {
      errors.free_gb = "Must be a valid positive number";
    }
    if (isNaN(pricePerGb) || pricePerGb < 0) {
      errors.price_per_gb = "Must be a valid positive number";
    }
    
    setInputErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSaveSettings = async () => {
    if (!validateStorageSettings()) {
      toast.error("Please fix the errors in the form.");
      return;
    }

    setSavingSettings(true);
    try {
      const pairs = [
        { key: "storage_free_gb_per_month", value: String(settings.free_gb), label: "Included GB per account (new users)", category: "storage" },
        { key: "storage_price_per_gb", value: String(settings.price_per_gb), label: "Price per GB (USD)", category: "storage" },
        { key: "storage_billing_enabled", value: String(settings.billing_enabled), label: "Billing enabled", category: "storage" },
      ];
      for (const p of pairs) {
        const existing = await base44.entities.AppSettings.filter({ setting_key: p.key }, null, 1).catch(() => []);
        if (existing[0]) {
          await base44.entities.AppSettings.update(existing[0].id, { setting_value: p.value }).catch(() => {});
        } else {
          await base44.entities.AppSettings.create({ setting_key: p.key, setting_value: p.value, label: p.label, category: p.category }).catch(() => {});
        }
      }
      clearStorageSettingsCache(); // Clear cache so other components fetch updated values
      toast.success("Storage limit updated successfully.");
      setSettingsSaveSuccess(true);
      setInputErrors({});
      setTimeout(() => setSettingsSaveSuccess(false), 3000);
      await loadData();
    } catch (err) {
      toast.error("Failed to save storage settings. Please try again.");
      console.error("Save error:", err);
    } finally {
      setSavingSettings(false);
    }
  };

  const loadStreamingData = async () => {
    setLoadingStreaming(true);
    const monthKey = streamingMonthKey;

    const [plans, logs, pricingRes] = await Promise.all([
      base44.entities.VideoMinutePlan.list("-last_funded_at", 1000).catch(() => []),
      base44.entities.VideoWatchLog.list("-created_date", 2000).catch(() => []),
      base44.functions.invoke("videoMinuteBilling", { action: "get_pricing" }).catch(() => null),
    ]);

    const pricing = pricingRes?.data || { free_minutes_per_user_monthly: 500, per_minute_rate: 0.0016 };
    const freeLimit = pricing.free_minutes_per_user_monthly || 500;
    const rate = pricing.per_minute_rate || 0.0016;

    // Filter logs by month
    const monthLogs = logs.filter(l => l.created_date?.startsWith(monthKey));

    // Aggregate by organizer_id
    const byOrg = {};
    monthLogs.forEach(l => {
      const key = l.organizer_id || l.organizer_email || "unknown";
      if (!byOrg[key]) {
        byOrg[key] = {
          id: key,
          name: l.organizer_name || l.organizer_email || "Unknown",
          email: l.organizer_email || "",
          userType: l.owner_type || "organizer",
          freeUsed: 0,
          paidUsed: 0,
          totalUsed: 0,
          freeLimit,
          freeRemaining: freeLimit,
          billable: 0,
          sessionCount: 0,
          plans: [],
          rate,
        };
      }
      const u = byOrg[key];
      u.totalUsed += l.minutes_watched || 0;
      if (l.is_free) u.freeUsed += l.minutes_watched || 0;
      if (l.is_paid) u.paidUsed += l.minutes_watched || 0;
      u.sessionCount += 1;
    });

    // Calculate derived values
    Object.values(byOrg).forEach(u => {
      u.freeRemaining = Math.max(0, u.freeLimit - u.freeUsed);
      u.billable = Math.max(0, u.totalUsed - u.freeLimit);
      // Attach plans for this organizer
      u.plans = plans.filter(p => p.organizer_id === u.id);
    });

    // Include organizers with plans but no watch logs yet
    plans.forEach(p => {
      const key = p.organizer_id;
      if (!byOrg[key]) {
        byOrg[key] = {
          id: key,
          name: p.organizer_name || p.organizer_email || "Unknown",
          email: p.organizer_email || "",
          userType: p.owner_type || "organizer",
          freeUsed: 0,
          paidUsed: 0,
          totalUsed: 0,
          freeLimit,
          freeRemaining: freeLimit,
          billable: 0,
          sessionCount: 0,
          plans: [],
          rate,
        };
      }
    });

    const sorted = Object.values(byOrg).sort((a, b) => b.totalUsed - a.totalUsed);
    setStreamingUsers(sorted);
    setLoadingStreaming(false);
  };

  useEffect(() => { if (streamingTab) loadStreamingData(); }, [streamingTab, streamingMonthKey]);

  const handleSaveMinuteSettings = async () => {
    setSavingMinuteSettings(true);
    await base44.functions.invoke("videoMinuteBilling", {
      action: "update_pricing",
      minute_billing_enabled: minuteSettings.minute_billing_enabled,
      per_minute_rate: minuteSettings.per_minute_rate,
      free_minutes_per_user_monthly: minuteSettings.free_minutes_per_user_monthly,
    }).catch(() => {});
    // Also sync to AppSettings directly for redundancy
    const pairs = [
      { key: "video_usage_minute_billing_enabled", value: String(minuteSettings.minute_billing_enabled), label: "Enable per-minute billing", category: "video_usage_pricing" },
      { key: "video_usage_per_minute_rate", value: String(minuteSettings.per_minute_rate), label: "Per-minute rate (USD)", category: "video_usage_pricing" },
      { key: "video_usage_free_minutes_per_user_monthly", value: String(minuteSettings.free_minutes_per_user_monthly), label: "Monthly free minutes per user", category: "video_usage_pricing" },
    ];
    for (const p of pairs) {
      const existing = await base44.entities.AppSettings.filter({ setting_key: p.key }, null, 1).catch(() => []);
      if (existing[0]) {
        await base44.entities.AppSettings.update(existing[0].id, { setting_value: p.value }).catch(() => {});
      } else {
        await base44.entities.AppSettings.create({ setting_key: p.key, setting_value: p.value, label: p.label, category: p.category }).catch(() => {});
      }
    }
    setSavingMinuteSettings(false);
    toast.success("Streaming pricing settings saved.");
  };

  // Filter records
  const filtered = records.filter(r => {
    if (filterMonth && r.month_key !== filterMonth) return false;
    if (filterCategory !== "all" && r.file_category !== filterCategory) return false;
    if (userTypeFilter !== "all" && r.user_type !== userTypeFilter) return false;
    if (filterSearch) {
      const search = filterSearch.toLowerCase();
      if (!r.organizer_email?.toLowerCase().includes(search) && !r.organizer_name?.toLowerCase().includes(search)) return false;
    }
    return true;
  });

  // Group by user (organizer/artist) for summary view
  const byUser = {};
  filtered.forEach(r => {
    const key = r.organizer_id || r.organizer_email || "unknown";
    if (!byUser[key]) {
      byUser[key] = {
        name: r.organizer_name || r.organizer_email || "Unknown",
        email: r.organizer_email || "",
        id: key,
        records: [],
        bytes: 0,
        userType: r.user_type || "organizer",
      };
    }
    byUser[key].records.push(r);
    byUser[key].bytes += r.file_size_bytes || 0;
  });
  const userList = Object.values(byUser).sort((a, b) => b.bytes - a.bytes);
  
  // Split by type
  const organizerList = userList.filter(u => u.userType === "organizer");
  const artistList = userList.filter(u => u.userType === "artist");

  // Totals
  const totalBytes = filtered.reduce((s, r) => s + (r.file_size_bytes || 0), 0);
  const totalGb = totalBytes / BYTES_PER_GB;

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display font-black text-5xl tracking-tight">STORAGE USAGE</h1>
          <p className="text-sm text-muted-foreground mt-1">Track all file uploads across all users and categories.</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadData} className="gap-2">
          <RefreshCw className="w-3 h-3" /> Refresh
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Files", value: filtered.length, color: "text-foreground", action: null },
          { label: "Total Size", value: fmtBytes(totalBytes), color: "text-accent", action: null },
          { label: "Total GB", value: fmtGb(totalGb), color: "text-primary", action: null },
          { label: "Users", value: userList.length, color: "text-green-400", action: "users" },
        ].map(c => (
          c.action ? (
            <button
              key={c.label}
              onClick={() => document.getElementById("storage-users-list")?.scrollIntoView({ behavior: "smooth" })}
              className="rounded-xl bg-card border border-border/40 p-3 text-center hover:border-green-400/40 hover:bg-green-400/5 transition-all cursor-pointer group"
            >
              <p className="text-[10px] font-mono text-muted-foreground uppercase group-hover:text-green-400 transition-colors">{c.label} ↓</p>
              <p className={`font-display font-black text-xl ${c.color}`}>{c.value}</p>
            </button>
          ) : (
            <div key={c.label} className="rounded-xl bg-card border border-border/40 p-3 text-center">
              <p className="text-[10px] font-mono text-muted-foreground uppercase">{c.label}</p>
              <p className={`font-display font-black text-xl ${c.color}`}>{c.value}</p>
            </div>
          )
        ))}
      </div>

      {/* Settings */}
      <div className="rounded-xl bg-card border border-border/40 p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-primary" />
          <p className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">Storage Pricing Settings</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-mono text-muted-foreground block mb-1">Included GB per account (new users)</label>
            <Input 
              type="number" 
              step="0.5" 
              min="0" 
              value={settings.free_gb === '' ? '' : settings.free_gb}
              onChange={e => setSettings(s => ({ ...s, free_gb: e.target.value === '' ? '' : parseFloat(e.target.value) }))}
              onBlur={() => {
                if (settings.free_gb === '') {
                  setSettings(s => ({ ...s, free_gb: 0 }));
                }
              }}
              className={`bg-secondary ${inputErrors.free_gb ? 'border-destructive' : 'border-border/50'}`}
            />
            {inputErrors.free_gb && <p className="text-[9px] text-destructive mt-1">{inputErrors.free_gb}</p>}
            <p className="text-[9px] text-muted-foreground mt-1">Total included storage for new accounts. Does not reset monthly. Existing users keep their assigned limit.</p>
          </div>
          <div>
            <label className="text-xs font-mono text-muted-foreground block mb-1">Price per extra GB (USD)</label>
            <Input 
              type="number" 
              step="0.01" 
              min="0" 
              value={settings.price_per_gb === '' ? '' : settings.price_per_gb}
              onChange={e => setSettings(s => ({ ...s, price_per_gb: e.target.value === '' ? '' : parseFloat(e.target.value) }))}
              onBlur={() => {
                if (settings.price_per_gb === '') {
                  setSettings(s => ({ ...s, price_per_gb: 0 }));
                }
              }}
              className={`bg-secondary ${inputErrors.price_per_gb ? 'border-destructive' : 'border-border/50'}`}
            />
            {inputErrors.price_per_gb && <p className="text-[9px] text-destructive mt-1">{inputErrors.price_per_gb}</p>}
          </div>
          <div>
            <label className="text-xs font-mono text-muted-foreground block mb-1">Storage Billing</label>
            <div className="flex items-center gap-2 mt-2">
              <button onClick={() => setSettings(s => ({ ...s, billing_enabled: !s.billing_enabled }))}
                className={`w-10 h-5 rounded-full transition-all relative ${settings.billing_enabled ? "bg-primary" : "bg-muted"}`}>
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${settings.billing_enabled ? "left-5" : "left-0.5"}`} />
              </button>
              <span className={`text-xs font-mono font-bold ${settings.billing_enabled ? "text-primary" : "text-muted-foreground"}`}>
                {settings.billing_enabled ? "Billing Active" : "Disabled (estimates only)"}
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={handleSaveSettings} disabled={savingSettings} size="sm" className="gap-2 font-bold">
            {savingSettings ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
            Save Settings
          </Button>
          {settingsSaveSuccess && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-400/10 border border-green-400/30">
              <span className="text-xs font-mono font-bold text-green-400">✓ Saved successfully</span>
            </div>
          )}
        </div>
      </div>

      {/* Streaming Minute Pricing */}
      <div className="rounded-xl bg-card border border-border/40 p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-accent" />
          <p className="font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">Streaming Minute Pricing</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setMinuteSettings(s => ({ ...s, minute_billing_enabled: !s.minute_billing_enabled }))}
            className={`w-10 h-5 rounded-full transition-all relative ${minuteSettings.minute_billing_enabled ? "bg-accent" : "bg-muted"}`}
          >
            <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${minuteSettings.minute_billing_enabled ? "left-5" : "left-0.5"}`} />
          </button>
          <span className={`text-xs font-mono font-bold ${minuteSettings.minute_billing_enabled ? "text-accent" : "text-muted-foreground"}`}>
            {minuteSettings.minute_billing_enabled ? "ON — per-minute billing active" : "OFF — no streaming charges"}
          </span>
        </div>

        <p className="text-[10px] font-mono text-muted-foreground">
          All video usage is first deducted from monthly free minutes. After that, usage is billed per minute at the configured rate.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-mono text-muted-foreground block mb-1">Per-Minute Rate (USD)</label>
            <Input
              type="number" step="0.0001" min="0"
              value={minuteSettings.per_minute_rate}
              onChange={e => setMinuteSettings(s => ({ ...s, per_minute_rate: parseFloat(e.target.value) || 0 }))}
              className="bg-secondary border-border/50 font-mono"
            />
            <p className="text-[9px] font-mono text-muted-foreground mt-1">
              Admin views are always free. At $0.0016/min = ~$0.10/hour
            </p>
          </div>
          <div>
            <label className="text-xs font-mono text-muted-foreground block mb-1">Monthly Free Minutes per User</label>
            <Input
              type="number" step="10" min="0"
              value={minuteSettings.free_minutes_per_user_monthly}
              onChange={e => setMinuteSettings(s => ({ ...s, free_minutes_per_user_monthly: parseInt(e.target.value) || 0 }))}
              className="bg-secondary border-border/50 font-mono"
            />
            <p className="text-[9px] font-mono text-muted-foreground mt-1">
              Free streaming minutes per organizer/artist each month
            </p>
          </div>
        </div>

        {/* Effective rate preview */}
        {minuteSettings.minute_billing_enabled && minuteSettings.per_minute_rate > 0 && (
          <div className="p-3 rounded-lg bg-accent/8 border border-accent/20">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-xs">
              <div>
                <p className="text-[10px] font-mono text-muted-foreground">Per Minute</p>
                <p className="font-display font-bold text-sm text-accent">${minuteSettings.per_minute_rate.toFixed(4)}</p>
              </div>
              <div>
                <p className="text-[10px] font-mono text-muted-foreground">Per Hour</p>
                <p className="font-display font-bold text-sm text-accent">${(minuteSettings.per_minute_rate * 60).toFixed(3)}</p>
              </div>
              <div>
                <p className="text-[10px] font-mono text-muted-foreground">100 Min</p>
                <p className="font-display font-bold text-sm text-accent">${(minuteSettings.per_minute_rate * 100).toFixed(2)}</p>
              </div>
              <div>
                <p className="text-[10px] font-mono text-muted-foreground">1000 Min</p>
                <p className="font-display font-bold text-sm text-accent">${(minuteSettings.per_minute_rate * 1000).toFixed(2)}</p>
              </div>
            </div>
          </div>
        )}

        <Button onClick={handleSaveMinuteSettings} disabled={savingMinuteSettings} size="sm" className="gap-2 font-bold">
          {savingMinuteSettings ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
          Save Streaming Settings
        </Button>
      </div>

      {/* Streaming Analytics Toggle */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setStreamingTab(!streamingTab)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-mono font-bold transition-all border ${
            streamingTab ? "bg-accent/15 border-accent/40 text-accent" : "bg-card border-border/40 text-muted-foreground hover:border-accent/30"
          }`}
        >
          <Play className="w-4 h-4" />
          Streaming Analytics
          {streamingTab ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>
        {streamingTab && (
          <button
            onClick={loadStreamingData}
            disabled={loadingStreaming}
            className="flex items-center gap-1 px-3 py-1 rounded-lg text-[10px] font-mono font-bold border border-border/40 text-muted-foreground hover:border-accent/30 transition-all"
          >
            <RefreshCw className={`w-3 h-3 ${loadingStreaming ? "animate-spin" : ""}`} />
            Refresh
          </button>
        )}
      </div>

      {streamingTab && (
        <div className="space-y-4">
          {/* Month filter */}
          <div className="flex items-center gap-3">
            <label className="text-[10px] font-mono text-muted-foreground">Month</label>
            <input
              type="month"
              value={streamingMonthKey}
              onChange={e => setStreamingMonthKey(e.target.value)}
              className="h-9 rounded-md bg-secondary border border-border/50 px-3 text-sm text-foreground focus:outline-none focus:border-primary"
            />
          </div>

          {loadingStreaming ? (
            <div className="flex justify-center py-10">
              <div className="w-8 h-8 border-4 border-muted border-t-accent rounded-full animate-spin" />
            </div>
          ) : (
            <StreamingUsersList users={streamingUsers} monthKey={streamingMonthKey} />
          )}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 p-4 rounded-xl bg-card border border-border/40">
        <div>
          <label className="text-[10px] font-mono text-muted-foreground block mb-1">Month</label>
          <input type="month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)}
            className="h-9 rounded-md bg-secondary border border-border/50 px-3 text-sm text-foreground focus:outline-none focus:border-primary" />
        </div>
        <div>
          <label className="text-[10px] font-mono text-muted-foreground block mb-1">Category</label>
          <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}
            className="h-9 rounded-md bg-secondary border border-border/50 px-3 text-sm text-foreground focus:outline-none focus:border-primary">
            <option value="all">All Categories</option>
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] font-mono text-muted-foreground block mb-1">User Type</label>
          <select value={userTypeFilter} onChange={e => setUserTypeFilter(e.target.value)}
            className="h-9 rounded-md bg-secondary border border-border/50 px-3 text-sm text-foreground focus:outline-none focus:border-primary">
            <option value="all">All Users</option>
            <option value="organizer">Organizers only</option>
            <option value="artist">Artists only</option>
            <option value="white_label">White Labels only</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] font-mono text-muted-foreground block mb-1">Search</label>
          <input value={filterSearch} onChange={e => setFilterSearch(e.target.value)}
            placeholder="Name or email..."
            className="h-9 rounded-md bg-secondary border border-border/50 px-3 text-sm text-foreground focus:outline-none focus:border-primary" />
        </div>
      </div>

      {/* User storage list */}
      <div id="storage-users-list" />
      {userList.length === 0 ? (
        <div className="text-center py-16 rounded-xl bg-card border border-border/40">
          <HardDrive className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm font-mono">No storage records found for the selected filters.</p>
        </div>
      ) : (
        <StorageUsersList
          users={userList}
          userType={userTypeFilter === "all" ? "user" : userTypeFilter}
          freeGb={settings.free_gb}
          pricePerGb={settings.price_per_gb}
          billingEnabled={settings.billing_enabled}
        />
      )}
    </div>
  );
}