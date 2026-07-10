import { useState, useEffect, useMemo } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { format, startOfDay, eachDayOfInterval, parseISO } from 'date-fns';
import { base44 } from '@/api/base44Client';
import StatCard from '../components/shared/StatCard';
import { TrendingUp, DollarSign, Users } from 'lucide-react';

const COLORS = ['#ff1b8d', '#1e64ff', '#1bff8d', '#ffa500'];
const REFERRAL_TYPES = ['fan_membership', 'pro_signup'];

export default function AffiliateReferralAnalytics() {
  const [referrals, setReferrals] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.auth.me().then(async (u) => {
      setUser(u);
      const refs = await base44.entities.Referral.filter(
        { referrer_email: u.email },
        '-created_date',
        500
      );
      setReferrals(refs);
      setLoading(false);
    });
  }, []);

  // Daily signups data
  const dailySignups = useMemo(() => {
    if (referrals.length === 0) return [];

    const dates = referrals.map(r => startOfDay(parseISO(r.created_date)));
    const minDate = new Date(Math.min(...dates));
    const maxDate = new Date(Math.max(...dates));

    const days = eachDayOfInterval({ start: minDate, end: maxDate });
    return days.map(day => {
      const dayStr = format(day, 'MMM dd');
      const count = referrals.filter(
        r => format(startOfDay(parseISO(r.created_date)), 'MMM dd') === dayStr
      ).length;
      return { date: dayStr, signups: count };
    });
  }, [referrals]);

  // Earnings by type over time
  const earningsByType = useMemo(() => {
    const typeMap = {};
    referrals.forEach(r => {
      if (!typeMap[r.referral_type]) {
        typeMap[r.referral_type] = 0;
      }
      typeMap[r.referral_type] += r.credit_earned || 0;
    });
    return Object.entries(typeMap).map(([type, earned]) => ({
      type: type === 'fan_membership' ? 'Fan Membership' : 'Pro Signup',
      value: type,
      earnings: earned,
    }));
  }, [referrals]);

  // Timeline of earnings by type
  const earningsTimeline = useMemo(() => {
    if (referrals.length === 0) return [];

    const typesByDate = {};
    referrals.forEach(r => {
      const dateStr = format(parseISO(r.created_date), 'MMM dd');
      if (!typesByDate[dateStr]) typesByDate[dateStr] = {};
      if (!typesByDate[dateStr][r.referral_type]) {
        typesByDate[dateStr][r.referral_type] = 0;
      }
      typesByDate[dateStr][r.referral_type] += r.credit_earned || 0;
    });

    return Object.entries(typesByDate).map(([date, types]) => ({
      date,
      ...types,
      'fan_membership': types.fan_membership || 0,
      'pro_signup': types.pro_signup || 0,
    }));
  }, [referrals]);

  const totalEarned = referrals.reduce((s, r) => s + (r.credit_earned || 0), 0);
  const membershipEarned = referrals
    .filter(r => r.referral_type === 'fan_membership')
    .reduce((s, r) => s + (r.credit_earned || 0), 0);
  const proEarned = referrals
    .filter(r => r.referral_type === 'pro_signup')
    .reduce((s, r) => s + (r.credit_earned || 0), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-6xl">
      <div>
        <h1 className="font-display font-black text-3xl tracking-tight">AFFILIATE ANALYTICS</h1>
        <p className="text-sm text-muted-foreground mt-1">Track your referral signups and earnings performance.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total Earned" value={`$${totalEarned.toFixed(2)}`} icon={DollarSign} accent />
        <StatCard label="Fan Memberships" value={`$${membershipEarned.toFixed(2)}`} icon={Users} />
        <StatCard label="Pro Signups" value={`$${proEarned.toFixed(2)}`} icon={TrendingUp} />
        <StatCard label="Total Referrals" value={referrals.length} icon={Users} />
      </div>

      {/* Daily Signups Chart */}
      <div className="p-5 rounded-xl bg-card border border-border/50 space-y-4">
        <h2 className="font-display font-bold text-lg flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" /> Daily Referral Signups
        </h2>
        {dailySignups.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={dailySignups}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" />
              <YAxis stroke="hsl(var(--muted-foreground))" />
              <Tooltip 
                contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
              />
              <Line
                type="monotone"
                dataKey="signups"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={{ fill: 'hsl(var(--primary))' }}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-center py-10 text-muted-foreground text-sm">No signup data yet</p>
        )}
      </div>

      {/* Earnings Breakdown */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Pie Chart */}
        <div className="p-5 rounded-xl bg-card border border-border/50 space-y-4">
          <h2 className="font-display font-bold text-lg flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-primary" /> Earnings by Type
          </h2>
          {earningsByType.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={earningsByType}
                  dataKey="earnings"
                  nameKey="type"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label
                >
                  {earningsByType.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                  formatter={(value) => `$${value.toFixed(2)}`}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center py-10 text-muted-foreground text-sm">No earnings data yet</p>
          )}
        </div>

        {/* Timeline Chart */}
        <div className="p-5 rounded-xl bg-card border border-border/50 space-y-4">
          <h2 className="font-display font-bold text-lg flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" /> Earnings Timeline
          </h2>
          {earningsTimeline.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={earningsTimeline}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" />
                <YAxis stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                  formatter={(value) => `$${value.toFixed(2)}`}
                />
                <Legend />
                <Bar dataKey="fan_membership" name="Fan Membership" fill={COLORS[0]} />
                <Bar dataKey="pro_signup" name="Pro Signup" fill={COLORS[1]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-center py-10 text-muted-foreground text-sm">No timeline data yet</p>
          )}
        </div>
      </div>

      {/* Referral List */}
      {referrals.length > 0 && (
        <div className="p-5 rounded-xl bg-card border border-border/50 space-y-3">
          <h2 className="font-display font-bold text-lg">Recent Referrals</h2>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {referrals.slice(0, 20).map(r => (
              <div key={r.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 text-sm">
                <div>
                  <p className="font-bold">{r.referred_name}</p>
                  <p className="text-xs font-mono text-muted-foreground">
                    {r.referral_type === 'fan_membership' ? '⭐ Fan Membership' : '🚀 Pro Signup'}
                  </p>
                </div>
                <p className="font-mono font-bold text-primary">+${(r.credit_earned || 0).toFixed(2)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}