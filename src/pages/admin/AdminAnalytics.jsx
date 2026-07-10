import { useState, useEffect } from "react";
import { PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, LineChart, Line } from "recharts";
import { base44 } from "@/api/base44Client";
import { RefreshCw, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import AIFlyerAnalytics from "@/components/admin/AIFlyerAnalytics";
import RevenueDetailModal from "@/components/admin/analytics/RevenueDetailModal";
import VisitorDetailModal from "@/components/admin/analytics/VisitorDetailModal";
import { normalizeCountry, normalizeCity } from "@/utils/normalizeLocation";

const COLORS = ["#ff1b8d", "#1e64ff", "#a855f7", "#f97316", "#10b981", "#eab308", "#06b6d4", "#ef4444", "#8b5cf6", "#14b8a6"];

const TIME_RANGES = [
  { key: "1d", label: "Last Day" },
  { key: "7d", label: "Last Week" },
  { key: "30d", label: "Last Month" },
  { key: "monthly", label: "By Month" },
  { key: "ytd", label: "YTD" },
  { key: "yearly", label: "By Year" },
  { key: "all", label: "All Time" },
];

function getStartDate(key) {
  const now = new Date();
  if (key === "1d") return new Date(now - 86400000);
  if (key === "7d") return new Date(now - 7 * 86400000);
  if (key === "30d") return new Date(now - 30 * 86400000);
  if (key === "ytd") return new Date(now.getFullYear(), 0, 1);
  return null;
}

function getPeriodKey(dateStr, rangeKey) {
  const d = new Date(dateStr);
  if (rangeKey === "1d") return d.toLocaleTimeString("en-US", { hour: "2-digit" });
  if (rangeKey === "7d" || rangeKey === "30d") return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  if (rangeKey === "yearly") return String(d.getFullYear());
  // Monthly grouping (also used for ytd/all) — sortable "YYYY-MM" key so every
  // record from the same calendar month merges into one bucket, regardless of
  // which day it was created on.
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// Converts a sortable "YYYY-MM" period key into a display label anchored to
// the 1st of that month (e.g. "Jul 2026"), never the day data was recorded.
function getPeriodLabel(key, rangeKey) {
  if (rangeKey === "1d" || rangeKey === "7d" || rangeKey === "30d" || rangeKey === "yearly") return key;
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

function buildCharts({ orders, events, eventViews }, rangeKey) {
  const startDate = getStartDate(rangeKey);
  const filteredOrders = startDate ? orders.filter(o => new Date(o.created_date) >= startDate) : orders;
  const filteredViews = startDate ? eventViews.filter(v => new Date(v.created_date) >= startDate) : eventViews;

  const incomeByPeriod = {};
  filteredOrders.filter(o => o.status === "completed").forEach(o => {
    const key = getPeriodKey(o.created_date, rangeKey);
    incomeByPeriod[key] = (incomeByPeriod[key] || 0) + (o.total || 0);
  });
  const incomeChart = Object.entries(incomeByPeriod)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, revenue]) => ({ month: getPeriodLabel(key, rangeKey), revenue: parseFloat(revenue.toFixed(2)) }));

  const byCountry = {};
  events.forEach(e => { const k = normalizeCountry(e.country); byCountry[k] = (byCountry[k] || 0) + 1; });
  const countryChart = Object.entries(byCountry).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, value]) => ({ name, value }));

  const byCity = {};
  events.forEach(e => { const k = normalizeCity(e.city); byCity[k] = (byCity[k] || 0) + 1; });
  const cityChart = Object.entries(byCity).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, value]) => ({ name, value }));

  const viewsByPeriod = {};
  filteredViews.forEach(v => {
    const key = getPeriodKey(v.created_date, rangeKey);
    viewsByPeriod[key] = (viewsByPeriod[key] || 0) + 1;
  });
  const trafficChart = Object.entries(viewsByPeriod)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, views]) => ({ day: getPeriodLabel(key, rangeKey), views }));

  const byStage = {};
  filteredViews.forEach(v => { const s = v.stage || "view"; byStage[s] = (byStage[s] || 0) + 1; });
  const stageChart = Object.entries(byStage).map(([name, value]) => ({ name, value }));

  const revenueByGenre = {};
  filteredOrders.filter(o => o.status === "completed").forEach(o => {
    const ev = events.find(e => e.id === o.event_id);
    const genre = ev?.genre || "other";
    revenueByGenre[genre] = (revenueByGenre[genre] || 0) + (o.total || 0);
  });
  const genreChart = Object.entries(revenueByGenre).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, value]) => ({ name: name.replace(/_/g, " "), value: parseFloat(value.toFixed(2)) }));

  const totalRevenue = filteredOrders.filter(o => o.status === "completed").reduce((s, o) => s + (o.total || 0), 0);
  const totalViews = filteredViews.length;
  const uniqueUsers = new Set(filteredViews.map(v => v.user_email).filter(Boolean)).size;

  return { incomeChart, countryChart, cityChart, trafficChart, stageChart, genreChart, totalRevenue, totalViews, uniqueUsers };
}

