import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import {
  Home, Search, Ticket, Mic2, User, LayoutDashboard,
  Calendar, Mail, LogIn, Sparkles
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { hapticLight } from "@/lib/haptics";

// Per-tab navigation stack: remembers the last path visited under each root tab
const TAB_STACK_KEY = "nav_tab_stacks";
function getTabStacks() {
  try { return JSON.parse(sessionStorage.getItem(TAB_STACK_KEY) || "{}"); } catch { return {}; }
}
function setTabStack(rootPath, path) {
  const stacks = getTabStacks();
  stacks[rootPath] = path;
  sessionStorage.setItem(TAB_STACK_KEY, JSON.stringify(stacks));
}

function NavItem({ to, icon: Icon, label, active, onClick }) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleClick = () => {
    // Try Capacitor haptics first, then web vibration fallback
    hapticLight();
    // Direct vibration fallback for Android web/PWA (navigator.vibrate is synchronous)
    if (typeof navigator !== "undefined" && navigator.vibrate) navigator.vibrate(30);
    if (onClick) { onClick(); return; }
    if (!to) return;

    const rootPath = to;
    // If already on this tab's root or a sub-page, tapping again goes to root (iOS-style)
    if (active) {
      // Tapping active tab → scroll to top or go to tab root
      if (location.pathname !== rootPath) {
        navigate(rootPath);
      } else {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
      return;
    }
    // Navigate to the last-visited path in this tab's stack, or the root
    const stacks = getTabStacks();
    const dest = stacks[rootPath] || rootPath;
    navigate(dest);
  };

  // Track current path in tab stacks
  useEffect(() => {
    if (!to) return;
    if (active) setTabStack(to, location.pathname);
  }, [active, location.pathname, to]);

  const content = (
    <>
      <div className={`p-1.5 rounded-xl transition-all ${active ? "bg-primary/15" : ""}`}>
        <Icon className="w-5 h-5 shrink-0" strokeWidth={active ? 2.5 : 1.75} />
      </div>
      <span className="text-[10px] font-mono font-semibold leading-none truncate w-full text-center">
        {label}
      </span>
    </>
  );

  const cls = `flex flex-col items-center justify-center gap-0.5 flex-1 py-2 px-1 min-w-0 transition-colors ${
    active ? "text-primary" : "text-muted-foreground active:text-foreground"
  }`;

  return <button onClick={handleClick} className={cls}>{content}</button>;
}

export default function MobileBottomNav() {
  const location = useLocation();
  const [user, setUser] = useState(undefined);
  const pathname = location.pathname;

  useEffect(() => {
    base44.auth.isAuthenticated().then(async (authed) => {
      if (!authed) { setUser(null); return; }
      const u = await base44.auth.me().catch(() => null);
      setUser(u);
    });
  }, []);

  if (user === undefined) return null;

  const is = (path) => pathname === path || pathname.startsWith(path + "/");

  // Read stored mode to respect host↔fan switching
  const storedMode = localStorage.getItem("active_account_mode");
  const isOrganizerRole = user?.role === "organizer" || user?.role === "manager";
  const isArtistRole = user?.role === "artist";
  // In fan mode, treat organizer/artist as a regular fan for nav purposes
  const inFanMode = storedMode === "fan" && (isOrganizerRole || isArtistRole);
  const inHostMode = isOrganizerRole && storedMode !== "fan";
  const inArtistMode = isArtistRole && storedMode !== "fan";

  let items = [];

  if (!user) {
    items = [
      { to: "/", icon: Home, label: "Home", active: pathname === "/" },
      { to: "/search", icon: Search, label: "Events", active: is("/search") },
      { to: "/artists", icon: Mic2, label: "Artists", active: is("/artists") },
      { onClick: () => base44.auth.redirectToLogin(), icon: LogIn, label: "Login" },
    ];
  } else if (user.role === "admin") {
    items = [
      { to: "/admin", icon: LayoutDashboard, label: "Dashboard", active: is("/admin") },
      { to: "/search", icon: Search, label: "Events", active: is("/search") },
      { to: "/artists", icon: Mic2, label: "Artists", active: is("/artists") },
      { to: "/my-tickets", icon: Ticket, label: "Tickets", active: is("/my-tickets") },
      { to: "/profile", icon: User, label: "Profile", active: is("/profile") },
    ];
  } else if (inHostMode) {
    items = [
      { to: "/organizer", icon: LayoutDashboard, label: "Dashboard", active: is("/organizer") },
      { to: "/organizer/events", icon: Calendar, label: "Events", active: is("/organizer/events") },
      { to: "/organizer/email", icon: Mail, label: "Marketing", active: is("/organizer/email") },
      { to: "/my-tickets", icon: Ticket, label: "Tickets", active: is("/my-tickets") },
      { to: "/organizer/profile", icon: User, label: "Profile", active: is("/organizer/profile") },
    ];
  } else if (inArtistMode) {
    items = [
      { to: "/artist", icon: LayoutDashboard, label: "Studio", active: pathname === "/artist" },
      { to: "/artist/bookings", icon: Calendar, label: "Bookings", active: is("/artist/bookings") },
      { to: "/search", icon: Search, label: "Events", active: is("/search") },
      { to: "/my-tickets", icon: Ticket, label: "Tickets", active: is("/my-tickets") },
      { to: "/profile", icon: User, label: "Profile", active: is("/profile") },
    ];
  } else {
   // Fan mode (default for regular users, or organizer/artist who switched to fan)
   items = [
     { to: "/", icon: Home, label: "Home", active: pathname === "/" },
     { to: "/search", icon: Search, label: "Events", active: is("/search") },
     { to: "/feed", icon: Sparkles, label: "Feed", active: is("/feed") },
     { to: "/my-tickets", icon: Ticket, label: "Tickets", active: is("/my-tickets") },
     { to: "/profile", icon: User, label: "Profile", active: is("/profile") },
   ];
  }

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-background/98 backdrop-blur-xl border-t border-border/60"
      style={{ paddingBottom: "calc(12px + env(safe-area-inset-bottom, 0px))" }}
    >
      <div className="flex items-stretch" style={{ minHeight: "56px" }}>
        {items.map((item, i) => (
          <NavItem key={i} {...item} />
        ))}
      </div>
    </nav>
  );
}