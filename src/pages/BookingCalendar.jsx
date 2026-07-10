import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, CalendarCheck, Clock, MapPin, DollarSign, ArrowLeft } from "lucide-react";
import { base44 } from "@/api/base44Client";
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  addMonths, subMonths, addDays, isSameMonth, isSameDay,
  format, isToday, parseISO,
} from "date-fns";
import { Link, useNavigate, useLocation } from "react-router-dom";

const STATUS_CONFIG = {
  pending:   { label: "Pending",   color: "bg-yellow-400/20 text-yellow-400 border-yellow-400/30", dot: "bg-yellow-400" },
  accepted:  { label: "Accepted",  color: "bg-green-400/20 text-green-400 border-green-400/30", dot: "bg-green-400" },
  declined:  { label: "Declined",  color: "bg-destructive/20 text-destructive border-destructive/30", dot: "bg-destructive" },
  cancelled: { label: "Cancelled", color: "bg-muted text-muted-foreground border-border/30", dot: "bg-muted-foreground" },
};

export default function BookingCalendar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(null);
  const [filter, setFilter] = useState("all");

  // Determine where user came from and where to go back
  const fromPath = location.state?.from;
  
  // Get dashboard path based on actual role (not the current path)
  const getDashboardPath = (role) => {
    if (role === "admin") return "/admin";
    if (role === "organizer") return "/organizer";
    if (role === "artist") return "/artist";
    return "/";
  };

  useEffect(() => {
    base44.auth.me().then(async (u) => {
      setUser(u);
      // Load bookings based on role
      let b = [];
      if (u.role === "admin") {
        b = await base44.entities.ArtistBooking.list("-event_date", 500);
      } else {
        // Load both as organizer and as artist
        const artists = await base44.entities.Artist.filter({ user_email: u.email }, null, 1);
        const queries = [base44.entities.ArtistBooking.filter({ booker_email: u.email }, "-event_date", 200)];
        if (artists[0]) queries.push(base44.entities.ArtistBooking.filter({ artist_id: artists[0].id }, "-event_date", 200));
        const results = await Promise.all(queries);
        const seen = new Set();
        results.flat().forEach(x => { if (!seen.has(x.id)) { seen.add(x.id); b.push(x); } });
      }
      setBookings(b);
      setLoading(false);
    });
  }, []);

  const filtered = bookings.filter(b => {
    if (filter !== "all" && b.status !== filter) return false;
    return true;
  });

  // Build calendar
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart);
  const calEnd = endOfWeek(monthEnd);

  const days = [];
  let day = calStart;
  while (day <= calEnd) {
    days.push(day);
    day = addDays(day, 1);
  }

  const bookingsOnDay = (d) =>
    filtered.filter(b => b.event_date && isSameDay(parseISO(b.event_date), d));

  const selectedBookings = selectedDay ? bookingsOnDay(selectedDay) : [];

  // Summary counts
  const counts = {
    pending: bookings.filter(b => b.status === "pending").length,
    accepted: bookings.filter(b => b.status === "accepted").length,
    declined: bookings.filter(b => b.status === "declined").length,
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-foreground py-8 px-4 sm:px-6 max-w-6xl mx-auto space-y-8 safe-top-header">
      {/* Back Button */}
      <button 
        onClick={() => {
          if (fromPath) {
            navigate(fromPath);
          } else if (window.history.length > 1) {
            navigate(-1);
          } else if (user) {
            navigate(getDashboardPath(user.role));
          } else {
            navigate("/");
          }
        }} 
        className="flex items-center gap-2 px-3 py-2 -ml-3 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted/40 active:scale-[0.97] transition-all touch-manipulation mb-4"
      >
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <span className="font-mono text-xs text-primary tracking-[0.3em] uppercase">★ Shared</span>
          <h1 className="font-display font-black text-4xl tracking-tight mt-0.5">BOOKING CALENDAR</h1>
          <p className="text-sm text-muted-foreground mt-1">All booking requests across artists and organizers</p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <Link to="/organizer/bookings">
            <button className="px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-display font-bold shadow-lg shadow-primary/25 hover:bg-primary/90 active:scale-[0.97] transition-all">
              + New Request
            </button>
          </Link>
          <Link to="/artist/bookings">
            <button className="px-5 py-2.5 rounded-xl bg-white/10 border-2 border-white/20 text-white text-sm font-display font-bold hover:bg-white/15 hover:border-white/30 active:scale-[0.97] transition-all">
              Artist View
            </button>
          </Link>
        </div>
      </div>

      {/* Status Filter Pills */}
      <div className="flex flex-wrap gap-2">
        {[
          { key: "all", label: "All", color: "text-foreground", active: "bg-card border-primary text-primary" },
          { key: "pending", label: `Pending (${counts.pending})`, color: "text-yellow-400", active: "bg-yellow-400/10 border-yellow-400 text-yellow-400" },
          { key: "accepted", label: `Confirmed (${counts.accepted})`, color: "text-green-400", active: "bg-green-400/10 border-green-400 text-green-400" },
          { key: "declined", label: `Declined (${counts.declined})`, color: "text-destructive", active: "bg-destructive/10 border-destructive text-destructive" },
        ].map(item => (
          <button key={item.key}
            onClick={() => setFilter(item.key)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-mono font-bold transition-all ${
              filter === item.key ? item.active : "bg-card border-border/50 text-muted-foreground hover:border-border hover:text-foreground"
            }`}>
            {item.label}
          </button>
        ))}
      </div>

      {/* Calendar */}
      <div className="rounded-2xl bg-card border border-border/50 overflow-hidden">
        {/* Month Nav */}
        <div className="flex items-center justify-between p-4 border-b border-border/30">
          <button onClick={() => setCurrentMonth(m => subMonths(m, 1))}
            className="p-2 rounded-lg hover:bg-muted transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <h2 className="font-display font-black text-xl tracking-tight">
            {format(currentMonth, "MMMM yyyy").toUpperCase()}
          </h2>
          <button onClick={() => setCurrentMonth(m => addMonths(m, 1))}
            className="p-2 rounded-lg hover:bg-muted transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-border/30">
          {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d => (
            <div key={d} className="p-2 text-center font-mono text-[10px] text-muted-foreground uppercase tracking-widest">{d}</div>
          ))}
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7">
          {days.map((d, i) => {
            const dayBookings = bookingsOnDay(d);
            const isSelected = selectedDay && isSameDay(d, selectedDay);
            const inMonth = isSameMonth(d, currentMonth);
            const hasBookings = dayBookings.length > 0;
            // Pick dot color from the most "urgent" status
            const dotColor = hasBookings
              ? (dayBookings.some(b => b.status === "pending") ? "bg-yellow-400"
                : dayBookings.some(b => b.status === "accepted") ? "bg-green-400"
                : "bg-destructive")
              : null;

            return (
              <button key={i}
                onClick={() => setSelectedDay(isSameDay(d, selectedDay) ? null : d)}
                className={`min-h-[64px] sm:min-h-[80px] p-1.5 sm:p-2 border-b border-r border-border/20 transition-all text-left relative ${
                  isSelected
                    ? "bg-primary/20 ring-2 ring-inset ring-primary"
                    : inMonth ? "hover:bg-muted/50" : ""
                } ${!inMonth ? "opacity-30" : ""}`}>
                {/* Date number */}
                <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-mono font-bold ${
                  isToday(d)
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/40"
                    : isSelected
                      ? "bg-primary text-primary-foreground"
                      : "text-foreground"
                }`}>{format(d, "d")}</span>

                {/* Booking indicator */}
                {hasBookings && (
                  <div className="mt-1 flex flex-col items-start gap-0.5">
                    {/* On larger screens: show pill labels */}
                    <div className="hidden sm:flex flex-col gap-0.5 w-full">
                      {dayBookings.slice(0, 2).map((b, j) => {
                        const cfg = STATUS_CONFIG[b.status] || STATUS_CONFIG.pending;
                        return (
                          <div key={j} className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono border truncate w-full ${cfg.color}`}>
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
                            <span className="truncate">{b.event_name}</span>
                          </div>
                        );
                      })}
                      {dayBookings.length > 2 && (
                        <p className="text-[9px] font-mono text-muted-foreground pl-1">+{dayBookings.length - 2} more</p>
                      )}
                    </div>
                    {/* On mobile: show colored dot + count badge */}
                    <div className="flex sm:hidden items-center gap-1 mt-0.5">
                      <span className={`w-2 h-2 rounded-full ${dotColor}`} />
                      {dayBookings.length > 1 && (
                        <span className="text-[9px] font-mono font-bold text-muted-foreground">{dayBookings.length}</span>
                      )}
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 p-3 border-t border-border/30">
          <span className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground">
            <span className="w-5 h-5 rounded-full bg-primary inline-block" /> Today
          </span>
          <span className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground">
            <span className="w-4 h-4 rounded bg-primary/20 ring-2 ring-primary inline-block" /> Selected
          </span>
          <span className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground">
            <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" /> Pending
          </span>
          <span className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground">
            <span className="w-2 h-2 rounded-full bg-green-400 inline-block" /> Confirmed
          </span>
          <span className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground">
            <span className="w-2 h-2 rounded-full bg-destructive inline-block" /> Declined
          </span>
        </div>
      </div>

      {/* Selected Day Detail */}
      {selectedDay && (
        <div className="rounded-2xl bg-card border border-border/50 overflow-hidden">
          <div className="p-4 border-b border-border/30">
            <h3 className="font-display font-black text-lg">
              {format(selectedDay, "EEEE, MMMM dd yyyy").toUpperCase()}
            </h3>
            <p className="text-xs font-mono text-muted-foreground">{selectedBookings.length} booking{selectedBookings.length !== 1 ? "s" : ""}</p>
          </div>
          {selectedBookings.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">No events on this date.</div>
          ) : (
            <div className="divide-y divide-border/30">
              {selectedBookings.map(b => {
                const cfg = STATUS_CONFIG[b.status] || STATUS_CONFIG.pending;
                return (
                  <div key={b.id} className="p-4 flex items-start gap-4">
                    <div className={`w-2 self-stretch rounded-full mt-1 ${cfg.dot}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-display font-bold">{b.event_name}</p>
                        <span className={`font-mono text-[10px] font-bold uppercase px-2 py-0.5 rounded border ${cfg.color}`}>{cfg.label}</span>
                      </div>
                      <div className="flex flex-wrap gap-4 mt-1 text-xs text-muted-foreground">
                        <span className="text-primary font-bold">🎤 {b.artist_name}</span>
                        <span>By: {b.booker_name}</span>
                        {b.event_date && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{format(parseISO(b.event_date), "h:mm a")}</span>}
                        {b.city && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{b.city}{b.venue ? ` · ${b.venue}` : ""}</span>}
                        {b.budget && <span className="flex items-center gap-1 text-green-400 font-bold"><DollarSign className="w-3 h-3" />${b.budget.toLocaleString()}</span>}
                      </div>
                      {b.artist_response && (
                        <p className="text-xs text-muted-foreground mt-1 italic">"{b.artist_response}"</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Upcoming Confirmed */}
      <div className="space-y-3">
        <h2 className="font-display font-bold text-lg">UPCOMING CONFIRMED BOOKINGS</h2>
        {bookings.filter(b => b.status === "accepted" && b.event_date && new Date(b.event_date) > new Date()).length === 0 ? (
          <p className="text-sm text-muted-foreground">No confirmed upcoming bookings.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {bookings
              .filter(b => b.status === "accepted" && b.event_date && new Date(b.event_date) > new Date())
              .sort((a, b) => new Date(a.event_date) - new Date(b.event_date))
              .slice(0, 6)
              .map(b => (
                <div key={b.id} className="p-4 rounded-xl bg-green-400/5 border border-green-400/20">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-display font-bold truncate">{b.event_name}</p>
                      <p className="text-sm text-primary font-bold mt-0.5">🎤 {b.artist_name}</p>
                      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mt-1">
                        {b.event_date && <span className="flex items-center gap-1 text-green-400 font-mono font-bold"><CalendarCheck className="w-3 h-3" />{format(parseISO(b.event_date), "MMM dd, yyyy · h:mm a")}</span>}
                        {b.city && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{b.city}</span>}
                        {b.budget && <span className="flex items-center gap-1 font-bold"><DollarSign className="w-3 h-3" />${b.budget.toLocaleString()}</span>}
                      </div>
                    </div>
                    <span className="font-mono text-[10px] font-bold uppercase px-2 py-1 rounded bg-green-400/20 text-green-400 border border-green-400/30 shrink-0">Confirmed</span>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}