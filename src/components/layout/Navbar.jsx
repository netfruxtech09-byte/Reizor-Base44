import { Link, useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { Menu, X, Ticket, User, LayoutDashboard, Bookmark, HelpCircle, Search, ArrowLeftRight, ChevronDown, Globe, Building2, Gift, Trophy, Star } from "lucide-react";
import AdminReferralDropdown from "../admin/AdminReferralDropdown";
import LanguageSwitcher from "./LanguageSwitcher";
import NotificationBell from "../notifications/NotificationBell";
import MessagesNavIcon from "../messages/MessagesNavIcon";
import { Mail as MailIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { useTranslation } from "@/lib/i18n";
import { toast } from "sonner";
import { hapticLight, hapticMedium } from "@/lib/haptics";

function getStoredMode() {
  return localStorage.getItem("active_account_mode") || null;
}

function setStoredMode(mode) {
  localStorage.setItem("active_account_mode", mode);
}

// Derive the effective mode for a user — admin always = "admin", organizer default = "host", but respects explicit "fan" switch
function getEffectiveMode(user, storedMode) {
  if (!user) return "fan";
  if (user.role === "admin") return "admin";
  // Plain fans are always in fan mode — ignore any stale host/artist value
  // left in localStorage by a previous organizer/artist session on this device.
  if (user.role === "user") return "fan";
  // If user explicitly switched to fan, respect that
  if (storedMode === "fan") return "fan";
  // If the user is an organizer/manager and no explicit mode is stored, default to "host"
  if ((user.role === "organizer" || user.role === "manager") && !storedMode) return "host";
  // If the user is an artist and no explicit mode is stored, default to "artist"
  if (user.role === "artist" && !storedMode) return "artist";
  return storedMode;
}

export default function Navbar() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [storedMode, setStoredModeState] = useState(() => getStoredMode());
  const [profileOpen, setProfileOpen] = useState(false);
  const [isWhiteLabel, setIsWhiteLabel] = useState(!!localStorage.getItem("wl_id"));
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const dropdownRef = useRef(null);

  // Sync storedMode and WhiteLabel check once user is available from context
  useEffect(() => {
    if (!user) return;
    // Admin should never be stored as fan/host — clear invalid stored mode
    if (user.role === "admin") {
      localStorage.removeItem("active_account_mode");
      setStoredModeState(null);
      return;
    }
    const currentStored = getStoredMode();
    if ((user.role === "organizer" || user.role === "manager") && !currentStored) {
      setStoredMode("host");
      setStoredModeState("host");
      return;
    }
    if (user.role === "artist" && !currentStored) {
      setStoredMode("artist");
      setStoredModeState("artist");
      return;
    }
    if (currentStored) setStoredModeState(currentStored);
    // Check WL account — never applies to admins, even if a stray WhiteLabel record shares their email
    if (user.role === "admin") {
      setIsWhiteLabel(false);
    } else if (user.role === "white_label") {
      setIsWhiteLabel(true);
    } else if (!localStorage.getItem("wl_id")) {
      base44.entities.WhiteLabel.filter({ email: user.email }, null, 1).then(res => {
        if (res[0]) { localStorage.setItem("wl_id", res[0].id); setIsWhiteLabel(true); }
      }).catch(() => {});
    }
  }, [user]);

  // Close mobile menu on route change
  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  // Close desktop profile dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const isActive = (path) => location.pathname === path;

  const accountMode = getEffectiveMode(user, storedMode);

  // Which role-based modes can this user switch between?
  const isAdmin = user?.role === "admin";
  const isOrganizer = user?.role === "organizer" || user?.role === "manager";
  const isArtist = user?.role === "artist";
  // Multi-role switching only for non-admin organizer/artist
  const canSwitchHost = !isAdmin && isOrganizer;
  const canSwitchArtist = !isAdmin && isArtist;
  const hasMultiMode = canSwitchHost || canSwitchArtist;

  const handleSwitchMode = (targetMode) => {
    hapticMedium();
    setStoredMode(targetMode);
    setStoredModeState(targetMode);
    setProfileOpen(false);
    setIsOpen(false);
    if (targetMode === "host") {
      toast.success("Switched to Host account.");
      navigate("/organizer");
    } else if (targetMode === "artist") {
      toast.success("Switched to Artist account.");
      navigate("/artist");
    } else {
      toast.success("Switched to Fan account.");
      navigate("/");
    }
  };

  const getDashboardLink = () => {
    if (!user) return null;
    if (isAdmin) return { to: "/admin", label: t("admin") };
    // Non-admin: hide dashboard link when in fan mode
    if (accountMode === "fan") return null;
    if (accountMode === "host") {
      if (user.role === "manager") return { to: "/organizer/scanner", label: t("scanner_label") };
      return { to: "/organizer", label: t("dashboard") };
    }
    if (accountMode === "artist") return { to: "/artist", label: t("studio") };
    if (user.role === "vendor") return { to: "/scanner", label: t("scanner_label") };
    return null;
  };

  const dashLink = getDashboardLink();

  // Badge shown next to avatar
  const modeBadge = isAdmin
    ? "Admin"
    : hasMultiMode
      ? (accountMode === "host" ? "Host Mode" : accountMode === "artist" ? "Artist Mode" : "Fan Mode")
      : null;

  const modeBadgeColor = accountMode === "host"
    ? "bg-accent/20 text-accent"
    : accountMode === "artist"
      ? "bg-yellow-400/20 text-yellow-400"
      : accountMode === "admin"
        ? "bg-primary/20 text-primary"
        : "bg-primary/20 text-primary";

  return (
    <nav className="fixed-nav fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between gap-4 h-16">

          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 shrink-0">
            <img
              src="https://media.base44.com/images/public/69c45469fc66657973f432a4/ad3127c8b_IMG_9581.png"
              alt="REIZOR"
              className="w-9 h-9 rounded-full object-cover"
            />
            <span className="font-display font-black text-xl tracking-tighter">
              <span className="text-primary">REIZ</span><span className="text-accent">OR</span>
            </span>
          </Link>

          {/* Desktop Actions */}
          <div className="hidden lg:flex items-center gap-2 shrink-0 ml-auto">
            {dashLink && user?.role === "admin" ? (
              <AdminReferralDropdown user={user} />
            ) : dashLink ? (
              <Link to={dashLink.to}>
                <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground gap-1.5">
                  <LayoutDashboard className="w-4 h-4" />
                  {dashLink.label}
                </Button>
              </Link>
            ) : null}
            {user && !isAdmin && (
              <>
                <Link to="/saved">
                  <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                    <Bookmark className="w-4 h-4" />
                  </Button>
                </Link>
                {accountMode !== "host" && (
                  <Link to="/my-tickets">
                    <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground gap-1.5">
                      <Ticket className="w-4 h-4" />
                      {t("my_tickets")}
                    </Button>
                  </Link>
                )}
              </>
            )}
            {/* Desktop search — input + icon */}
            <form
              onSubmit={(e) => { e.preventDefault(); const q = e.currentTarget.q.value.trim(); navigate(q ? `/search?q=${encodeURIComponent(q)}` : "/search"); e.currentTarget.q.value = ""; }}
              className="flex items-center gap-1.5 bg-muted/40 border border-border/50 rounded-lg px-2.5 py-1.5 focus-within:border-primary/50 transition-colors"
            >
              <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <input
                name="q"
                type="text"
                placeholder="Search events, artists…"
                className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none w-36 xl:w-52"
              />
            </form>
            <MessagesNavIcon />
            <NotificationBell />
            <LanguageSwitcher />

            {/* Desktop User Dropdown */}
            {user ? (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => { hapticLight(); setProfileOpen((v) => !v); }}
                  className="flex items-center gap-1.5 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors touch-manipulation"
                  style={{ WebkitTapHighlightColor: "transparent" }}
                >
                  <div className="w-7 h-7 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
                    <User className="w-3.5 h-3.5 text-primary" />
                  </div>
                  {modeBadge && (
                    <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full ${modeBadgeColor}`}>
                      {modeBadge}
                    </span>
                  )}
                  <ChevronDown className="w-3 h-3 opacity-60" />
                </button>

                {profileOpen && (
                  <div className="absolute right-0 top-full mt-2 w-52 bg-card border border-border/60 rounded-xl shadow-xl overflow-hidden z-50">
                    <div className="px-4 py-3 border-b border-border/40">
                      <p className="text-sm font-bold truncate">{user.full_name || user.email}</p>
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                      {modeBadge && (
                        <span className={`mt-1 inline-block text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${modeBadgeColor}`}>
                          {modeBadge}
                        </span>
                      )}
                    </div>

                    {/* Account switch — only for non-admin multi-role users */}
                    {hasMultiMode && (
                      <div className="px-2 py-1.5 border-b border-border/40 space-y-0.5">
                        {canSwitchHost && accountMode !== "host" && (
                          <button onClick={() => handleSwitchMode("host")}
                            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-accent hover:bg-accent/10 transition-colors">
                            <ArrowLeftRight className="w-4 h-4 shrink-0" /> Switch to Host Account
                          </button>
                        )}
                        {canSwitchArtist && accountMode !== "artist" && (
                          <button onClick={() => handleSwitchMode("artist")}
                            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-yellow-400 hover:bg-yellow-400/10 transition-colors">
                            <ArrowLeftRight className="w-4 h-4 shrink-0" /> Switch to Artist Account
                          </button>
                        )}
                        {accountMode !== "fan" && (
                          <button onClick={() => handleSwitchMode("fan")}
                            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-primary hover:bg-primary/10 transition-colors">
                            <ArrowLeftRight className="w-4 h-4 shrink-0" /> Switch to Fan Account
                          </button>
                        )}
                      </div>
                    )}

                    <div className="px-2 py-1.5">
                      <Link
                        to={
                          isAdmin ? "/profile"
                          : accountMode === "fan" ? "/profile"
                          : accountMode === "host" ? "/organizer/profile"
                          : accountMode === "artist" ? "/artist"
                          : "/profile"
                        }
                        onClick={() => setProfileOpen(false)}
                        className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                        <User className="w-4 h-4" /> Profile
                      </Link>
                      {!isAdmin && isWhiteLabel && (
                        <Link to="/agent-dashboard" onClick={() => setProfileOpen(false)}
                          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-primary hover:bg-primary/10 transition-colors">
                          <Globe className="w-4 h-4" /> WL Dashboard
                        </Link>
                      )}
                      {!isAdmin && accountMode !== "host" && (
                        <Link to="/my-tickets" onClick={() => setProfileOpen(false)}
                          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                          <Ticket className="w-4 h-4" /> {t("my_tickets")}
                        </Link>
                      )}
                      {!isAdmin && (
                        <Link to="/saved" onClick={() => setProfileOpen(false)}
                          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                          <Bookmark className="w-4 h-4" /> {t("saved_events")}
                        </Link>
                      )}
                      {!isAdmin && accountMode === "fan" && (
                        <>
                          <Link to="/giveaways" onClick={() => setProfileOpen(false)}
                            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                            <Gift className="w-4 h-4" /> Giveaways
                          </Link>
                          <Link to="/my-prizes" onClick={() => setProfileOpen(false)}
                            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                            <Trophy className="w-4 h-4" /> My Prizes
                          </Link>
                          <Link to="/fan-profile?tab=loyalty" onClick={() => setProfileOpen(false)}
                            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                            <Star className="w-4 h-4" /> Loyalty & Rewards
                          </Link>
                        </>
                      )}
                    </div>

                    <div className="px-2 py-1.5 border-t border-border/40">
                      <button onClick={() => { setProfileOpen(false); base44.auth.logout(); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors">
                        Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="font-display font-bold border-primary/40 text-primary hover:bg-primary/10"
                  onClick={() => {
                    localStorage.setItem("organizer_signup_intent", "true");
                    base44.auth.redirectToLogin("/organizer/signup");
                  }}
                >
                  Join as Organizer
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="font-display font-bold border-primary/40 text-primary hover:bg-primary/10"
                  onClick={() => {
                    localStorage.setItem("artist_signup_intent", "true");
                    base44.auth.redirectToLogin("/artist/signup");
                  }}
                >
                  Join as Artist
                </Button>
                <Button onClick={() => base44.auth.redirectToLogin()} size="sm" className="font-display font-bold">
                  {t("login_signup")}
                </Button>
              </div>
            )}
            <a href="#contact-form" className="p-2 text-muted-foreground hover:text-foreground transition-colors" title={t("contact_support")}>
              <HelpCircle className="w-4 h-4" />
            </a>
          </div>

          {/* Mobile / Tablet Right Side */}
          <div className="flex lg:hidden items-center gap-1 shrink-0 ml-auto">
            {/* Mobile search — compact input + icon */}
            <form
              onSubmit={(e) => { e.preventDefault(); const q = e.currentTarget.q.value.trim(); navigate(q ? `/search?q=${encodeURIComponent(q)}` : "/search"); e.currentTarget.q.value = ""; setIsOpen(false); }}
              className="flex items-center gap-1 bg-muted/40 border border-border/40 rounded-lg px-2 py-1 focus-within:border-primary/50 transition-colors"
            >
              <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <input
                name="q"
                type="text"
                placeholder="Search…"
                className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none w-20 sm:w-28"
              />
            </form>
            <NotificationBell />
            <LanguageSwitcher />
            <button
              onClick={() => { hapticLight(); setIsOpen(!isOpen); }}
              className="p-2 text-muted-foreground hover:text-foreground transition-colors touch-manipulation"
              aria-label="Toggle menu"
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>

        </div>
      </div>

      {/* Mobile Dropdown */}
      {isOpen && (
        <div className="lg:hidden bg-background border-b border-border max-h-[calc(100vh-64px)] overflow-y-auto">
          <div className="px-4 py-3 space-y-1">
            {/* Mobile: mode badge — admin or multi-role only */}
            {user && modeBadge && (
              <div className="px-3 py-2 flex items-center gap-2">
                <span className="text-xs text-muted-foreground font-mono">Current Mode:</span>
                <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded-full ${modeBadgeColor}`}>
                  {modeBadge}
                </span>
              </div>
            )}

            {/* Mobile: account switch buttons — non-admin multi-role only */}
            {user && hasMultiMode && (
              <>
                {canSwitchHost && accountMode !== "host" && (
                  <button onClick={() => handleSwitchMode("host")}
                    className="flex items-center gap-2 w-full px-3 py-2.5 rounded-md text-sm font-medium text-accent hover:bg-accent/10 transition-colors font-bold">
                    <ArrowLeftRight className="w-4 h-4" /> Switch to Host Account
                  </button>
                )}
                {canSwitchArtist && accountMode !== "artist" && (
                  <button onClick={() => handleSwitchMode("artist")}
                    className="flex items-center gap-2 w-full px-3 py-2.5 rounded-md text-sm font-medium text-yellow-400 hover:bg-yellow-400/10 transition-colors font-bold">
                    <ArrowLeftRight className="w-4 h-4" /> Switch to Artist Account
                  </button>
                )}
                {accountMode !== "fan" && (
                  <button onClick={() => handleSwitchMode("fan")}
                    className="flex items-center gap-2 w-full px-3 py-2.5 rounded-md text-sm font-medium text-primary hover:bg-primary/10 transition-colors font-bold">
                    <ArrowLeftRight className="w-4 h-4" /> Switch to Fan Account
                  </button>
                )}
              </>
            )}

            <div className="h-px bg-border/50 my-2" />

            {dashLink && (
              <Link to={dashLink.to} onClick={() => setIsOpen(false)}
                className="flex items-center gap-2 px-3 py-2.5 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                <LayoutDashboard className="w-4 h-4" /> {dashLink.label}
              </Link>
            )}

            {user && (
              <>
                {!isAdmin && isWhiteLabel && (
                  <Link to="/agent-dashboard" onClick={() => setIsOpen(false)}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-md text-sm font-medium text-primary hover:bg-primary/10 transition-colors font-bold">
                    <Globe className="w-4 h-4" /> WL Dashboard
                  </Link>
                )}
                {!isAdmin && accountMode !== "host" && (
                  <Link to="/my-tickets" onClick={() => setIsOpen(false)}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                    <Ticket className="w-4 h-4" /> {t("my_tickets")}
                  </Link>
                )}
                <Link
                  to={
                    isAdmin ? "/profile"
                    : accountMode === "fan" ? "/profile"
                    : accountMode === "host" ? "/organizer/profile"
                    : accountMode === "artist" ? "/artist"
                    : "/profile"
                  }
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                  <User className="w-4 h-4" /> {t("profile")}
                </Link>
                {!isAdmin && (
                  <Link to="/saved" onClick={() => setIsOpen(false)}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                    <Bookmark className="w-4 h-4" /> {t("saved_events")}
                  </Link>
                )}
                <Link to="/messages" onClick={() => setIsOpen(false)}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                  <MailIcon className="w-4 h-4" /> Messages
                </Link>
                {!isAdmin && accountMode === "fan" && (
                  <>
                    <Link to="/giveaways" onClick={() => setIsOpen(false)}
                      className="flex items-center gap-2 px-3 py-2.5 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                      <Gift className="w-4 h-4" /> Giveaways
                    </Link>
                    <Link to="/my-prizes" onClick={() => setIsOpen(false)}
                      className="flex items-center gap-2 px-3 py-2.5 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                      <Trophy className="w-4 h-4" /> My Prizes
                    </Link>
                    <Link to="/fan-profile?tab=loyalty" onClick={() => setIsOpen(false)}
                      className="flex items-center gap-2 px-3 py-2.5 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                      <Star className="w-4 h-4" /> Loyalty & Rewards
                    </Link>
                  </>
                )}
              </>
            )}

            <div className="h-px bg-border/50 my-2" />

            <a href="#contact-form" onClick={() => setIsOpen(false)}
              className="flex items-center gap-2 px-3 py-2.5 rounded-md text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
              <HelpCircle className="w-4 h-4" /> {t("contact_support")}
            </a>

            {user ? (
              <button onClick={() => { hapticMedium(); setIsOpen(false); base44.auth.logout(); }}
                className="flex items-center gap-2 w-full px-3 py-2.5 rounded-md text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors touch-manipulation"
                style={{ WebkitTapHighlightColor: "transparent" }}>
                Sign Out
              </button>
            ) : (
              <>
                <button
                  onClick={() => {
                    setIsOpen(false);
                    localStorage.setItem("organizer_signup_intent", "true");
                    base44.auth.redirectToLogin("/organizer/signup");
                  }}
                  className="flex w-full px-3 py-2.5 rounded-md text-sm font-medium text-primary hover:bg-primary/10 transition-colors font-bold">
                  Join as Organizer
                </button>
                <button
                  onClick={() => {
                    setIsOpen(false);
                    localStorage.setItem("artist_signup_intent", "true");
                    base44.auth.redirectToLogin("/artist/signup");
                  }}
                  className="flex items-center gap-2 w-full px-3 py-2.5 rounded-md text-sm font-medium text-primary hover:bg-primary/10 transition-colors">
                  Join as Artist
                </button>
                <button onClick={() => { setIsOpen(false); base44.auth.redirectToLogin(); }}
                  className="flex items-center gap-2 w-full px-3 py-2.5 rounded-md text-sm font-medium text-primary hover:bg-primary/10 transition-colors font-display font-bold">
                  {t("login_signup")}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}