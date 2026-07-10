import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import PullToRefresh from "@/components/shared/PullToRefresh";
import HeroSection from "../components/home/HeroSection";
import UpcomingEventsSection from "../components/home/UpcomingEventsSection";
import LivePollsRaffles from "../components/home/LivePollsRaffles";
import HomeGiveaways from "../components/home/HomeGiveaways";
import GenreRibbon from "../components/home/GenreRibbon";
import RoleBasedCTA from "../components/home/RoleBasedCTA";
import OrganizerSection from "../components/home/OrganizerSection";
import MediaPosterStrip from "../components/home/MediaPosterStrip";
import FeaturedArtistVideos from "../components/home/FeaturedArtistVideos";
import DiscoverArtists from "../components/home/DiscoverArtists";
import MediaGallery from "../components/home/MediaGallery";
import AffiliateCTA from "../components/home/AffiliateCTA";
import useIsIOS from "@/hooks/useIsIOS";
import PageMeta from "@/components/seo/PageMeta";
import StructuredData from "@/components/seo/StructuredData";
import {
  useEventsData,
  useArtistsMediaData,
  useMediaGalleryData,
  useRafflesPollsData,
  useGiveawaysData,
  useOrganizersData,
} from "@/hooks/useHomePageData";

const homeSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "Reizor",
  "url": "https://reizor.com",
  "description": "Music events and tickets platform. Discover techno, house, hip-hop events and connect with organizers.",
  "potentialAction": {
    "@type": "SearchAction",
    "target": "https://reizor.com/search?q={search_term_string}",
    "query-input": "required name=search_term_string",
  },
};

export default function Home() {
  const navigate = useNavigate();
  const { user, isLoadingAuth } = useAuth();
  const isIOS = useIsIOS();
  const [refreshKey, setRefreshKey] = useState(0);

  const { events, loading: eventsLoading } = useEventsData(refreshKey);
  const { raffles, polls, loading: rafflesLoading } = useRafflesPollsData(refreshKey);
  const { giveaways, loading: giveawaysLoading } = useGiveawaysData(refreshKey);
  const { artists, albums, posts, loading: artistsLoading } = useArtistsMediaData();
  const { mediaItems, orgPosts, loading: mediaLoading } = useMediaGalleryData();
  const { organizerProfiles, listOrgRes, loading: organizersLoading } = useOrganizersData();

  // One-time role redirect — uses AuthContext user, no extra /User/me call
  const REDIRECT_KEY = 'home_role_redirect_done';
  useEffect(() => {
    if (isLoadingAuth) return;
    if (!user) return;
    if (sessionStorage.getItem(REDIRECT_KEY)) return;
    if (user.role === "organizer") {
      sessionStorage.setItem(REDIRECT_KEY, '1');
      navigate("/organizer", { replace: true });
    } else if (user.role === "artist") {
      sessionStorage.setItem(REDIRECT_KEY, '1');
      navigate("/artist", { replace: true });
    }
  }, [user, isLoadingAuth, navigate]);

  const handleRefresh = useCallback(async () => {
    // Clear the module-level cache then re-trigger hooks by forcing a key bump
    const { clearHomeCache } = await import("@/hooks/useHomePageData");
    clearHomeCache?.();
    // Re-fetch by incrementing a refresh key — causes hook effects to re-run
    setRefreshKey(k => k + 1);
  }, []);

  return (
    <PullToRefresh onRefresh={handleRefresh}>
    <div className="space-y-0">
      <PageMeta
        title="REIZOR — Music Events & Tickets"
        description="Discover, buy tickets and create music events on Reizor. Browse techno, house, hip-hop, and more events near you. Join as an organizer or artist."
        canonical="https://reizor.com"
      />
      <StructuredData data={homeSchema} />

      {/* ── Hero: renders immediately, no API dependency ── */}
      <HeroSection />

      {/* ── Upcoming Events: loads eagerly, near top of page ── */}
      <UpcomingEventsSection events={events} loading={eventsLoading} />

      {/* ── Giveaways: shown above Raffles & Polls ── */}
      <HomeGiveaways giveaways={giveaways} loading={giveawaysLoading} />

      {/* ── Live Polls & Raffles: loads eagerly, shown after Upcoming Events ── */}
      <LivePollsRaffles raffles={raffles} polls={polls} loading={rafflesLoading} />

      {/* ── Genre Ribbon: Find Your Event Frequency section ── */}
      <GenreRibbon events={events} loading={eventsLoading} />

      <MediaPosterStrip artists={artists} albums={albums} posts={posts} loading={artistsLoading} />
      <MediaGallery mediaItems={mediaItems} orgPosts={orgPosts} loading={mediaLoading} />
      <OrganizerSection
        events={events}
        organizerProfiles={organizerProfiles}
        listOrgRes={listOrgRes}
        loading={organizersLoading}
      />

      {/* ── Discover Artists: shows whenever ≥1 public artist exists ── */}
      <DiscoverArtists artists={artists} loading={artistsLoading} />

      {/* ── Featured Artist Videos: reuses already-loaded artists & posts ── */}
      <FeaturedArtistVideos posts={posts} artists={artists} loading={artistsLoading} />

      {/* ── Why Us / Role-based CTA ── */}
      <RoleBasedCTA />

      {/* ── Affiliate CTA: after Why Us, before Support/Footer (hidden on iOS per App Store Guideline 3.1.1) ── */}
      {!isIOS && <AffiliateCTA />}
    </div>
    </PullToRefresh>
  );
}