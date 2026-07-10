import { useState, useEffect, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, Loader2, ImageIcon, Video, RefreshCw, Filter, FileText, Music, X, ChevronLeft, ChevronRight, Shield, Bot } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import MediaVideoPlayer from "@/components/media/MediaVideoPlayer";
import ModerationCard from "@/components/admin/ModerationCard";
import ModerationConfirmDialog from "@/components/admin/ModerationConfirmDialog";
import {
  STATUS_CONFIG,
  TONE_CLS_DARK,
  isAutoApproved,
  getActionsForStatus,
  CONFIRM_CONFIG,
  SUCCESS_TOAST,
} from "@/components/admin/moderationActions";

const STATUS_TABS = [
  { value: "pending_review", label: "Pending Review" },
  { value: "approved",       label: "Approved" },
  { value: "rejected",       label: "Rejected" },
  { value: "blocked",        label: "Hidden" },
  { value: "all",            label: "All" },
];

const CONTENT_TABS = [
  { value: "media_items",  label: "Media Library", icon: ImageIcon },
  { value: "artist_posts", label: "Artist Posts",  icon: Music },
  { value: "artist_albums",label: "Artist Albums", icon: ImageIcon },
  { value: "org_posts",    label: "Organizer Posts", icon: FileText },
  { value: "community",    label: "Community Feed", icon: FileText },
];

