import { useState, useEffect, useRef, useMemo } from "react";
import { filterUpcomingEvents } from "@/utils/eventUtils";
import { compactNumber, fullNumber } from "@/utils/formatNumber";
import { useParams, useNavigate, Link, useLocation } from "react-router-dom";
import { ArrowLeft, MapPin, Globe, Instagram, Twitter, Calendar, Users, Images, FileText, Play, X, Star, Gift, Ticket, Percent, DollarSign, Trophy, Mail, ChevronDown, ChevronUp, User, Edit2, Pencil, Shield } from "lucide-react";
import GiveawayHighlight from "@/components/events/GiveawayHighlight";
import Video360Player from "@/components/media/Video360Player";
import MediaVideoPlayer from "@/components/media/MediaVideoPlayer";
import MapDirectionLink from "@/components/shared/MapDirectionLink";
import OrganizerFollowButton from "@/components/shared/OrganizerFollowButton";
import ContactOrganizerModal from "@/components/organizer/ContactOrganizerModal";
import FollowersPopup from "@/components/organizer/FollowersPopup";
import OrganizerBioText from "@/components/organizer/OrganizerBioText";
import PageMeta from "@/components/seo/PageMeta";
import PostInteractionBar from "@/components/media/PostInteractionBar";
import PostInteractionsSheet from "@/components/media/PostInteractionsSheet";
import EditOrganizerPostModal from "@/components/organizer/EditOrganizerPostModal";
import useMediaLimitFilter from "@/hooks/useMediaLimitFilter";
import { base44 } from "@/api/base44Client";
import { format, isToday, isYesterday, differenceInCalendarDays } from "date-fns";

function formatPostedDate(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "";
  if (isToday(d)) return "Posted today";
  if (isYesterday(d)) return "Posted yesterday";
  const daysAgo = differenceInCalendarDays(new Date(), d);
  if (daysAgo > 0 && daysAgo <= 6) return `Posted ${daysAgo} days ago`;
  return `Posted ${format(d, "MMM d, yyyy")}`;
}

const REWARD_LABELS = {
  free_ticket: "🎟 Event Entry Ticket",
  discount: "% Discount",
  backstage_access: "🎤 Backstage Access",
  credit: "💳 Credit",
  custom: "🎁 Custom Reward",
  none: null,
};

