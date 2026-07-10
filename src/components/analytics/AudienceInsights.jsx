import { useMemo } from "react";
import { PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";
import { Users } from "lucide-react";

const COLORS = ["#ff1b8d", "#1e64ff", "#a855f7", "#f97316", "#10b981", "#eab308", "#06b6d4", "#ef4444", "#8b5cf6", "#14b8a6"];

const TOOLTIP_STYLE = { background: "hsl(228,45%,10%)", border: "1px solid hsl(228,30%,18%)", borderRadius: 8, fontSize: 12 };

function calcAge(dob) {
  if (!dob) return null;
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

const PieWithLegend = ({ data: chartData, formatter }) => (
  <div className="flex items-center gap-4">
    <ResponsiveContainer width="50%" height={180}>
      <PieChart>
        <Pie data={chartData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} dataKey="value" paddingAngle={2}>
          {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
        </Pie>
        <Tooltip contentStyle={TOOLTIP_STYLE} formatter={formatter} />
      </PieChart>
    </ResponsiveContainer>
    <div className="flex-1 space-y-1.5 overflow-hidden">
      {chartData.map((item, i) => (
        <div key={i} className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
            <span className="text-xs text-muted-foreground truncate capitalize">{item.name}</span>
          </div>
          <span className="font-mono text-xs font-bold shrink-0">{item.value}</span>
        </div>
      ))}
    </div>
  </div>
);

/**
 * AudienceInsights — shows gender, age, and preferred genre breakdowns.
 * Pass `users` as the audience to analyse (already filtered by the parent to
 * only include buyers / followers relevant to this organizer).
 */
export default function AudienceInsights({ users = [] }) {
  const demographics = useMemo(() => {
    const byGender = {}, byAgeGroup = {}, byGenre = {};

    users.forEach(u => {
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
      byGender: Object.entries(byGender).map(([name, value]) => ({ name, value })),
      byAge: AGE_ORDER.filter(g => byAgeGroup[g]).map(name => ({ name, value: byAgeGroup[name] })),
      byGenre: Object.entries(byGenre).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, value]) => ({ name: name.replace(/_/g, " "), value })),
    };
  }, [users]);

  const hasData = users.length > 0;

  const EmptyState = ({ label }) => (
    <p className="text-center text-muted-foreground text-sm py-8">{label || "No audience data available yet."}</p>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Users className="w-4 h-4 text-primary" />
        <h2 className="font-display font-bold text-base">AUDIENCE INSIGHTS</h2>
        <span className="text-xs font-mono text-muted-foreground">({users.length} audience members)</span>
      </div>

      {!hasData ? (
        <div className="p-8 rounded-xl bg-card border border-border/50 text-center">
          <Users className="w-8 h-8 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No audience data available yet.</p>
          <p className="text-xs text-muted-foreground/60 mt-1 font-mono">Data will appear as your attendees set up their profiles.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Gender */}
          <div className="p-5 rounded-xl bg-card border border-border/50">
            <h3 className="font-display font-bold text-sm mb-4">USERS BY GENDER</h3>
            {demographics.byGender.length === 0
              ? <EmptyState label="No gender data yet." />
              : <PieWithLegend data={demographics.byGender} formatter={(v) => [v, "users"]} />}
          </div>

          {/* Age Group */}
          <div className="p-5 rounded-xl bg-card border border-border/50">
            <h3 className="font-display font-bold text-sm mb-4">USERS BY AGE GROUP</h3>
            {demographics.byAge.length === 0 ? (
              <EmptyState label="No age data yet — users need to set their date of birth." />
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={demographics.byAge}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} name="Users" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Preferred Genre */}
          <div className="p-5 rounded-xl bg-card border border-border/50 lg:col-span-2">
            <h3 className="font-display font-bold text-sm mb-4">USERS BY PREFERRED GENRE</h3>
            {demographics.byGenre.length === 0 ? (
              <EmptyState label="No genre preference data yet." />
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={demographics.byGenre}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                  <Tooltip contentStyle={TOOLTIP_STYLE} />
                  <Bar dataKey="value" fill="hsl(var(--accent))" radius={[3, 3, 0, 0]} name="Users" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}
    </div>
  );
}