// ── Full-screen media viewer/lightbox (view-only; actions require an explicit button press) ──
function MediaViewer({ items, startIndex, onClose, onAction }) {
  const [index, setIndex] = useState(startIndex);
  const item = items[index];

  const prev = useCallback(() => setIndex(i => (i - 1 + items.length) % items.length), [items.length]);
  const next = useCallback(() => setIndex(i => (i + 1) % items.length), [items.length]);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, prev, next]);

  if (!item) return null;

  const previewUrl = item.url || item.media_url || item.media_urls?.[0] || item.cover_url;
  const mediaType = item.type || item.media_type || item.media_types?.[0] || "image";
  const isVideo = mediaType === "video";
  const title = item.title || item.caption || item.artist_name || item.organizer_name || "Untitled";
  const uploaderName = item.uploaded_by_name || item.author_name || item.artist_name || item.organizer_name || "—";
  const status = item.approval_status || item.media_approval_status || "pending_review";
  const auto = isAutoApproved(item);
  const actions = getActionsForStatus(status);
  const statusCfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending_review;

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col" onClick={onClose}>
      {/* Top bar */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 bg-black/60 backdrop-blur-sm border-b border-white/10" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={onClose} className="p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors shrink-0">
            <X className="w-4 h-4 text-white" />
          </button>
          <div className="min-w-0">
            <p className="text-white font-bold text-sm truncate">{title}</p>
            <p className="text-white/50 text-xs font-mono truncate">By {uploaderName} · {index + 1} / {items.length}</p>
          </div>
        </div>
        <span className={`shrink-0 inline-flex items-center px-2.5 py-1 rounded border text-[10px] font-mono font-bold uppercase tracking-widest ${statusCfg.cls}`}>
          {auto ? "AUTO-APPROVED" : statusCfg.label}
        </span>
      </div>

      {/* Media area */}
      <div className="flex-1 flex items-center justify-center relative min-h-0 p-4" onClick={e => e.stopPropagation()}>
        {previewUrl ? (
          isVideo ? (
            <MediaVideoPlayer
              key={previewUrl}
              src={previewUrl}
              mobileSrc={item.mobile_playback_url}
              desktopSrc={item.desktop_optimized_url}
              className="max-h-full max-w-full rounded-lg"
              autoPlay
              style={{ maxHeight: "calc(100vh - 200px)" }}
            />
          ) : (
            <img
              key={previewUrl}
              src={previewUrl}
              alt={title}
              className="max-h-full max-w-full rounded-lg object-contain"
              style={{ maxHeight: "calc(100vh - 200px)" }}
            />
          )
        ) : (
          <div className="flex flex-col items-center gap-3 text-white/30">
            <ImageIcon className="w-16 h-16" />
            <p className="font-mono text-sm">No preview available</p>
          </div>
        )}

        {/* Prev / Next arrows */}
        {items.length > 1 && (
          <>
            <button onClick={prev} className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/60 border border-white/20 hover:bg-black/80 transition-colors">
              <ChevronLeft className="w-5 h-5 text-white" />
            </button>
            <button onClick={next} className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/60 border border-white/20 hover:bg-black/80 transition-colors">
              <ChevronRight className="w-5 h-5 text-white" />
            </button>
          </>
        )}
      </div>

      {/* Bottom action bar — labeled, status-aware buttons (view-only until pressed) */}
      <div className="shrink-0 px-4 py-3 bg-black/60 backdrop-blur-sm border-t border-white/10" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 flex-wrap justify-center">
          {actions.map((a) => {
            const Icon = a.icon;
            return (
              <button
                key={a.key}
                onClick={() => onAction(item, a.action)}
                className={`flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-bold border transition-colors min-h-[44px] ${TONE_CLS_DARK[a.tone]}`}
              >
                <Icon className="w-4 h-4" /> {a.label}
              </button>
            );
          })}
        </div>

        {/* Thumbnail strip */}
        {items.length > 1 && (
          <div className="flex gap-1.5 justify-center mt-3 overflow-x-auto pb-1">
            {items.map((it, i) => {
              const url = it.url || it.media_url || it.media_urls?.[0] || it.cover_url;
              const isVid = (it.type || it.media_type || it.media_types?.[0]) === "video";
              return (
                <button key={it.id} onClick={() => setIndex(i)}
                  className={`shrink-0 w-12 h-12 rounded-md overflow-hidden border-2 transition-all ${i === index ? "border-primary scale-110" : "border-white/20 opacity-60 hover:opacity-100"}`}>
                  {url && !isVid ? (
                    <img src={url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-muted flex items-center justify-center">
                      <Video className="w-4 h-4 text-white/60" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// Mapping of content tab -> entity type for moderateMedia function
const ENTITY_TYPE_MAP = {
  media_items:  "MediaItem",
  artist_posts: "ArtistPost",
  artist_albums:"ArtistAlbum",
  org_posts:    "OrganizerMediaPost",
  community:    "CommunityPost",
};

export default function AdminMediaModeration() {
  const [contentTab, setContentTab] = useState("media_items");
  const [allData, setAllData] = useState({
    media_items: [], artist_posts: [], artist_albums: [], org_posts: [], community: []
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("pending_review");
  const [search, setSearch] = useState("");
  const [sectionFilter, setSectionFilter] = useState("all");
  const [confirmState, setConfirmState] = useState(null); // { item, action, ...CONFIRM_CONFIG[action] }
  const [viewer, setViewer] = useState(null); // { items, startIndex }
  const [manualScanning, setManualScanning] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [moderatingId, setModeratingId] = useState(null);
  const [autoScanStatus, setAutoScanStatus] = useState({
    lastScanTime: null,
    itemsProcessed: 0,
    itemsApproved: 0,
    itemsRejected: 0,
    itemsFailed: 0,
  });
  const [deepLinkTarget, setDeepLinkTarget] = useState(null); // { itemId, entityName } from email CTA

  useEffect(() => { 
    load();
    // Poll auto-scan status every 10 seconds
    const pollInterval = setInterval(loadAutoScanStatus, 10000);
    return () => clearInterval(pollInterval);
  }, []);

  // Deep-link from moderation email CTA — read ?item=&entity= on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const itemId = params.get('item');
    const entityName = params.get('entity');
    if (itemId && entityName) setDeepLinkTarget({ itemId, entityName });
  }, []);

  // Once data loads, open the viewer for the deep-linked item
  useEffect(() => {
    if (!deepLinkTarget || loading) return;
    const { itemId, entityName } = deepLinkTarget;
    const entityToTab = {
      MediaItem: 'media_items', OrganizerMediaPost: 'media_items',
      ArtistPost: 'artist_posts', ArtistAlbum: 'artist_albums', CommunityPost: 'community',
    };
    const tab = entityToTab[entityName] || 'media_items';
    const tabData = allData[tab] || [];
    const idx = tabData.findIndex(i => i.id === itemId);
    if (idx >= 0) {
      setContentTab(tab);
      setActiveTab('all');
      setViewer({ items: tabData, startIndex: idx });
      window.history.replaceState({}, '', window.location.pathname);
    }
    setDeepLinkTarget(null);
  }, [deepLinkTarget, allData, loading]);

  async function loadAutoScanStatus() {
    const logs = await base44.entities.AppSettings.filter(
      { setting_key: 'moderation_scan_log' },
      null,
      1
    ).catch(() => []);
    
    if (logs[0]) {
      try {
        const log = JSON.parse(logs[0].setting_value);
        // Use timestamp from scan log (explicitly set by scanner) as primary source,
        // falling back to record updated_date for backward compatibility.
        const scanTimestamp = log.timestamp || logs[0].updated_date;
        setAutoScanStatus(prev => ({
          ...prev,
          lastScanTime: scanTimestamp,
          itemsProcessed: log.processed || 0,
          itemsApproved: log.approved || 0,
          itemsRejected: log.rejected || 0,
          itemsFailed: log.failed || 0,
        }));
      } catch {}
    }
  }

  async function load() {
    setLoading(true);
    const [mediaItems, artistPosts, artistAlbums, orgPosts, communityPosts] = await Promise.all([
      base44.entities.MediaItem.list("-created_date", 500).catch(() => []),
      base44.entities.ArtistPost.list("-created_date", 300).catch(() => []),
      base44.entities.ArtistAlbum.list("-created_date", 300).catch(() => []),
      base44.entities.OrganizerMediaPost.list("-created_date", 300).catch(() => []),
      base44.entities.CommunityPost.list("-created_date", 300).catch(() => []),
    ]);
    // Normalize OrganizerMediaPost fields to match MediaItem schema for unified display
    const normalizedOrgPosts = orgPosts.map(p => ({
      ...p,
      id: p.id,
      title: p.caption || p.venue_name || 'Untitled',
      url: p.media_url,
      type: p.media_type,
      description: [p.venue_name, p.city, p.state, p.country].filter(Boolean).join(', '),
      __entity_type: 'OrganizerMediaPost',
    }));
    // Merge OrganizerMediaPost into media_items tab for unified Media Library view
    const unifiedMediaItems = [...mediaItems, ...normalizedOrgPosts];
    setAllData({
      media_items: unifiedMediaItems,
      artist_posts: artistPosts,
      artist_albums: artistAlbums,
      org_posts: orgPosts,
      community: communityPosts,
    });
    await loadAutoScanStatus();
    setLoading(false);
  }

  const items = allData[contentTab] || [];

  const getStatus = (item) => item.approval_status || item.media_approval_status || "pending_review";

  const filtered = items.filter(item => {
    const status = getStatus(item);
    const statusMatch = activeTab === "all" ? true :
      (activeTab === "pending_review"
        ? (!item.approval_status && !item.media_approval_status) || status === "pending_review"
        : status === activeTab);
    const q = search.toLowerCase();
    const searchMatch = !search ||
      item.title?.toLowerCase().includes(q) ||
      item.caption?.toLowerCase().includes(q) ||
      item.artist_name?.toLowerCase().includes(q) ||
      item.organizer_name?.toLowerCase().includes(q) ||
      item.author_name?.toLowerCase().includes(q) ||
      item.uploaded_by_name?.toLowerCase().includes(q) ||
      item.uploaded_by_email?.toLowerCase().includes(q);
    const sectionMatch = sectionFilter === "all" || item.upload_section === sectionFilter;
    return statusMatch && searchMatch && sectionMatch;
  });

  const counts = {
    pending_review: items.filter(i => { const s = getStatus(i); return !i.approval_status && !i.media_approval_status || s === "pending_review"; }).length,
    approved:       items.filter(i => getStatus(i) === "approved").length,
    rejected:       items.filter(i => getStatus(i) === "rejected").length,
    blocked:        items.filter(i => getStatus(i) === "blocked").length,
    all:            items.length,
  };

  // Total pending across all tabs
  const totalPending = Object.values(allData).flat().filter(i => {
    const s = i.approval_status || i.media_approval_status;
    return !s || s === "pending_review";
  }).length;

  const sections = ["all", ...Array.from(new Set(items.map(i => i.upload_section).filter(Boolean)))];

  const entityType = ENTITY_TYPE_MAP[contentTab];

  const getEffectiveEntityType = (item) => item.__entity_type ? ENTITY_TYPE_MAP[item.__entity_type === 'OrganizerMediaPost' ? 'org_posts' : contentTab] : entityType;

  // Every moderation action opens a confirmation dialog first — never fires on view/load/click.
  // The dialog closes the full-screen viewer so the confirmation is the focused action.
  const requestAction = (item, action) => {
    setViewer(null);
    setConfirmState({ item, action, ...CONFIRM_CONFIG[action] });
  };

  // Confirmed action executes the backend call with loading + duplicate-click protection
  const handleConfirmAction = async (note) => {
    const { item, action } = confirmState || {};
    setConfirmState(null);
    if (!item) return;
    if (action === "delete") {
      await executeDelete(item);
    } else {
      await executeModerate(item, action, note || "");
    }
  };

  const executeModerate = async (item, action, note) => {
    if (moderatingId) return; // prevent duplicate requests
    const effectiveEntityType = getEffectiveEntityType(item);
    setModeratingId(item.id);
    try {
      await base44.functions.invoke("moderateMedia", {
        action,
        entity_type: effectiveEntityType,
        entity_id: item.id,
        note: note || "",
      });
      const statusMap = { approve: "approved", reject: "rejected", block: "blocked" };
      const newStatus = statusMap[action];
      setAllData(prev => ({
        ...prev,
        [contentTab]: prev[contentTab].map(m => m.id === item.id ? {
          ...m,
          approval_status: newStatus,
          media_approval_status: newStatus,
          moderation_note: note || m.moderation_note,
        } : m),
      }));
      toast.success(SUCCESS_TOAST[action] || `Content ${action}d`);
    } catch (err) {
      toast.error(`Failed to ${action} content. Please try again.`);
    } finally {
      setModeratingId(null);
    }
  };

  const executeDelete = async (item) => {
    if (moderatingId) return;
    const effectiveEntityType = getEffectiveEntityType(item);
    setModeratingId(item.id);
    try {
      await base44.functions.invoke("moderateMedia", {
        action: "delete",
        entity_type: effectiveEntityType,
        entity_id: item.id,
      });
      setAllData(prev => ({
        ...prev,
        [contentTab]: prev[contentTab].filter(m => m.id !== item.id),
      }));
      toast.success(SUCCESS_TOAST.delete);
    } catch (err) {
      toast.error("Failed to delete content. Please try again.");
    } finally {
      setModeratingId(null);
    }
  };

  const handleRefresh = async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await load();
      toast.success("Content refreshed");
    } catch {
      toast.error("Failed to refresh. Please try again.");
    } finally {
      setRefreshing(false);
    }
  };

  const activeContentTab = CONTENT_TABS.find(t => t.value === contentTab);

  return (
    <div className="space-y-5 max-w-7xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display font-black text-2xl tracking-tight flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" /> Content Moderation
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Review user-submitted content. Only approved items appear publicly.
            {totalPending > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 text-yellow-400 font-bold font-mono">
                ⚠ {totalPending} pending
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={handleRefresh} variant="outline" size="sm" className="gap-1.5 shrink-0" disabled={refreshing}>
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button
            onClick={async () => {
              // Scan ALL pending items across all content types (not just current tab)
              const allPending = Object.entries(allData).flatMap(([tab, items]) =>
                items
                  .filter(i => {
                    const s = i.approval_status || i.media_approval_status;
                    return !s || s === 'pending_review';
                  })
                  .map(item => ({ item, tab }))
              );

              if (!allPending.length) { toast.info('No pending items to scan'); return; }
              if (!confirm(`Run manual AI scan on ${allPending.length} pending items across all sections?`)) return;
              
              setManualScanning(true);
              toast.info(`Scanning ${allPending.length} items manually...`);
              try {
                await Promise.all(
                  allPending.map(({ item, tab }) => {
                    const effType = item.__entity_type === 'OrganizerMediaPost' ? 'OrganizerMediaPost' : ENTITY_TYPE_MAP[tab];
                    return base44.functions.invoke('aiModerateMedia', {
                      entity_type: effType,
                      entity_id: item.id,
                    }).catch(() => {});
                  })
                );
                await load();
                toast.success('Manual scan complete');
              } catch {
                toast.error('Manual scan failed. Please try again.');
              } finally {
                setManualScanning(false);
              }
            }}
            disabled={manualScanning}
            variant="outline"
            size="sm"
            className="gap-1.5 shrink-0 border-accent/40 text-white hover:bg-accent/10"
          >
            {manualScanning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bot className="w-3.5 h-3.5" />}
            {manualScanning ? 'Scanning...' : 'Run Manual Scan'}
          </Button>
        </div>
      </div>

      {/* Auto-scan status card */}
      <div className="p-4 rounded-xl bg-accent/5 border border-accent/20 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex items-start gap-3 flex-1">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-accent/20">
            <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
          </div>
          <div className="min-w-0">
            <p className="font-display font-bold text-sm">Automatic Scanning: Active</p>
            <div className="text-xs text-muted-foreground font-mono mt-1 space-y-0.5">
              <p>Scan frequency: Every 5 minutes</p>
              {autoScanStatus.lastScanTime && (
                <p>Last scan: {format(new Date(autoScanStatus.lastScanTime), "MMM d, h:mm a")}</p>
              )}
              <p>Processed: {autoScanStatus.itemsProcessed} · Approved: {autoScanStatus.itemsApproved} · Rejected/Blocked: {autoScanStatus.itemsRejected}</p>
            </div>
          </div>
        </div>
        <div className="text-right text-xs text-muted-foreground font-mono whitespace-nowrap">
          Content types scanned:<br />
          Media, Posts, Albums,<br />
          Community Feed
        </div>
      </div>

      {/* Content type — dropdown on mobile, tabs on desktop */}
      <div>
        {/* Mobile dropdown */}
        <div className="sm:hidden">
          <Select value={contentTab} onValueChange={v => { setContentTab(v); setActiveTab("pending_review"); setSearch(""); setSectionFilter("all"); }}>
            <SelectTrigger className="w-full bg-card border-border/50 font-mono font-bold">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CONTENT_TABS.map(tab => {
                const tabData = allData[tab.value] || [];
                const pendingCount = tabData.filter(i => { const s = i.approval_status || i.media_approval_status; return !s || s === "pending_review"; }).length;
                return (
                  <SelectItem key={tab.value} value={tab.value}>
                    {tab.label}{pendingCount > 0 ? ` (${pendingCount} pending)` : ""}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        {/* Desktop tabs */}
        <div className="hidden sm:flex gap-2 flex-wrap">
          {CONTENT_TABS.map(tab => {
            const tabData = allData[tab.value] || [];
            const pendingCount = tabData.filter(i => { const s = i.approval_status || i.media_approval_status; return !s || s === "pending_review"; }).length;
            const Icon = tab.icon;
            return (
              <button key={tab.value} onClick={() => { setContentTab(tab.value); setActiveTab("pending_review"); setSearch(""); setSectionFilter("all"); }}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-mono font-bold whitespace-nowrap border transition-all ${
                  contentTab === tab.value
                    ? "bg-accent text-accent-foreground border-accent"
                    : "bg-card border-border/50 text-muted-foreground hover:border-accent/40 hover:text-foreground"
                }`}>
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
                {pendingCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full text-[9px] font-black bg-yellow-400/20 text-yellow-400 border border-yellow-400/20">
                    {pendingCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Status + search row */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Status tabs */}
        <div className="flex gap-1.5 flex-wrap">
          {STATUS_TABS.map(tab => (
            <button key={tab.value} onClick={() => setActiveTab(tab.value)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold whitespace-nowrap border transition-all ${
                activeTab === tab.value
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card border-border/50 text-muted-foreground hover:border-primary/40 hover:text-foreground"
              }`}>
              {tab.label}
              <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-black ${
                activeTab === tab.value ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
              }`}>
                {counts[tab.value]}
              </span>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative sm:ml-auto sm:w-64">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search title, uploader..."
            className="pl-9 bg-card border-border/50 text-sm h-9" />
        </div>
      </div>

      {/* Bulk approve pending */}
      {activeTab === "pending_review" && filtered.length > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-yellow-400/5 border border-yellow-400/20">
          <span className="text-lg">⚠</span>
          <p className="text-sm text-yellow-400 font-mono font-bold flex-1">
            {filtered.length} item{filtered.length !== 1 ? "s" : ""} awaiting review
          </p>
          <button
            onClick={async () => {
              if (!confirm(`Approve all ${filtered.length} pending items?`)) return;
              await Promise.all(filtered.map(item =>
                base44.functions.invoke("moderateMedia", { action: "approve", entity_type: getEffectiveEntityType(item), entity_id: item.id, note: "" })
              ));
              setAllData(prev => ({
                ...prev,
                [contentTab]: prev[contentTab].map(m =>
                  filtered.some(f => f.id === m.id)
                    ? { ...m, approval_status: "approved", media_approval_status: "approved" }
                    : m
                ),
              }));
              toast.success(`Approved ${filtered.length} items`);
            }}
            className="px-3 py-1.5 rounded-lg text-xs font-mono font-bold bg-green-400/10 text-green-400 border border-green-400/20 hover:bg-green-400/20 transition-colors"
          >
            Approve All
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <CheckCircle2 className="w-12 h-12 text-green-400/30" />
          <p className="text-muted-foreground font-medium">All clear — no content here</p>
          <p className="text-xs text-muted-foreground font-mono">Switch tabs or clear filters to see more</p>
        </div>
      ) : (
        <>
        <p className="text-xs text-muted-foreground font-mono">{filtered.length} item{filtered.length !== 1 ? "s" : ""}</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {filtered.map((item, idx) => (
            <ModerationCard
              key={item.id}
              item={item}
              onAction={requestAction}
              onReview={() => setViewer({ items: filtered, startIndex: idx })}
              moderatingId={moderatingId}
            />
          ))}
        </div>
        </>
      )}

      {/* Unified confirmation dialog for all moderation actions */}
      <ModerationConfirmDialog
        open={!!confirmState}
        title={confirmState?.title}
        message={confirmState?.message}
        confirmLabel={confirmState?.confirmLabel}
        confirmTone={confirmState?.confirmTone}
        showNote={confirmState?.showNote}
        notePlaceholder={confirmState?.notePlaceholder}
        onConfirm={handleConfirmAction}
        onCancel={() => setConfirmState(null)}
      />

      {/* Full-screen media viewer (view-only; action buttons trigger requestAction → confirmation) */}
      {viewer && (
        <MediaViewer
          items={viewer.items}
          startIndex={viewer.startIndex}
          onClose={() => setViewer(null)}
          onAction={requestAction}
        />
      )}
    </div>
  );
}