export default function OrganizerPublicProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const routerLocation = useLocation();
  const [organizer, setOrganizer] = useState(null);
  const [profile, setProfile] = useState(null);
  const [events, setEvents] = useState([]);
  const [posts, setPosts] = useState([]);
  const [gallery, setGallery] = useState([]);
  const [loyaltyTiers, setLoyaltyTiers] = useState([]);
  const [userLoyalty, setUserLoyalty] = useState(null); // fan's loyalty account if logged in
  const [currentUser, setCurrentUser] = useState(null);
  const [followerCount, setFollowerCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState(null);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [interactionsPost, setInteractionsPost] = useState(null);
  const [editingPost, setEditingPost] = useState(null);
  const [followers, setFollowers] = useState([]);
  const [followersPopupOpen, setFollowersPopupOpen] = useState(false);
  const [adminOrgUser, setAdminOrgUser] = useState(null); // admin-only user record for private account details

  // Apply media limit filters to gallery and posts
  const { filtered: galleryToShow } = useMediaLimitFilter(gallery);
  const { filtered: postsToShow } = useMediaLimitFilter(posts);

  const scrollToSection = (id) => {
    const el = document.getElementById(id);
    if (!el) return;
    const offset = 72; // sticky header height (56px) + extra breathing room
    const top = el.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top, behavior: "smooth" });
  };

  useEffect(() => {
    (async () => {
      const [profiles, evs, mediaPosts, galleryPosts, loyaltyData, listOrgRes, me] = await Promise.all([
        base44.entities.OrganizerProfile.filter({ organizer_id: id }, null, 1).catch(() => []),
        base44.entities.Event.filter({ organizer_id: id, status: "published" }, "date", 50).catch(() => []),
        base44.entities.OrganizerMediaPost.filter({ organizer_id: id, status: "active", approval_status: "approved", upload_section: "organizer_media", is_playable: true }, "-created_date", 20).catch(() => []),
        base44.entities.OrganizerMediaPost.filter({ organizer_id: id, status: "active", upload_section: "organizer_media", is_playable: true }, "-created_date", 100).catch(() => []),
        base44.entities.OrganizerLoyaltyTier.filter({ organizer_id: id }, "tier_number", 20).catch(() => []),
        base44.functions.invoke("listOrganizers", {}).catch(() => ({ data: { organizers: [] } })),
        base44.auth.me().catch(() => null),
      ]);
      // Use OrganizerProfile if it exists, otherwise fall back to backend organizer lookup
      const prof = profiles[0] || null;
      const organizers = listOrgRes?.data?.organizers || [];
      const orgInfo = organizers.find(o => String(o.organizer_id) === String(id)) || null;

      // Build a synthetic profile from events data if needed. Only ever use the
      // public Business Name — never a private full_name/email fallback.
      const firstEvent = evs[0];
      const resolvedProfile = prof || (orgInfo?.business_name ? {
        organizer_id: orgInfo.organizer_id,
        organizer_email: "",
        business_name: orgInfo.business_name,
      } : firstEvent ? {
        // Events store the organizer's business name as organizer_name
        organizer_id: id,
        organizer_email: firstEvent.organizer_id || "",
        business_name: firstEvent.organizer_name || "",
      } : null);

      setOrganizer(resolvedProfile);
      setProfile(resolvedProfile);
      setEvents(filterUpcomingEvents(evs));
      setPosts(mediaPosts);
      const filteredTiers = loyaltyData.filter(t => t.tier_name?.trim());
      setLoyaltyTiers(filteredTiers);
      // Gallery: show all active media uploaded via the Media Library for this
      // organizer. We do NOT require admin approval — organizer-uploaded media
      // appears automatically. Only content the moderation system has actively
      // blocked or an admin rejected is hidden.
      setGallery(galleryPosts.filter(p => p.approval_status !== "blocked" && p.approval_status !== "rejected"));
      setCurrentUser(me);
      // Admin-only: fetch the user account record for private details (first/last name, email, status, signup date)
      if (me?.role === "admin") {
        base44.entities.User.filter({ id }, null, 1)
          .then(users => setAdminOrgUser(users[0] || null))
          .catch(() => {});
      }
      // Show stored follower count immediately so the profile (and Follow
      // button skeleton) render without waiting for the follow-list fetch.
      setFollowerCount(resolvedProfile?.follower_count || 0);
      setLoading(false);

      // Load follower data (source of truth from OrganizerFollow records) — non-blocking
      (async () => {
        const allFollows = await base44.entities.OrganizerFollow.filter({ organizer_id: id }, null, 5000).catch(() => []);
        const realCount = allFollows.length;
        setFollowerCount(realCount);
        setFollowers(allFollows);
        if (resolvedProfile?.id && resolvedProfile.follower_count !== realCount) {
          base44.entities.OrganizerProfile.update(resolvedProfile.id, { follower_count: realCount }).catch(() => {});
        }
      })();

      // Load user-specific loyalty data (non-blocking)
      if (me && filteredTiers.length > 0) {
        const loyAccs = await base44.entities.LoyaltyAccount.filter({ user_email: me.email }, null, 1).catch(() => []);
        if (loyAccs[0]) setUserLoyalty(loyAccs[0]);
      }
    })();
  }, [id]);

  // After data finishes loading, auto-scroll to the target section
  useEffect(() => {
    if (loading) return;

    const getTargetSection = () => {
      const params = new URLSearchParams(routerLocation.search);
      return (
        params.get("section") ||
        routerLocation.hash?.replace("#", "") ||
        routerLocation.state?.section ||
        null
      );
    };

    const sectionId = getTargetSection();
    if (!sectionId) return;

    const scrollToTargetSection = (attempt = 0) => {
      const el = document.getElementById(sectionId);
      if (!el) {
        if (attempt < 20) setTimeout(() => scrollToTargetSection(attempt + 1), 150);
        return;
      }
      const top = el.getBoundingClientRect().top + window.scrollY - 72;
      window.scrollTo({ top, behavior: "smooth" });
    };

    const timer = setTimeout(() => scrollToTargetSection(), 300);
    return () => clearTimeout(timer);
  }, [loading, routerLocation.search, routerLocation.hash, routerLocation.state, loyaltyTiers.length]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  // A profile record with no Business Name is incomplete — never show a
  // public page built on private full_name/email data.
  if (!organizer || !organizer.business_name?.trim()) {
    const isOwnProfile = currentUser?.id === id;
    const isOrganizer = currentUser?.role === "organizer" || currentUser?.role === "manager";
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-sm space-y-4">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto">
            <Users className="w-8 h-8 text-muted-foreground/40" />
          </div>
          {isOwnProfile && isOrganizer ? (
            <>
              <p className="font-display font-bold text-xl">Your organizer profile isn't set up yet</p>
              <p className="text-sm text-muted-foreground">Add a Business Name to your profile so fans can find you and your events.</p>
              <button
                onClick={() => navigate("/organizer/profile")}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 transition-colors"
              >
                Complete Organizer Profile
              </button>
            </>
          ) : (
            <>
              <p className="font-display font-bold text-xl">Profile Not Found</p>
              <p className="text-sm text-muted-foreground">This organizer hasn't added a Business Name yet, so their public profile isn't available.</p>
            </>
          )}
          <button onClick={() => navigate(-1)} className="block text-sm text-primary hover:underline mx-auto">
            ← Go Back
          </button>
        </div>
      </div>
    );
  }

  const displayName = profile.business_name;
  const location = [profile?.city, profile?.state, profile?.country].filter(Boolean).join(", ");
  const isOwner = currentUser?.id === id || currentUser?.email === profile?.organizer_email;

  return (
    <div className="min-h-screen pb-28">
      {organizer && (
        <PageMeta
          title={`${displayName} — REIZOR`}
          description={`${displayName}${location ? ` — ${location}` : ""}. Browse upcoming events, media gallery, and loyalty rewards. ${organizer.bio ? ` ${organizer.bio.slice(0, 120)}...` : ""}`}
          canonical={`https://reizor.com/organizers/${id}`}
          ogImage={profile?.profile_image || ""}
        />
      )}
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-xl border-b border-border/40">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-muted transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="font-display font-bold text-base truncate">{displayName}</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-4 pb-8 space-y-6">

        {/* Profile Card */}
        <div className="p-5 sm:p-6 rounded-2xl bg-card border border-border/50 space-y-4">
          <div className="flex items-start gap-5">
            {profile?.profile_image ? (
              <img src={profile.profile_image} alt={displayName}
                className="w-20 h-20 rounded-full object-cover border-2 border-primary/30 shrink-0" />
            ) : (
              <div className="w-20 h-20 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center shrink-0">
                <Users className="w-8 h-8 text-primary" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <span className="font-mono text-[10px] text-orange-400 uppercase tracking-widest font-bold">Organizer</span>
              <h2 className="font-display font-black text-2xl tracking-tight mt-0.5">{displayName}</h2>
              {isOwner ? (
                <button onClick={() => setFollowersPopupOpen(true)} className="text-xs text-muted-foreground mt-0.5 hover:text-primary transition-colors flex items-center gap-1 cursor-pointer">
                  <span title={fullNumber(followerCount)}>{compactNumber(followerCount)}</span> {followerCount === 1 ? "follower" : "followers"}
                  <ChevronDown className="w-3 h-3" />
                </button>
              ) : (
                <p className="text-xs text-muted-foreground mt-0.5">
                  <span title={fullNumber(followerCount)}>{compactNumber(followerCount)}</span> {followerCount === 1 ? "follower" : "followers"}
                </p>
              )}
              {location && (
                <p className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                  <MapPin className="w-3.5 h-3.5" /> {location}
                </p>
              )}
            </div>
          </div>

          <OrganizerBioText bio={profile?.bio} />

          {/* Social links */}
          <div className="flex flex-wrap gap-3">
            {profile?.website && (
              <a href={profile.website} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs font-mono text-accent hover:underline">
                <Globe className="w-3.5 h-3.5" /> Website
              </a>
            )}
            {profile?.instagram && (
              <a href={profile.instagram} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs font-mono text-pink-400 hover:underline">
                <Instagram className="w-3.5 h-3.5" /> Instagram
              </a>
            )}
            {profile?.twitter && (
              <a href={profile.twitter} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs font-mono text-accent hover:underline">
                <Twitter className="w-3.5 h-3.5" /> Twitter
              </a>
            )}
          </div>

          {/* Follow + Contact buttons */}
          <div className="flex items-center gap-3 pt-1 flex-wrap">
            <OrganizerFollowButton
              organizerId={id}
              organizerName={displayName}
              organizerProfile={profile}
              isOwner={isOwner}
              onFollowChange={(newCount) => setFollowerCount(newCount)}
            />
            <button
              onClick={() => setContactModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-primary/60 text-primary font-bold text-sm hover:bg-primary/10 transition-colors"
            >
              <Mail className="w-4 h-4" />
              Contact Organizer
            </button>
            {isOwner && (
              <Link to="/organizer/profile" className="inline-flex">
                <button className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 transition-colors touch-manipulation">
                  <Edit2 className="w-4 h-4" /> Edit Profile
                </button>
              </Link>
            )}
          </div>
        </div>

        {/* Admin Only — Account Details (visible to admins only, never shown publicly) */}
        {currentUser?.role === "admin" && adminOrgUser && (
          <div className="p-4 rounded-2xl bg-destructive/5 border border-destructive/20 space-y-3">
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-destructive" />
              <p className="font-display font-bold text-sm text-destructive">Admin Only — Account Details</p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-[10px] font-mono text-muted-foreground uppercase">First Name</p>
                <p className="font-medium">{adminOrgUser.full_name?.split(" ")[0] || "—"}</p>
              </div>
              <div>
                <p className="text-[10px] font-mono text-muted-foreground uppercase">Last Name</p>
                <p className="font-medium">{adminOrgUser.full_name?.split(" ").slice(1).join(" ") || "—"}</p>
              </div>
              <div>
                <p className="text-[10px] font-mono text-muted-foreground uppercase">Account Email</p>
                <p className="font-medium truncate">{adminOrgUser.email || "—"}</p>
              </div>
              <div>
                <p className="text-[10px] font-mono text-muted-foreground uppercase">Business Name</p>
                <p className="font-medium truncate">{profile?.business_name || "—"}</p>
              </div>
              <div>
                <p className="text-[10px] font-mono text-muted-foreground uppercase">Account Status</p>
                <p className="font-medium capitalize">{adminOrgUser.role || "—"}</p>
              </div>
              <div>
                <p className="text-[10px] font-mono text-muted-foreground uppercase">Signup Date</p>
                <p className="font-medium">{adminOrgUser.created_date ? format(new Date(adminOrgUser.created_date), "MMM d, yyyy") : "—"}</p>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground">This section is visible to admins only and is never shown on the public profile.</p>
          </div>
        )}

        {/* Upcoming Events */}
        <div id="upcoming-events" className="scroll-mt-20">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-5 h-5 text-primary" />
            <h3 className="font-display font-black text-xl tracking-tight">UPCOMING EVENTS</h3>
            <span className="font-mono text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">{events.length}</span>
          </div>

          {events.length === 0 ? (
            <div className="py-12 text-center rounded-xl bg-card border border-border/50">
              <Calendar className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="font-display font-bold text-base text-muted-foreground">Coming Soon</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {events.map(event => (
                <div key={event.id} className="space-y-2">
                  <Link to={`/events/${event.id}`}
                    className="group flex gap-4 p-4 rounded-xl bg-card border border-border/50 hover:border-primary/40 transition-all">
                    {event.cover_image ? (
                      <img src={event.cover_image} alt={event.title}
                        className="w-20 h-20 rounded-lg object-cover shrink-0" />
                    ) : (
                      <div className="w-20 h-20 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Calendar className="w-7 h-7 text-primary" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-display font-bold text-sm leading-tight truncate group-hover:text-primary transition-colors">
                        {event.title}
                      </p>
                      <p className="font-mono text-[10px] text-muted-foreground mt-1 truncate">
                        {event.venue_name}{event.city ? `, ${event.city}` : ""}
                      </p>
                      <p className="font-mono text-[10px] text-primary mt-1 font-bold">
                        {event.date ? format(new Date(event.date), "EEE, MMM dd · yyyy") : "Date TBA"}
                      </p>
                      {event.min_price != null && (
                        <p className="font-mono text-[10px] text-muted-foreground mt-1">
                          {event.min_price === 0 ? "Free" : `From $${event.min_price}`}
                        </p>
                      )}
                      <MapDirectionLink
                        venueName={event.venue_name}
                        city={event.city}
                        country={event.country}
                        latitude={event.latitude}
                        longitude={event.longitude}
                        compact
                        className="text-[10px] font-mono mt-1"
                      />
                    </div>
                  </Link>
                  <GiveawayHighlight eventId={event.id} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Gallery */}
        <div id="gallery" className="scroll-mt-20">
          <div className="flex items-center gap-2 mb-4">
            <Images className="w-5 h-5 text-primary" />
            <h3 className="font-display font-black text-xl tracking-tight">GALLERY</h3>
            <span className="font-mono text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">{galleryToShow.length}</span>
          </div>
          {galleryToShow.length === 0 ? (
            <div className="py-10 text-center rounded-xl bg-card border border-border/50">
              <Images className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider">No media uploaded yet</p>
              <p className="text-sm text-muted-foreground mt-1">Upload photos or videos to build your gallery.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {galleryToShow.map(item => (
                <div
                  key={item.id}
                  className="relative aspect-square rounded-xl overflow-hidden cursor-pointer group"
                  onClick={() => setLightbox({
                    url: item.mux_playback_url || item.media_url,
                    type: item.media_type,
                    is_360: item.is_360,
                    mobile_playback_url: item.mobile_playback_url,
                    desktop_optimized_url: item.desktop_optimized_url,
                    thumbnail_url: item.thumbnail_url,
                    mux_playback_id: item.mux_playback_id,
                    mux_status: item.mux_status,
                  })}
                >
                  <img
                    src={item.thumbnail_url || item.media_url}
                    alt={item.caption || ""}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  {item.media_type === "video" && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-10 h-10 rounded-full bg-black/60 flex items-center justify-center">
                        <Play className="w-4 h-4 text-white ml-0.5" />
                      </div>
                    </div>
                  )}
                  {item.is_360 && (
                    <div className="absolute top-2 left-2 z-10 font-mono text-[9px] font-black bg-accent/90 text-white px-1.5 py-0.5 rounded-full">360°</div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-1.5 space-y-0.5">
                    <p className="text-[10px] font-bold text-white truncate drop-shadow">{item.caption || (item.media_type === "video" ? "Video" : "Photo")}</p>
                    {item.created_date && (
                      <p className="text-[8px] text-white/60 truncate">{formatPostedDate(item.created_date)}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Post Feed */}
        <div id="posts" className="scroll-mt-20">
          <div className="flex items-center gap-2 mb-4">
            <FileText className="w-5 h-5 text-accent" />
            <h3 className="font-display font-black text-xl tracking-tight">POSTS</h3>
            <span className="font-mono text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">{postsToShow.length}</span>
          </div>
          {postsToShow.length === 0 ? (
            <div className="py-10 text-center rounded-xl bg-card border border-border/50">
              <FileText className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="font-display font-bold text-base text-muted-foreground">Coming Soon</p>
            </div>
          ) : (
            <div className="space-y-4">
              {postsToShow.map(post => (
                <div key={post.id} className="rounded-xl bg-card border border-border/50 overflow-hidden">
                  {post.media_url && (
                    <div
                      className="relative cursor-pointer"
                      onClick={() => setLightbox({ url: post.mux_playback_url || post.media_url, type: post.media_type, is_360: post.is_360, mobile_playback_url: post.mobile_playback_url, desktop_optimized_url: post.desktop_optimized_url, thumbnail_url: post.thumbnail_url, mux_playback_id: post.mux_playback_id, mux_status: post.mux_status })}
                    >
                      {post.media_type === "video" ? (
                        <div className="relative aspect-video bg-black flex items-center justify-center">
                          <MediaVideoPlayer src={post.mux_playback_url || post.media_url} mobileSrc={post.mobile_playback_url} desktopSrc={post.desktop_optimized_url} poster={post.thumbnail_url} className="w-full h-full" controls={false} muted />
                          {post.is_360 && (
                            <div className="absolute top-2 left-2 z-10 font-mono text-[9px] font-black bg-accent/90 text-white px-1.5 py-0.5 rounded-full">360°</div>
                          )}
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-14 h-14 rounded-full bg-black/60 flex items-center justify-center">
                              <Play className="w-6 h-6 text-white ml-1" />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <img src={post.media_url} alt={post.caption || "Post"} className="w-full max-h-80 object-cover" />
                      )}
                    </div>
                  )}
                  <div className="p-4 space-y-1.5">
                    {(currentUser?.role === "admin" || post.created_by_id === currentUser?.id || post.created_by === currentUser?.email) && (
                      <div className="flex justify-end">
                        <button
                          onClick={() => setEditingPost(post)}
                          className="w-9 h-9 flex items-center justify-center rounded-xl bg-primary/15 border-2 border-primary/50 text-primary hover:bg-primary hover:text-primary-foreground hover:border-primary hover:shadow-md hover:shadow-primary/40 active:scale-95 transition-all"
                          aria-label="Edit post"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                    {post.caption && <p className="text-sm leading-relaxed">{post.caption}</p>}
                    <div className="flex flex-wrap gap-3 text-[11px] font-mono text-muted-foreground">
                      {post.venue_name && <span>📍 {post.venue_name}{post.city ? `, ${post.city}` : ""}</span>}
                      {post.event_date && <span>📅 {format(new Date(post.event_date), "MMM d, yyyy")}</span>}
                    </div>
                    <PostInteractionBar
                      post={post}
                      currentUser={currentUser}
                      onOpenSheet={() => setInteractionsPost(post)}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Loyalty Program */}
        {loyaltyTiers.length > 0 && (
          <div id="loyalty-program" className="scroll-mt-20">
            <div className="flex items-center gap-2 mb-4">
              <Star className="w-5 h-5 text-yellow-400" />
              <h3 className="font-display font-black text-xl tracking-tight">REWARDS PROGRAM</h3>
            </div>

            {/* Hero banner */}
            <div className="rounded-2xl bg-gradient-to-br from-yellow-400/10 to-primary/5 border border-yellow-400/25 overflow-hidden mb-4">
              <div className="p-5 space-y-3">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-yellow-400/15 flex items-center justify-center shrink-0">
                    <Trophy className="w-6 h-6 text-yellow-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-display font-black text-lg tracking-tight">Earn Rewards</p>
                    <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">
                      Attend <strong className="text-foreground">{displayName}</strong>'s events to unlock exclusive rewards and tier benefits.
                    </p>
                  </div>
                </div>

                {/* User-specific status */}
                {currentUser && userLoyalty ? (
                  <div className="p-3 rounded-xl bg-yellow-400/10 border border-yellow-400/30 space-y-1">
                    <p className="font-mono text-[10px] uppercase tracking-wider text-yellow-400 font-bold">Your Status</p>
                    <div className="flex flex-wrap gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground text-xs">Events Attended</span>
                        <p className="font-display font-bold">{userLoyalty.attended_count || 0}</p>
                      </div>
                      {userLoyalty.cashback_balance > 0 && (
                        <div>
                          <span className="text-muted-foreground text-xs">Cashback Balance</span>
                          <p className="font-display font-bold text-yellow-400">${userLoyalty.cashback_balance?.toFixed(2)}</p>
                        </div>
                      )}
                      {(() => {
                        const attended = userLoyalty.attended_count || 0;
                        const currentTier = [...loyaltyTiers].reverse().find(t => attended >= (t.events_required || 0));
                        const nextTier = loyaltyTiers.find(t => (t.events_required || 0) > attended);
                        return currentTier ? (
                          <div>
                            <span className="text-muted-foreground text-xs">Current Tier</span>
                            <p className="font-display font-bold text-yellow-400">⭐ {currentTier.tier_name}</p>
                            {nextTier && (
                              <p className="font-mono text-[10px] text-muted-foreground mt-0.5">
                                {(nextTier.events_required || 0) - attended} more event{(nextTier.events_required || 0) - attended !== 1 ? "s" : ""} to {nextTier.tier_name}
                              </p>
                            )}
                          </div>
                        ) : null;
                      })()}
                    </div>
                  </div>
                ) : currentUser ? (
                  <div className="p-3 rounded-xl bg-muted/40 border border-border/40">
                    <p className="text-sm text-muted-foreground">🎫 Start attending <strong className="text-foreground">{displayName}</strong>'s events to earn loyalty tiers and rewards.</p>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-muted/40 border border-border/40">
                    <p className="text-sm text-muted-foreground">🔐 <strong className="text-foreground">Sign in</strong> to track your loyalty tier and rewards with this organizer.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Tiers grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {loyaltyTiers.map((tier, i) => {
                const userAttended = userLoyalty?.attended_count || 0;
                const isUnlocked = userAttended >= (tier.events_required || 0);
                return (
                  <div key={tier.id || i} className={`p-4 rounded-xl border space-y-2 ${isUnlocked && currentUser ? "bg-yellow-400/5 border-yellow-400/30" : "bg-card border-border/50"}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`w-7 h-7 rounded-full flex items-center justify-center font-mono text-xs font-bold border ${isUnlocked && currentUser ? "bg-yellow-400/20 border-yellow-400/50 text-yellow-400" : "bg-primary/10 border-primary/30 text-primary"}`}>
                          {i + 1}
                        </span>
                        <span className="font-display font-bold text-sm">{tier.tier_name}</span>
                      </div>
                      {isUnlocked && currentUser && (
                        <span className="text-[10px] font-mono font-bold text-yellow-400 bg-yellow-400/10 px-2 py-0.5 rounded-full">Unlocked ✓</span>
                      )}
                    </div>
                    {tier.events_required > 0 && (
                      <p className="font-mono text-[10px] text-muted-foreground">
                        🎫 {tier.events_required} event{tier.events_required !== 1 ? "s" : ""} required
                      </p>
                    )}
                    {tier.description && (
                      <p className="text-xs text-muted-foreground leading-relaxed">{tier.description}</p>
                    )}
                    {tier.reward_type && tier.reward_type !== "none" && (
                      <div className="flex items-center gap-1.5 pt-1 border-t border-border/30">
                        <Gift className="w-3 h-3 text-yellow-400 shrink-0" />
                        <span className="font-mono text-[10px] font-bold text-yellow-400">
                          {tier.reward_type === "discount" && tier.reward_value ? `${tier.reward_value}% Discount` :
                           tier.reward_type === "credit" && tier.reward_value ? `$${tier.reward_value} Credit` :
                           tier.reward_type === "custom" ? (tier.custom_reward || "Custom Reward") :
                           REWARD_LABELS[tier.reward_type] || tier.reward_type}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <p className="text-xs text-muted-foreground text-center font-mono mt-3">
              🏆 Rewards are earned by attending {displayName}'s events
            </p>
          </div>
        )}

      </div>

      {/* Sticky bottom section nav */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-xl border-t border-border/50">
        <div className="max-w-4xl mx-auto px-2 h-12 flex items-center gap-1 overflow-x-auto scrollbar-none">
          <button onClick={() => scrollToSection("posts")}
            className="shrink-0 px-3 py-1.5 rounded-lg text-[10px] font-mono font-bold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors uppercase tracking-widest">
            Posts
          </button>
          <button onClick={() => scrollToSection("gallery")}
            className="shrink-0 px-3 py-1.5 rounded-lg text-[10px] font-mono font-bold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors uppercase tracking-widest">
            Gallery
          </button>
          {loyaltyTiers.length > 0 && (
            <button onClick={() => {
              const el = document.getElementById("loyalty-program");
              if (el) {
                const top = el.getBoundingClientRect().top + window.scrollY - 72;
                window.scrollTo({ top, behavior: "smooth" });
              }
            }}
              className="shrink-0 px-3 py-1.5 rounded-lg text-[10px] font-mono font-bold text-yellow-400 hover:text-yellow-300 hover:bg-yellow-400/10 transition-colors uppercase tracking-widest">
              Rewards
            </button>
          )}
          <button onClick={() => scrollToSection("upcoming-events")}
            className="shrink-0 px-3 py-1.5 rounded-lg text-[10px] font-mono font-bold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors uppercase tracking-widest">
            Events
          </button>
        </div>
      </div>

      {/* Post Interactions Sheet */}
      <PostInteractionsSheet
        post={interactionsPost}
        currentUser={currentUser}
        isOwner={isOwner}
        open={!!interactionsPost}
        onClose={() => setInteractionsPost(null)}
      />

      {/* Edit Post Modal — organizer owner or admin only */}
      <EditOrganizerPostModal
        open={!!editingPost}
        post={editingPost}
        onClose={() => setEditingPost(null)}
        onUpdated={(updated) => {
          setPosts(prev => prev.map(p => p.id === updated.id ? updated : p));
          setGallery(prev => prev.map(p => p.id === updated.id ? updated : p));
        }}
      />

      {/* Followers Popup */}
      <FollowersPopup
        open={followersPopupOpen}
        onClose={() => setFollowersPopupOpen(false)}
        followers={followers}
        followerCount={followerCount}
        displayName={displayName}
      />

      {/* Contact Organizer Modal */}
      <ContactOrganizerModal
        open={contactModalOpen}
        onClose={() => setContactModalOpen(false)}
        organizerEmail={profile?.organizer_email || ""}
        organizerName={displayName}
      />

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
    {/* Hide wrapper close button for 360 videos — the player has its own */}
          {!(lightbox.type === "video" && lightbox.is_360) && (
            <button
              className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 transition-colors"
              onClick={() => setLightbox(null)}
            >
              <X className="w-5 h-5 text-white" />
            </button>
          )}
          {lightbox.type === "video" && lightbox.is_360 ? (
            <div className="w-full max-w-2xl" onClick={e => e.stopPropagation()}><Video360Player src={lightbox.url} mobileSrc={lightbox.mobile_playback_url} desktopSrc={lightbox.desktop_optimized_url} poster={lightbox.thumbnail_url} playbackId={lightbox.mux_playback_id} muxStatus={lightbox.mux_status} onClose={() => setLightbox(null)} /></div>
          ) : lightbox.type === "video" ? (
            <MediaVideoPlayer src={lightbox.url} mobileSrc={lightbox.mobile_playback_url} desktopSrc={lightbox.desktop_optimized_url} className="max-w-full max-h-[85vh] rounded-lg" autoPlay onClick={e => e.stopPropagation()} />
          ) : (
            <img src={lightbox.url} alt="Media" className="max-w-full max-h-[85vh] rounded-lg object-contain" onClick={e => e.stopPropagation()} />
          )}
        </div>
      )}
    </div>
  );
}