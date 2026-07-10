import { useState, useEffect, useMemo } from "react";
import { filterUpcomingEvents } from "@/utils/eventUtils";
import { useParams, useNavigate, Link } from "react-router-dom";
import ArtistMusicPlayer from "../components/artist/ArtistMusicPlayer";
import Video360Player from "../components/media/Video360Player";
import VideoThumbnail from "../components/media/VideoThumbnail";
import BookingForm from "../components/artist/BookingForm";
import MessageModal from "../components/artist/MessageModal";
import TiersSection from "../components/artist/TiersSection";
import FanVideoChats from "../components/artist/FanVideoChats";
import MerchShop from "../components/artist/MerchShop";
import DigitalDownloadsShop from "../components/artist/DigitalDownloadsShop";
import ShoutoutSection from "../components/artist/ShoutoutSection";
import ArtistGallerySection from "../components/artist/ArtistGallerySection";
import SpotifyWidget from "../components/artist/SpotifyWidget";
import ArtistFeaturedSection from "../components/artist/ArtistFeaturedSection";
import ArtistFeaturesCard from "../components/artist/ArtistFeaturesCard";
import ReferralCTA from "../components/referral/ReferralCTA";
import ArtistBookingLink from "../components/artist/ArtistBookingLink";
import ArtistPostCard from "../components/artist/ArtistPostCard";
import EditPostModal from "@/components/artist/EditPostModal";
import { ArrowLeft, Share2, Heart, MessageCircle, ExternalLink, Music, Video, FileAudio, Gift, Ticket, Calendar, DollarSign, ChevronDown, ChevronUp, CalendarCheck, MessageSquare, Mail, Edit2 } from "lucide-react";
import ReadMoreText from "@/components/events/ReadMoreText";
import { formatArtistMeta } from "@/utils/metadataFormat";
import MapDirectionLink from "../components/shared/MapDirectionLink";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";
import { toast } from "sonner";
import StripePaymentModal from "../components/shared/StripePaymentModal";
import { safeShare } from "@/lib/mobileShare";
import ShareLinkButton from "@/components/shared/ShareLinkButton";
import PageMeta from "@/components/seo/PageMeta";