function calcAge(dob) {
  if (!dob) return null;
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

function buildUserDemographics(users) {
  const byCity = {}, byState = {}, byGender = {}, byAgeGroup = {}, byGenre = {};

  users.forEach(u => {
    if (u.city) { const k = normalizeCity(u.city); byCity[k] = (byCity[k] || 0) + 1; }
    if (u.state) { const k = normalizeCity(u.state); byState[k] = (byState[k] || 0) + 1; }

    const gender = u.gender || "prefer_not_to_say";
    const genderLabel = { male: "Male", female: "Female", non_binary: "Non-binary", prefer_not_to_say: "Not specified" }[gender] || "Not specified";
    byGender[genderLabel] = (byGender[genderLabel] || 0) + 1;

    const age = calcAge(u.date_of_birth);
    if (age !== null) {
      const group = age < 18 ? "Under 18" : age < 25 ? "18–24" : age < 35 ? "25–34" : age < 45 ? "35–44" : age < 55 ? "45–54" : "55+";
      byAgeGroup[group] = (byAgeGroup[group] || 0) + 1;
    }

    (u.preferred_genres || []).forEach(g => {
      byGenre[g] = (byGenre[g] || 0) + 1;
    });
  });

  const AGE_ORDER = ["Under 18", "18–24", "25–34", "35–44", "45–54", "55+"];

  return {
    usersByCity: Object.entries(byCity).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, value]) => ({ name, value })),
    usersByState: Object.entries(byState).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, value]) => ({ name, value })),
    usersByGender: Object.entries(byGender).map(([name, value]) => ({ name, value })),
    usersByAge: AGE_ORDER.filter(g => byAgeGroup[g]).map(name => ({ name, value: byAgeGroup[name] })),
    usersByGenre: Object.entries(byGenre).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, value]) => ({ name: name.replace(/_/g, " "), value })),
  };
}