export default function ArtistProfile({ overrideId, embedded = false }) {
  const params = useParams();
  const artistId = overrideId || params.id;
  const navigate = useNavigate();
  // Reliable iOS detection — covers iPhone, iPad (incl. iPadOS 13+ reporting as Mac),
  // and iOS WebView/PWA. Excludes Android and desktop browsers.
  const isIOS = useMemo(() => {
    if (typeof navigator === "undefined") return false;
    const ua = navigator.userAgent || "";
    const platform = navigator.platform || "";
    // iPadOS 13+ reports as Macintosh with touch support
    const isIPad = /iPad|iPhone|iPod/.test(ua) ||
      (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) ||
      platform === "iPad";
    return isIPad;
  }, []);
  const [artist, setArtist] = useState(null);
  const [posts, setPosts] = useState([]);
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [following, setFollowing] = useState(false);
  const [followRecord, setFollowRecord] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [audioTracks, setAudioTracks] = useState([]);
  const [donateOpen, setDonateOpen] = useState(false);
  const [donateAmount, setDonateAmount] = useState("");
  const [donateMessage, setDonateMessage] = useState("");
  const [donating, setDonating] = useState(false);
  // status: "idle" | "processing" | "success" | "failed" | "cancelled"
  const [donateStatus, setDonateStatus] = useState(() => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get("donation") === "success" ? "success" : "idle";
  });
  const [donateError, setDonateError] = useState("");
  const [donateClientSecret, setDonateClientSecret] = useState(null);
  const [donatePaymentAmount, setDonatePaymentAmount] = useState("");
  const [bookingOpen, setBookingOpen] = useState(false);
  const [messageOpen, setMessageOpen] = useState(false);
  const [expandedPost, setExpandedPost] = useState(null);
  const [comments, setComments] = useState({});
  const [newComment, setNewComment] = useState({});
  const [raffles, setRaffles] = useState({});
  const [pendingEdit, setPendingEdit] = useState(null);
  const [editingPost, setEditingPost] = useState(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    // Guard against undefined/invalid artistId from URL
    if (!artistId || artistId === "undefined" || artistId === "null") {
      setLoading(false);
      return;
    }
    // ── Phase 1 (critical path): artist + approved posts + current user ──
    // Render the profile as soon as these resolve — no artificial delays and
    // no per-post comment-count loop (the stored comment_count field is used).
    let cancelled = false;
    Promise.all([
      base44.entities.Artist.filter({ id: artistId }, null, 1).catch(() => []),
      base44.entities.ArtistPost.filter({ artist_id: artistId, approval_status: 'approved' }, "-created_date", 30).catch(() => []),
      base44.auth.me().catch(() => null),
    ]).then(([artists, p, u]) => {
      if (cancelled) return;
      const a = artists[0];
      const approvedPosts = p.filter(post => post.approval_status === 'approved').map(post => ({
        ...post,
        comment_count: post.comment_count ?? 0,
      }));
      setArtist(a);
      setPosts(approvedPosts);
      setUser(u);
      setLoading(false);

      // Collect audio tracks from posts
      const tracks = [];
      p.forEach((post) => {
        (post.media_urls || []).forEach((url, i) => {
          const type = post.media_types?.[i];
          if (type === "audio") {
            tracks.push({ url, title: post.caption || `Track from post · ${new Date(post.created_date).toLocaleDateString()}` });
          }
        });
      });
      setAudioTracks(tracks);

      if (!a) return; // artist missing — no background fetches needed

      // ── Phase 2 (background): follower count, events, raffles, pending edit ──
      // Each runs independently and updates state without blocking the profile.
      if (u && a.user_email && u.email === a.user_email) {
        base44.entities.ArtistProfileEdit.filter({ artist_id: a.id, status: "pending_review" }, null, 1)
          .then(pending => { if (!cancelled && pending?.[0]) setPendingEdit(pending[0]); })
          .catch(() => {});
      }

      base44.entities.ArtistFollow.filter({ artist_id: artistId }, null, 5000)
        .then(allFollows => {
          if (cancelled) return;
          const realCount = allFollows.length;
          setArtist(prev => prev ? { ...prev, follower_count: realCount } : prev);
          if (a.follower_count !== realCount) {
            base44.entities.Artist.update(artistId, { follower_count: realCount }).catch(() => {});
          }
          if (u) {
            const myFollow = allFollows.find(f => f.follower_email === u.email);
            if (myFollow) { setFollowing(true); setFollowRecord(myFollow); }
          }
        })
        .catch(() => {});

      if (a.display_name) {
        base44.entities.Event.filter({ status: "published" }, "date", 100)
          .then(evs => {
            if (cancelled) return;
            const filtered = filterUpcomingEvents(evs).filter(e =>
              (e.artists || []).some(n => n.toLowerCase() === a.display_name.toLowerCase())
            );
            setUpcomingEvents(filtered);
          })
          .catch(() => {});
      }

      const rafflePosts = p.filter(x => x.type === "raffle");
      if (rafflePosts.length > 0) {
        Promise.all(rafflePosts.map(rp =>
          base44.entities.ArtistRaffle.filter({ post_id: rp.id }, null, 1).catch(() => [])
        )).then(results => {
          if (cancelled) return;
          const map = {};
          results.forEach((res, i) => { if (res[0]) map[rafflePosts[i].id] = res[0]; });
          setRaffles(map);
        }).catch(() => {});
      }
    }).catch(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [artistId, retryKey]);

  const handleFollow = async () => {
    if (!user) { base44.auth.redirectToLogin(); return; }
    if (following) {
      await base44.entities.ArtistFollow.delete(followRecord.id);
      setFollowing(false);
      setFollowRecord(null);
      setArtist(a => {
        const newCount = Math.max(0, (a.follower_count || 1) - 1);
        base44.entities.Artist.update(artistId, { follower_count: newCount }).catch(() => {});
        return { ...a, follower_count: newCount };
      });
    } else {
      // Prevent duplicate follows
      const existing = await base44.entities.ArtistFollow.filter({ artist_id: artistId, follower_email: user.email }, null, 1);
      let rec = existing[0];
      if (!rec) {
        rec = await base44.entities.ArtistFollow.create({ artist_id: artistId, artist_name: artist.display_name, follower_email: user.email, follower_name: user.full_name });
      }
      setFollowing(true);
      setFollowRecord(rec);
      setArtist(a => {
        const newCount = (a.follower_count || 0) + 1;
        base44.entities.Artist.update(artistId, { follower_count: newCount }).catch(() => {});
        return { ...a, follower_count: newCount };
      });
    }
  };

  const handleDonate = async () => {
    if (!user) { base44.auth.redirectToLogin(); return; }
    const amount = parseFloat(donateAmount);
    if (!amount || amount < 1) { setDonateError("Minimum donation is $1"); return; }
    setDonating(true);
    setDonateError("");
    try {
      const response = await base44.functions.invoke("stripeDonationCheckout", {
        artistId: artistId,
        artistName: artist.display_name,
        artistEmail: artist.user_email,
        amount,
        message: donateMessage,
      });
      if (response?.data?.clientSecret) {
        setDonateClientSecret(response.data.clientSecret);
        setDonatePaymentAmount(amount.toFixed(2));
        setDonateStatus("processing");
      } else {
        setDonateError("Payment setup failed. Please try again.");
        setDonateStatus("failed");
      }
    } catch (err) {
      setDonateError(err.response?.data?.error || err.message || "Payment setup failed.");
      setDonateStatus("failed");
    }
    setDonating(false);
  };

  const handleDonateSuccess = () => {
    setDonateClientSecret(null);
    setDonateStatus("success");
  };

  const handleDonateModalClose = () => {
    // If modal was closed without completing payment, treat as cancelled
    setDonateClientSecret(null);
    if (donateStatus === "processing") {
      setDonateStatus("cancelled");
    }
  };

  const resetDonate = () => {
    setDonateOpen(false);
    setDonateStatus("idle");
    setDonateAmount("");
    setDonateMessage("");
    setDonateError("");
    setDonateClientSecret(null);
  };

  const handleShare = async (post) => {
    const url = `${window.location.origin}/artists/${artistId}`;
    await safeShare({ title: artist?.display_name || document.title, url });
  };

  const loadComments = async (postId) => {
    const c = await base44.entities.ArtistComment.filter({ post_id: postId }, "created_date", 50);
    setComments(prev => ({ ...prev, [postId]: c }));
  };

  const toggleComments = async (postId) => {
    if (expandedPost === postId) { setExpandedPost(null); return; }
    setExpandedPost(postId);
    if (!comments[postId]) await loadComments(postId);
  };

  const submitComment = async (postId) => {
    if (!user) { base44.auth.redirectToLogin(); return; }
    const body = newComment[postId]?.trim();
    if (!body) return;
    const c = await base44.entities.ArtistComment.create({ post_id: postId, artist_id: artistId, author_email: user.email, author_name: user.full_name, body });
    setComments(prev => {
      const updated = [...(prev[postId] || []), c];
      const newCount = updated.length;
      // Update post comment_count to match actual comment array length
      base44.entities.ArtistPost.update(postId, { comment_count: newCount }).catch(() => {});
      setPosts(p => p.map(x => x.id === postId ? { ...x, comment_count: newCount } : x));
      return { ...prev, [postId]: updated };
    });
    setNewComment(prev => ({ ...prev, [postId]: "" }));
    base44.functions.invoke("awardLoyaltyPoints", {
      action_type: "comment", owner_type: "artist", owner_id: artistId, owner_name: artist.display_name, source_id: postId,
    }).catch((err) => {
      if (err?.response?.data?.error === "follow_required") {
        toast.info(err.response.data.message || `Follow ${artist.display_name} to earn points.`);
      }
    });
  };

  const enterRaffle = async (raffle) => {
    if (!user) { base44.auth.redirectToLogin(); return; }
    if (raffle.entry_requirement === "follow" && !following) { toast.error("You must follow this artist to enter"); return; }
    const already = (raffle.entries || []).find(e => e.email === user.email);
    if (already) { toast.info("You're already entered!"); return; }
    const updated = { ...raffle, entries: [...(raffle.entries || []), { email: user.email, name: user.full_name }] };
    await base44.entities.ArtistRaffle.update(raffle.id, { entries: updated.entries });
    setRaffles(prev => ({ ...prev, [raffle.post_id]: updated }));
    toast.success("🎉 You're entered in the raffle!");
    base44.functions.invoke("awardLoyaltyPoints", {
      action_type: "raffle", owner_type: "artist", owner_id: artistId, owner_name: artist.display_name, source_id: raffle.id,
    }).catch((err) => {
      if (err?.response?.data?.error === "follow_required") {
        toast.info(err.response.data.message || `Follow ${artist.display_name} to earn points.`);
      }
    });
  };

  if (loading) return <div className={embedded ? "py-20 flex justify-center" : "min-h-screen flex items-center justify-center"}><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;
  if (!artist) return (
    <div className={embedded ? "py-20 text-center" : "min-h-screen flex items-center justify-center px-4"}>
      <div className="text-center space-y-4 max-w-md">
        <div className="text-5xl">🎤</div>
        <p className="font-display font-bold text-xl">Artist profile is no longer available</p>
        <p className="text-sm text-muted-foreground">This artist may have been removed or their profile is temporarily unavailable.</p>
        {!embedded && (
          <div className="flex gap-3 justify-center pt-2">
            <Button variant="outline" onClick={() => navigate(-1)} className="gap-2"><ArrowLeft className="w-4 h-4" /> Go Back</Button>
            <Button onClick={() => { setLoading(true); setRetryKey(k => k + 1); }} className="glow-lime font-bold">Try Again</Button>
          </div>
        )}
      </div>
    </div>
  );

  const isOwner = user?.email === artist.user_email;

  const hasBanner = !!(artist.banner_image || artist.cover_image);

  return (
    <>
    {artist && (
      <PageMeta
        title={`${artist.display_name} — REIZOR`}
        description={`${artist.display_name}${artist.genre ? ` — ${artist.genre.replace(/_/g, " ")} artist` : ""}. ${artist.bio ? ` ${artist.bio.slice(0, 120)}...` : `Follow ${artist.display_name} on Reizor.`}`}
        canonical={`https://reizor.com/artists/${artist.id}`}
        ogImage={artist.profile_image || artist.cover_image || ""}
      />
    )}
    <div className={embedded ? "" : "min-h-screen"}>
      {/* Banner / Cover — only render when image exists */}
      {hasBanner && (
        <div className="relative h-32 sm:h-48 md:h-56">
          <img src={artist.banner_image || artist.cover_image} alt="Cover" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-background/95 via-background/20 to-transparent" />
          {!embedded && (
            <button onClick={() => navigate(-1)} className="absolute top-4 left-4 p-2 rounded-full bg-background/60 backdrop-blur-sm z-10">
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      <div className="max-w-2xl mx-auto px-4 pb-20 space-y-5">
        {/* Profile Header */}
        <div className="space-y-4 pt-4">
          {/* Back button when no banner */}
          {!hasBanner && !embedded && (
            <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-1">
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm font-mono">Back</span>
            </button>
          )}
          {/* Avatar */}
          <div className="flex items-start gap-4">
            {artist.profile_image ? (
              <img
                src={artist.profile_image}
                alt={artist.display_name}
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-full object-cover border-4 border-background shrink-0"
              />
            ) : (
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-primary/20 border-4 border-background flex items-center justify-center shrink-0">
                <Music className="w-8 h-8 text-primary" />
              </div>
            )}
            {/* Name + meta inline with avatar */}
            <div className="flex-1 min-w-0 pt-1">
              <h1 className="font-display font-black text-3xl sm:text-4xl tracking-tight leading-tight break-words">{artist.display_name}</h1>
              <p className="text-xs font-mono text-primary uppercase tracking-widest mt-1">{formatArtistMeta(artist.genre)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {artist.follower_count || 0} {(artist.follower_count === 1) ? "follower" : "followers"}{artist.location ? ` · ${artist.location}` : ""}
              </p>
            </div>
          </div>

          {/* Action buttons — always on their own full-width row */}
          {!isOwner && (
            <>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={handleFollow}
                variant={following ? "outline" : "default"}
                className={`font-display font-bold text-sm ${following ? "" : "glow-lime"}`}
              >
                {following ? "Following" : "Follow"}
              </Button>
              <Button onClick={() => setBookingOpen(true)} variant="outline" size="sm" className="font-display font-bold gap-1.5">
                <CalendarCheck className="w-3.5 h-3.5" /> Book
              </Button>
              <Button
                onClick={() => { if (!user) { base44.auth.redirectToLogin(); return; } setMessageOpen(true); }}
                variant="outline" size="sm" className="font-display font-bold gap-1.5"
              >
                <MessageSquare className="w-3.5 h-3.5" /> Message
              </Button>
              {artist.contact_email && (
                <a href={`mailto:${artist.contact_email}`}>
                  <Button variant="outline" size="sm" className="font-display font-bold gap-1.5 border-green-400/40 text-green-400 hover:bg-green-400/10">
                    <Mail className="w-3.5 h-3.5" /> Contact
                  </Button>
                </a>
              )}
              {!isIOS && (
                <Button
                  onClick={() => { setDonateOpen(true); setDonateError(""); }}
                  variant="outline" size="sm" className="font-display font-bold gap-1.5 border-primary/40 text-primary hover:bg-primary/10"
                >
                  <DollarSign className="w-3.5 h-3.5" /> Support
                </Button>
              )}
              {/* Tour Schedule — compact, aligned with other actions */}
              <Button asChild variant="outline" size="sm" className="font-display font-bold gap-1.5 border-primary/40 text-primary hover:bg-primary/10">
                <Link to={`/artists/${artistId}/tour`}><Calendar className="w-3.5 h-3.5" /> Tour Schedule</Link>
              </Button>
            </div>
            {/* Share profile — enlarged with clear copy-link feedback */}
            <ShareLinkButton
              url={`${window.location.origin}/artists/${artistId}`}
              title={artist?.display_name || document.title}
              text={`Check out ${artist?.display_name} on Reizor`}
              label="Share Profile"
              className="w-full"
            />
            </>
          )}
          {isOwner && (
            <>
            {pendingEdit && (
              <div className="flex items-start justify-between gap-3 p-3 rounded-lg bg-yellow-400/10 border border-yellow-400/30">
                <div className="min-w-0">
                  <p className="text-yellow-400 text-xs font-mono font-bold">⏳ Profile changes pending approval</p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5">Your public profile is still showing the approved version. We'll notify you once an admin reviews your changes.</p>
                </div>
                <Button asChild size="sm" variant="outline" className="font-display font-bold shrink-0 border-yellow-400/40 text-yellow-400 hover:bg-yellow-400/10">
                  <Link to={`/artist/signup?mode=edit`}>View Request</Link>
                </Button>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm" className="font-display font-bold gap-1.5 glow-lime">
                <Link to={`/artist/signup?mode=edit`}><Edit2 className="w-3.5 h-3.5" /> Edit Profile</Link>
              </Button>
              <Button asChild size="sm" variant="outline" className="font-display font-bold w-fit border-accent/50 text-accent hover:bg-accent/10">
                <Link to="/artist">Dashboard</Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="font-display font-bold gap-1.5 border-primary/40 text-primary hover:bg-primary/10">
                <Link to={`/artists/${artistId}/tour`}><Calendar className="w-3.5 h-3.5" /> Tour Schedule</Link>
              </Button>
            </div>
            <ShareLinkButton
              url={`${window.location.origin}/artists/${artistId}`}
              title={artist?.display_name || document.title}
              text={`Check out ${artist?.display_name} on Reizor`}
              label="Share Profile"
              className="w-full"
            />
            </>
          )}
        </div>

        {/* Artist features overview — only shown to the profile owner */}
        {isOwner && <ArtistFeaturesCard />}

        {/* Bio — collapsed to 3 lines with Read More / Read Less toggle */}
        {artist.bio && <ReadMoreText text={artist.bio} lineClassName="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap" />}

        {/* Social Links — only shown when URL is set and non-empty */}
        {(() => {
          const socialLinks = [
            { key: "instagram", label: "Instagram" },
            { key: "twitter", label: "X" },
            { key: "tiktok", label: "TikTok" },
            { key: "soundcloud", label: "SoundCloud" },
            { key: "spotify", label: "Spotify" },
            { key: "website", label: "Website" },
          ].filter(({ key }) => artist[key]?.trim());
          if (!socialLinks.length) return null;
          return (
            <div className="flex flex-wrap gap-2">
              {socialLinks.map(({ key, label }) => (
                <a key={key} href={artist[key].trim()} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-accent text-accent-foreground text-xs font-mono font-bold hover:bg-accent/80 transition-colors">
                  {label} <ExternalLink className="w-3 h-3" />
                </a>
              ))}
            </div>
          );
        })()}

        {/* Shareable Booking Link — owner sees inline URL to copy, fans see Book button */}
        {artist.approval_status === "approved" && isOwner && (
          <div className="space-y-1.5">
            <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Your Booking Link</p>
            <ArtistBookingLink artist={artist} variant="inline" />
          </div>
        )}

        {/* Donate button — hidden on iOS */}
        {!isOwner && !isIOS && (
          <div>
            {/* Success state */}
            {donateStatus === "success" && (
              <div className="p-5 rounded-xl bg-green-400/10 border border-green-400/30 text-center space-y-3">
                <p className="text-3xl">💸</p>
                <p className="font-display font-bold text-green-400 text-lg">Donation sent successfully!</p>
                <p className="text-sm text-muted-foreground">Thank you for supporting {artist.display_name}. Your contribution means the world.</p>
                <Button variant="outline" size="sm" onClick={resetDonate}>Close</Button>
              </div>
            )}

            {/* Failed state */}
            {donateStatus === "failed" && (
              <div className="p-5 rounded-xl bg-destructive/10 border border-destructive/30 text-center space-y-3">
                <p className="text-3xl">❌</p>
                <p className="font-display font-bold text-destructive text-lg">Donation failed</p>
                <p className="text-sm text-muted-foreground">{donateError || "Please try again or use another payment method."}</p>
                <div className="flex gap-2 justify-center">
                  <Button size="sm" onClick={() => { setDonateStatus("idle"); setDonateOpen(true); setDonateError(""); }}>Try Again</Button>
                  <Button variant="outline" size="sm" onClick={resetDonate}>Cancel</Button>
                </div>
              </div>
            )}

            {/* Cancelled state */}
            {donateStatus === "cancelled" && (
              <div className="p-5 rounded-xl bg-muted/40 border border-border/50 text-center space-y-3">
                <p className="text-3xl">🚫</p>
                <p className="font-display font-bold text-muted-foreground text-lg">Donation cancelled</p>
                <p className="text-sm text-muted-foreground">Your payment was not completed. No charge was made.</p>
                <div className="flex gap-2 justify-center">
                  <Button size="sm" onClick={() => { setDonateStatus("idle"); setDonateOpen(true); }}>Try Again</Button>
                  <Button variant="outline" size="sm" onClick={resetDonate}>Dismiss</Button>
                </div>
              </div>
            )}

            {/* Idle: donate form */}
            {donateStatus === "idle" && donateOpen && (
              <div className="p-4 rounded-xl bg-card border border-primary/30 space-y-3">
                <p className="font-display font-bold">Donate to {artist.display_name}</p>
                <p className="text-xs text-muted-foreground font-mono">10% platform fee applies. Minimum $1.</p>
                <div className="flex gap-2 flex-wrap">
                  {[5, 10, 20, 50].map(a => (
                    <button key={a} onClick={() => setDonateAmount(String(a))}
                      className={`px-3 py-1.5 rounded-lg border text-sm font-mono font-bold transition-all ${donateAmount === String(a) ? "bg-primary text-primary-foreground border-primary" : "bg-secondary border-border/50 text-muted-foreground hover:border-primary/40"}`}>
                      ${a}
                    </button>
                  ))}
                </div>
                <Input value={donateAmount} onChange={(e) => { setDonateAmount(e.target.value); setDonateError(""); }}
                  type="number" min="1" placeholder="Custom amount ($)" className="bg-secondary border-border/50" />
                <Input value={donateMessage} onChange={(e) => setDonateMessage(e.target.value)}
                  placeholder="Leave a message (optional)" className="bg-secondary border-border/50" />
                {donateAmount && parseFloat(donateAmount) >= 1 && (
                  <p className="text-xs font-mono text-muted-foreground">
                    Artist receives: <span className="text-green-400 font-bold">${(parseFloat(donateAmount) * 0.9).toFixed(2)}</span>
                    <span className="ml-2">· Reizor fee: ${(parseFloat(donateAmount) * 0.1).toFixed(2)}</span>
                  </p>
                )}
                {donateError && (
                  <p className="text-sm text-destructive font-mono">{donateError}</p>
                )}
                <div className="flex gap-2">
                  <Button onClick={handleDonate} disabled={donating} className="flex-1 glow-lime font-display font-bold">
                    {donating ? "Processing..." : `Donate $${donateAmount || "0"}`}
                  </Button>
                  <Button variant="outline" onClick={resetDonate}>Cancel</Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Deferred sections — only render after all fetches complete to avoid rate limiting */}
        {!loading && (
          <>
            {/* Referral CTA — hidden on iOS (App Store compliance) */}
            {!isOwner && !isIOS && <ReferralCTA userId={user?.id} userName={user?.full_name} />}

            {/* Fan Tiers */}
            {!isOwner && <TiersSection artist={artist} user={user} />}

            {/* Video Sessions */}
            {!isOwner && <FanVideoChats artist={artist} user={user} />}

            {/* Merch Shop */}
            {!isOwner && <MerchShop artist={artist} user={user} />}

            {/* Digital Downloads */}
            {!isOwner && <DigitalDownloadsShop artist={artist} user={user} />}

            {/* Shoutouts */}
            {!isOwner && <ShoutoutSection artist={artist} user={user} />}



            {/* Featured Tracks & Albums */}
            <ArtistFeaturedSection artistId={artist.id} />

            {/* Gallery */}
            <ArtistGallerySection artist={artist} />
          </>
        )}

        {/* Upcoming Events */}
        {upcomingEvents.length > 0 && (
          <div className="space-y-3">
            <h2 className="font-display font-bold text-lg">UPCOMING EVENTS</h2>
            {upcomingEvents.map(ev => (
              <Link key={ev.id} to={`/events/${ev.id}`}
                className="flex items-center gap-4 p-4 rounded-xl bg-card border border-border/50 hover:border-primary/30 transition-all group">
                {ev.cover_image && (
                  <img src={ev.cover_image} alt={ev.title} className="w-14 h-14 rounded-lg object-cover shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-display font-bold text-sm group-hover:text-primary transition-colors truncate">{ev.title}</p>
                  <p className="text-xs font-mono text-muted-foreground mt-0.5">
                    {format(new Date(ev.date), "MMM dd, yyyy")} · {ev.venue_name}{ev.city ? `, ${ev.city}` : ""}
                  </p>
                  <MapDirectionLink
                    venueName={ev.venue_name}
                    city={ev.city}
                    country={ev.country}
                    latitude={ev.latitude}
                    longitude={ev.longitude}
                    compact
                    className="text-[11px] font-mono mt-0.5"
                  />
                </div>
                {ev.min_price != null && (
                  <span className="font-mono text-sm text-primary font-bold shrink-0">${ev.min_price}</span>
                )}
              </Link>
            ))}
          </div>
        )}

        {/* Posts Feed */}
        <div className="space-y-1">
          <div className="flex items-center justify-between pb-2">
            <h2 className="font-display font-black text-lg tracking-tight">POSTS</h2>
            {posts.length > 0 && (
              <span className="font-mono text-xs text-muted-foreground">{posts.length} post{posts.length !== 1 ? "s" : ""}</span>
            )}
          </div>

          {posts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 rounded-2xl bg-card border border-border/30 text-center gap-3">
              <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
                <Music className="w-6 h-6 text-muted-foreground" />
              </div>
              <div>
                <p className="font-display font-bold text-sm">No posts yet</p>
                <p className="text-xs text-muted-foreground mt-1">Check back soon for updates from {artist.display_name}</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {posts.map((post) => (
                <ArtistPostCard
                  key={post.id}
                  post={post}
                  artist={artist}
                  user={user}
                  raffle={raffles[post.id]}
                  canEdit={user?.role === "admin" || post.created_by_id === user?.id || post.created_by === user?.email}
                  onEdit={(p) => setEditingPost(p)}
                  expandedPost={expandedPost}
                  onToggleComments={(postId) => {
                    if (!user) { base44.auth.redirectToLogin(); return; }
                    toggleComments(postId);
                  }}
                  comments={comments}
                  newComment={newComment}
                  onNewCommentChange={(postId, val) => setNewComment(prev => ({ ...prev, [postId]: val }))}
                  onSubmitComment={submitComment}
                  onShare={handleShare}
                  onEnterRaffle={enterRaffle}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>

    {/* Persistent music player */}
    <ArtistMusicPlayer tracks={audioTracks} />
    {bookingOpen && <BookingForm artist={artist} user={user} onClose={() => setBookingOpen(false)} />}
    {messageOpen && <MessageModal artist={artist} user={user} onClose={() => setMessageOpen(false)} />}
    {donateClientSecret && (
      <StripePaymentModal
        clientSecret={donateClientSecret}
        amount={donatePaymentAmount}
        label={`Donate to ${artist.display_name}`}
        onSuccess={handleDonateSuccess}
        onPaymentFailed={(msg) => {
          setDonateClientSecret(null);
          setDonateError(msg || "Donation failed. Please try again or use another payment method.");
          setDonateStatus("failed");
        }}
        onClose={handleDonateModalClose}
      />
    )}
    <EditPostModal
      open={!!editingPost}
      post={editingPost}
      isAdmin={user?.role === "admin"}
      onClose={() => setEditingPost(null)}
      onUpdated={(updated) => {
        setPosts(prev => {
          const exists = prev.some(p => p.id === updated.id);
          if (!exists) return updated.approval_status === "approved" ? [updated, ...prev] : prev;
          return prev.map(p => p.id === updated.id ? updated : p).filter(p => p.approval_status === "approved");
        });
      }}
    />
    </>
  );
}