export default function AdminAnalytics() {
  const [rawData, setRawData] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [range, setRange] = useState("monthly");
  const [users, setUsers] = useState([]);
  const [userDemographics, setUserDemographics] = useState(null);
  const [artistClicks, setArtistClicks] = useState([]);

  // Extra data for detail modals
  const [tableReservations, setTableReservations] = useState([]);
  const [fanSubscriptions, setFanSubscriptions] = useState([]);
  const [affiliateEarnings, setAffiliateEarnings] = useState([]);
  const [artistDonations, setArtistDonations] = useState([]);

  // Modal state
  const [revenueModal, setRevenueModal] = useState(false);
  const [visitorModal, setVisitorModal] = useState(null); // "views" | "visitors"

  const fetchData = async () => {
    setLoading(true);
    const [orders, events, eventViews, clicks, userList, tables, subs, affiliates, donations] = await Promise.all([
      base44.entities.Order.list("-created_date", 2000),
      base44.entities.Event.list(null, 1000),
      base44.entities.EventView.list("-created_date", 5000).catch(() => []),
      base44.entities.ArtistClickTracking.list("-created_date", 2000).catch(() => []),
      base44.entities.User.list(null, 1000).catch(() => []),
      base44.entities.TableReservation.list("-created_date", 1000).catch(() => []),
      base44.entities.FanSubscription.list("-created_date", 1000).catch(() => []),
      base44.entities.AffiliateEarning.list("-created_date", 1000).catch(() => []),
      base44.entities.ArtistDonation.list("-created_date", 1000).catch(() => []),
    ]);
    setRawData({ orders, events, eventViews });
    setArtistClicks(clicks);
    setUsers(userList);
    setUserDemographics(buildUserDemographics(userList));
    setTableReservations(tables);
    setFanSubscriptions(subs);
    setAffiliateEarnings(affiliates);
    setArtistDonations(donations);
    setLastRefresh(new Date());
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  useEffect(() => {
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!rawData) return;
    setData(buildCharts(rawData, range));
  }, [rawData, range]);

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-card border border-border/50 rounded-lg px-3 py-2 text-sm shadow-lg">
        <p className="font-mono text-xs text-muted-foreground mb-1">{label}</p>
        {payload.map((p, i) => (
          <p key={i} className="font-bold" style={{ color: p.color }}>
            {p.name}: {typeof p.value === "number" && p.name?.toLowerCase().includes("revenue") ? `$${p.value.toLocaleString()}` : p.value}
          </p>
        ))}
      </div>
    );
  };

  const rangeLabel = TIME_RANGES.find(t => t.key === range)?.label;

  const PieWithLegend = ({ data: chartData, formatter }) => (
    <div className="flex items-center gap-4">
      <ResponsiveContainer width="50%" height={200}>
        <PieChart>
          <Pie data={chartData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={2}>
            {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
          </Pie>
          <Tooltip formatter={formatter} />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex-1 space-y-1.5 overflow-hidden">
        {chartData.map((item, i) => (
          <div key={i} className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
              <span className="text-xs text-muted-foreground truncate capitalize">{item.name}</span>
            </div>
            <span className="font-mono text-xs font-bold shrink-0">{formatter ? formatter(item.value)[0] : item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-8 max-w-6xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display font-black text-3xl tracking-tight">PLATFORM ANALYTICS</h1>
          <p className="text-xs font-mono text-muted-foreground mt-1">Last updated: {lastRefresh.toLocaleTimeString()} · Auto-refreshes every 60s</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} disabled={loading} className="gap-2 shrink-0">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      {/* Time Range Selector */}
      <div className="flex flex-wrap gap-2">
        {TIME_RANGES.map(tr => (
          <button key={tr.key} onClick={() => setRange(tr.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold border transition-all ${
              range === tr.key ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border/50 text-muted-foreground hover:border-primary/40"
            }`}>
            {tr.label}
          </button>
        ))}
      </div>

      {loading && !data ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
        </div>
      ) : data ? (
        <>
          {/* KPI Row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <button
              onClick={() => setRevenueModal(true)}
              className="p-5 rounded-xl bg-primary/10 border border-primary/30 text-left cursor-pointer hover:bg-primary/15 hover:border-primary/50 active:scale-[0.98] transition-all group"
            >
              <div className="flex items-center justify-between">
                <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider">Revenue — {rangeLabel}</p>
                <ChevronRight className="w-3.5 h-3.5 text-primary/50 group-hover:text-primary transition-colors" />
              </div>
              <p className="font-display font-black text-3xl mt-1 text-primary">${data.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              <p className="text-[10px] font-mono text-primary/50 mt-1">Tap to view breakdown</p>
            </button>
            <button
              onClick={() => setVisitorModal("views")}
              className="p-5 rounded-xl bg-card border border-border/50 text-left cursor-pointer hover:border-accent/40 hover:bg-accent/5 active:scale-[0.98] transition-all group"
            >
              <div className="flex items-center justify-between">
                <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider">Page Views — {rangeLabel}</p>
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50 group-hover:text-accent transition-colors" />
              </div>
              <p className="font-display font-black text-3xl mt-1">{data.totalViews.toLocaleString()}</p>
              <p className="text-[10px] font-mono text-muted-foreground/50 mt-1">Tap to view details</p>
            </button>
            <button
              onClick={() => setVisitorModal("visitors")}
              className="p-5 rounded-xl bg-card border border-border/50 text-left cursor-pointer hover:border-accent/40 hover:bg-accent/5 active:scale-[0.98] transition-all group"
            >
              <div className="flex items-center justify-between">
                <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider">Unique Visitors — {rangeLabel}</p>
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50 group-hover:text-accent transition-colors" />
              </div>
              <p className="font-display font-black text-3xl mt-1">{data.uniqueUsers.toLocaleString()}</p>
              <p className="text-[10px] font-mono text-muted-foreground/50 mt-1">Tap to view details</p>
            </button>
          </div>

          {/* Revenue Over Time */}
          <div className="p-5 rounded-xl bg-card border border-border/50">
            <h2 className="font-display font-bold text-base mb-4">REVENUE — {rangeLabel.toUpperCase()}</h2>
            {data.incomeChart.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-8">No revenue data for this period</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={data.incomeChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={v => `$${(v/1000).toFixed(0)}k`} width={55} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: "hsl(var(--primary))", r: 4 }} name="Revenue" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Traffic */}
          <div className="p-5 rounded-xl bg-card border border-border/50">
            <h2 className="font-display font-bold text-base mb-4">SITE TRAFFIC — {rangeLabel.toUpperCase()}</h2>
            {data.trafficChart.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm py-8">No traffic data for this period</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data.trafficChart}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="day" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="views" fill="hsl(var(--accent))" radius={[3, 3, 0, 0]} name="Views" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Pie Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="p-5 rounded-xl bg-card border border-border/50">
              <h2 className="font-display font-bold text-base mb-4">EVENTS BY COUNTRY</h2>
              {data.countryChart.length === 0 ? <p className="text-center text-muted-foreground text-sm py-8">No data</p> : <PieWithLegend data={data.countryChart} formatter={(v) => [v, "events"]} />}
            </div>

            <div className="p-5 rounded-xl bg-card border border-border/50">
              <h2 className="font-display font-bold text-base mb-4">EVENTS BY CITY</h2>
              {data.cityChart.length === 0 ? <p className="text-center text-muted-foreground text-sm py-8">No data</p> : <PieWithLegend data={data.cityChart} formatter={(v) => [v, "events"]} />}
            </div>

            <div className="p-5 rounded-xl bg-card border border-border/50">
              <h2 className="font-display font-bold text-base mb-4">REVENUE BY GENRE — {rangeLabel.toUpperCase()}</h2>
              {data.genreChart.length === 0 ? <p className="text-center text-muted-foreground text-sm py-8">No data</p> : <PieWithLegend data={data.genreChart} formatter={(v) => [`$${v.toLocaleString()}`, "revenue"]} />}
            </div>

            <div className="p-5 rounded-xl bg-card border border-border/50">
              <h2 className="font-display font-bold text-base mb-4">TRAFFIC FUNNEL — {rangeLabel.toUpperCase()}</h2>
              {data.stageChart.length === 0 ? <p className="text-center text-muted-foreground text-sm py-8">No data</p> : (
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width="50%" height={200}>
                    <PieChart>
                      <Pie data={data.stageChart} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={2}>
                        {data.stageChart.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v) => [v, "views"]} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-1.5 overflow-hidden">
                    {data.stageChart.map((item, i) => (
                      <div key={i} className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                          <span className="text-xs text-muted-foreground truncate capitalize">{item.name.replace(/_/g, " ")}</span>
                        </div>
                        <span className="font-mono text-xs font-bold shrink-0">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          {/* User Demographics */}
          {userDemographics && (
            <div className="space-y-4">
              <h2 className="font-display font-black text-xl tracking-tight">USER DEMOGRAPHICS</h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="p-5 rounded-xl bg-card border border-border/50">
                  <h2 className="font-display font-bold text-base mb-4">USERS BY CITY</h2>
                  {userDemographics.usersByCity.length === 0 ? <p className="text-center text-muted-foreground text-sm py-8">No data yet</p> : <PieWithLegend data={userDemographics.usersByCity} formatter={(v) => [v, "users"]} />}
                </div>
                <div className="p-5 rounded-xl bg-card border border-border/50">
                  <h2 className="font-display font-bold text-base mb-4">USERS BY STATE</h2>
                  {userDemographics.usersByState.length === 0 ? <p className="text-center text-muted-foreground text-sm py-8">No data yet</p> : <PieWithLegend data={userDemographics.usersByState} formatter={(v) => [v, "users"]} />}
                </div>
                <div className="p-5 rounded-xl bg-card border border-border/50">
                  <h2 className="font-display font-bold text-base mb-4">USERS BY GENDER</h2>
                  {userDemographics.usersByGender.length === 0 ? <p className="text-center text-muted-foreground text-sm py-8">No data yet</p> : <PieWithLegend data={userDemographics.usersByGender} formatter={(v) => [v, "users"]} />}
                </div>
                <div className="p-5 rounded-xl bg-card border border-border/50">
                  <h2 className="font-display font-bold text-base mb-4">USERS BY AGE GROUP</h2>
                  {userDemographics.usersByAge.length === 0 ? (
                    <p className="text-center text-muted-foreground text-sm py-8">No age data yet — users need to set their date of birth</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={userDemographics.usersByAge}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                        <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="value" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} name="Users" />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
                <div className="p-5 rounded-xl bg-card border border-border/50 lg:col-span-2">
                  <h2 className="font-display font-bold text-base mb-4">USERS BY PREFERRED GENRE</h2>
                  {userDemographics.usersByGenre.length === 0 ? (
                    <p className="text-center text-muted-foreground text-sm py-8">No genre preference data yet</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={userDemographics.usersByGenre}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                        <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="value" fill="hsl(var(--accent))" radius={[3, 3, 0, 0]} name="Users" />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* AI Flyer Analytics */}
          <div className="p-5 rounded-xl bg-card border border-border/50">
            <AIFlyerAnalytics />
          </div>

          {/* Ghost Artists — not on platform */}
          {(() => {
            const ghostMap = {};
            artistClicks.filter(c => !c.is_on_platform).forEach(c => {
              const k = c.artist_name;
              if (!ghostMap[k]) ghostMap[k] = { name: k, clicks: 0, searches: 0 };
              if (c.source === "search") ghostMap[k].searches++;
              else ghostMap[k].clicks++;
            });
            const ghosts = Object.values(ghostMap).sort((a, b) => (b.clicks + b.searches) - (a.clicks + a.searches));
            if (ghosts.length === 0) return null;
            return (
              <div className="p-5 rounded-xl bg-card border border-border/50">
                <h2 className="font-display font-bold text-base mb-1">👻 ARTISTS NOT YET ON REIZOR</h2>
                <p className="text-xs text-muted-foreground font-mono mb-4">Artists fans are searching/clicking that aren't on the platform yet</p>
                <div className="space-y-2">
                  {ghosts.map((g, i) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-secondary border border-border/30">
                      <span className="font-bold text-sm">{g.name}</span>
                      <div className="flex gap-4 text-xs font-mono text-muted-foreground">
                        <span className="text-primary font-bold">{g.clicks} clicks</span>
                        <span className="text-accent font-bold">{g.searches} searches</span>
                        <span className="text-foreground font-bold">{g.clicks + g.searches} total</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
          </>
          ) : null}

      {/* Revenue Detail Modal */}
      {revenueModal && (
        <RevenueDetailModal
          onClose={() => setRevenueModal(false)}
          orders={rawData?.orders || []}
          tableReservations={tableReservations}
          fanSubscriptions={fanSubscriptions}
          affiliateEarnings={affiliateEarnings}
          donations={artistDonations}
        />
      )}

      {/* Visitor Detail Modal */}
      {visitorModal && (
        <VisitorDetailModal
          onClose={() => setVisitorModal(null)}
          eventViews={rawData?.eventViews || []}
          mode={visitorModal}
        />
      )}
          </div>
          );
          }