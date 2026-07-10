import { useEffect, useState } from 'react';
import { Toaster } from "@/components/ui/toaster"
import { Toaster as SonnerToaster } from "@/components/ui/sonner"
import { I18nProvider } from '@/lib/i18n';
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import MainLayout from './components/layout/MainLayout';
import Home from './pages/Home';
import Search from './pages/Search';
import EventDetail from './pages/EventDetail';
import MyTickets from './pages/MyTickets';
import MyResaleEarnings from './pages/MyResaleEarnings';
import Profile from './pages/Profile';
import MyFanProfile from './pages/MyFanProfile';
import FanPublicProfile from './pages/FanPublicProfile';
import FanFeed from './pages/FanFeed';
import Messages from './pages/Messages';
import OrganizerLayout from './components/organizer/OrganizerLayout';
import OrganizerDashboard from './pages/organizer/OrganizerDashboard';
import CreateEvent from './pages/organizer/CreateEvent';
import OrganizerEvents from './pages/organizer/OrganizerEvents';
import OrganizerAnalytics from './pages/organizer/OrganizerAnalytics';
import OrganizerPromos from './pages/organizer/OrganizerPromos';
import EventManage from './pages/organizer/EventManage';
import EditEvent from './pages/organizer/EditEvent';
import OrganizerScanner from './pages/organizer/OrganizerScanner';
import TableScanner from './pages/organizer/TableScanner';
import UnifiedScanner from './pages/organizer/UnifiedScanner';
import OrganizerLiveAnalytics from './pages/organizer/OrganizerLiveAnalytics';
import OrganizerTeam from './pages/organizer/OrganizerTeam';
import EventPerformance from './pages/organizer/EventPerformance';
import OrganizerPayouts from './pages/organizer/OrganizerPayouts.jsx';
import TicketSellers from './pages/organizer/TicketSellers';
import OrganizerPrizeScanner from './pages/organizer/OrganizerPrizeScanner';
import OrganizerPrizeScannerPage from './pages/organizer/OrganizerPrizeScannerPage';
import OrganizerPLReport from './pages/organizer/OrganizerPLReport';
import OrganizerGeneralExpenses from './pages/organizer/OrganizerGeneralExpenses';
import OrganizerEmailMarketing from './pages/organizer/OrganizerEmailMarketing';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminUsers from './pages/admin/AdminUsers';
import AdminEvents from './pages/admin/AdminEvents';
import AdminOrders from './pages/admin/AdminOrders';
import AdminTeam from './pages/admin/AdminTeam';
import AdminOrganizerFees from './pages/admin/AdminOrganizerFees';
import AdminWhiteLabels from './pages/admin/AdminWhiteLabels';
import AdminReferrals from './pages/admin/AdminReferrals';
import WhiteLabelDashboard from './pages/WhiteLabelDashboard';
import AdminMedia from './pages/admin/AdminMedia';
import AdminMediaModeration from './pages/admin/AdminMediaModeration';
import VendorScanner from './pages/VendorScanner';
import Artists from './pages/Artists';
import ArtistProfile from './pages/ArtistProfile';
import ArtistTourDetail from './pages/ArtistTourDetail';
import ArtistTour from './pages/ArtistTour';
import ArtistMedia from './pages/ArtistMedia';
import ArtistSignup from './pages/ArtistSignup';
import OrganizerSignup from './pages/OrganizerSignup';
import ArtistLayout from './components/artist/ArtistLayout';
import ArtistDashboard from './pages/artist/ArtistDashboard';
import ArtistPosts from './pages/artist/ArtistPosts';
import ArtistDonations from './pages/artist/ArtistDonations';
import ArtistRaffles from './pages/artist/ArtistRaffles';
import ArtistGiveaways from './pages/artist/ArtistGiveaways';
import ArtistAnalytics from './pages/artist/ArtistAnalytics';
import ArtistPayouts from './pages/artist/ArtistPayouts';
import ArtistBookings from './pages/artist/ArtistBookings';
import ArtistInbox from './pages/artist/ArtistInbox';
import ArtistTiers from './pages/artist/ArtistTiers';
import ArtistVideoChats from './pages/artist/ArtistVideoChats';
import ArtistMerch from './pages/artist/ArtistMerch';
import ArtistGallery from './pages/artist/ArtistGallery';
import ArtistDownloads from './pages/artist/ArtistDownloads';
import ArtistShoutouts from './pages/artist/ArtistShoutouts';
import ArtistTourSchedule from './pages/artist/ArtistTourSchedule';
import ArtistBookingAgency from './pages/artist/ArtistBookingAgency';
import ArtistTechnicalRider from './pages/artist/ArtistTechnicalRider';
import ArtistPrizeScanner from './pages/artist/ArtistPrizeScanner';
import MyProfileRedirect from './pages/artist/MyProfileRedirect';
import ArtistMyProfile from './pages/artist/ArtistMyProfile';
import TechnicalRiderPublic from './pages/TechnicalRiderPublic';
import OrganizerBookings from './pages/organizer/OrganizerBookings';
import OrganizerRaffles from './pages/organizer/OrganizerRaffles';
import OrganizerGiveaways from './pages/organizer/OrganizerGiveaways';
import OrganizerPolls from './pages/organizer/OrganizerPolls';
import OrganizerEmbedWidgets from './pages/organizer/OrganizerEmbedWidgets';
import ArtistEmbedWidgets from './pages/artist/ArtistEmbedWidgets';
import WhiteLabelEmbedWidgets from './pages/WhiteLabelEmbedWidgets';
import TicketSellerEmbedWidgets from './pages/TicketSellerEmbedWidgets';
import EmbedOrganizerEvents from './pages/embed/EmbedOrganizerEvents';
import EmbedWhiteLabelProfile from './pages/embed/EmbedWhiteLabelProfile';
import EmbedOrganizerProfile from './pages/embed/EmbedOrganizerProfile';
import EmbedOrganizerRafflesPolls from './pages/embed/EmbedOrganizerRafflesPolls';
import EmbedArtistProfile from './pages/embed/EmbedArtistProfile';
import EmbedArtistTour from './pages/embed/EmbedArtistTour';
import EmbedArtistMedia from './pages/embed/EmbedArtistMedia';
import EmbedSellerProfile from './pages/embed/EmbedSellerProfile';
import PollDetail from './pages/PollDetail';
import OrganizerMediaLibrary from './pages/organizer/OrganizerMediaLibrary';
import OrganizerGallery from './pages/organizer/OrganizerGallery';
import OrganizerStoragePage from './pages/organizer/OrganizerStoragePage';
import OrganizerQuickLinks from './pages/organizer/OrganizerQuickLinks';
import OrganizerProfilePage from './pages/organizer/OrganizerProfilePage';
import BookingCalendar from './pages/BookingCalendar';
import BookingContractPage from './pages/BookingContractPage';
import BookArtist from './pages/BookArtist';
import ProReferralProgram from './pages/ProReferralProgram';
import OrganizerLoyaltyProgram from './pages/organizer/OrganizerLoyaltyProgram';
import OrganizerUserBlast from './pages/organizer/OrganizerUserBlast';
import ArtistReferralPerformance from './pages/artist/ArtistReferralPerformance';
import ArtistPL from './pages/artist/ArtistPL';
import ResaleMarket from './pages/ResaleMarket';
import OrganizerPublicProfile from './pages/OrganizerPublicProfile';
import SavedEvents from './pages/SavedEvents';
import TermsAndConditions from './pages/TermsAndConditions';
import Discovery from './pages/Discovery';
import AllEvents from './pages/AllEvents';
import Policy from './pages/Policy';
import Contact from './pages/Contact';
import AccountDeletion from './pages/AccountDeletion';
import EventCalendar from './pages/EventCalendar';
import ResaleMarketplace from './pages/ResaleMarketplace';
import RecommendedEvents from './pages/RecommendedEvents';
import Checkout from './pages/Checkout';
import OrderConfirmation from './pages/OrderConfirmation';
import AllOrganizers from './pages/AllOrganizers';
import EventGallery from './pages/EventGallery';
import FAQ from './pages/FAQ';
import AdminEventDiscovery from './pages/admin/AdminEventDiscovery';
import AdminAffiliateEvents from './pages/admin/AdminAffiliateEvents';
import AdminGiveaways from './pages/admin/AdminGiveaways';
import AdminAnalytics from './pages/admin/AdminAnalytics';
import AdminSubWLProposals from './pages/admin/AdminSubWLProposals';
import AdminOrganizers from './pages/admin/AdminOrganizers';
import AdminArtists from './pages/admin/AdminArtists';
import AdminArtistPosts from './pages/admin/AdminArtistPosts';
import AdminPL from './pages/admin/AdminPL';
import AdminExpenses from './pages/admin/AdminExpenses';
import AdminPayouts from './pages/admin/AdminPayouts.jsx';
import AdminResell from './pages/admin/AdminResell.jsx';
import AdminRafflesPolls from './pages/admin/AdminRafflesPolls.jsx';
import AdminCrashLogs from './pages/admin/AdminCrashLogs.jsx';
import AdminDataCleanup from './pages/admin/AdminDataCleanup.jsx';
import AdminVideoBudgets from './pages/admin/AdminVideoBudgets';
import AdminStorageUsage from './pages/admin/AdminStorageUsage';
import AdminEmbedWidgets from './pages/admin/AdminEmbedWidgets';
import AdminLoyaltyPointRules from './pages/admin/AdminLoyaltyPointRules';
import ArtistLoyaltyProgram from './pages/artist/ArtistLoyaltyProgram';
import AffiliateEvents from './pages/AffiliateEvents';
import AffiliateProgram from './pages/AffiliateProgram';
import Giveaways from './pages/Giveaways';
import GiveawayDetail from './pages/GiveawayDetail';
import MyPrizes from './pages/MyPrizes';
import AffiliateEarningsReport from './pages/AffiliateEarningsReport';
import AffiliateReferralAnalytics from './pages/AffiliateReferralAnalytics';
import PrivacyPolicy from './pages/PrivacyPolicy';
import Pricing from './pages/Pricing';
import CommunityFeed from './pages/CommunityFeed';
import UserBlast from './pages/UserBlast';
import RedeemTransfer from './pages/RedeemTransfer';
import RaffleWinPage from './pages/RaffleWinPage';
import RaffleDetail from './pages/RaffleDetail';
import VendorDashboard from './pages/VendorDashboard';
import { useNotificationEngine } from './hooks/useNotificationEngine';
import { useContentProtection } from './hooks/useContentProtection';
import { base44 } from '@/api/base44Client';
import ErrorBoundary from '@/components/ErrorBoundary';
import ScrollToTop from '@/components/shared/ScrollToTop';
import { installGlobalErrorHandlers } from '@/lib/crashLogger';
import InviteRedirect from './pages/InviteRedirect';
import TwoFactorModal from './components/auth/TwoFactorModal';
import FanOnboardingModal from './components/onboarding/FanOnboardingModal';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin, user, isAuthReady, postAuthNavDone } = useAuth(); // must be rendered inside AuthProvider
  useNotificationEngine();
  useContentProtection();
  const [twoFAUser, setTwoFAUser] = useState(null);
  const [twoFAChecked, setTwoFAChecked] = useState(false);
  const [showFanOnboarding, setShowFanOnboarding] = useState(false);

  // Show the one-time fan onboarding guide after signup (fans only, once ever)
  useEffect(() => {
    if (!user) return;
    if (user.role === "user" && !user.has_seen_fan_onboarding_guide) {
      setShowFanOnboarding(true);
    }
  }, [user?.email]);

  // Hide the initial HTML splash overlay once the app is fully ready
  // (auth resolved, public settings loaded, and any post-auth navigation settled)
  useEffect(() => {
    if (isLoadingAuth || isLoadingPublicSettings || !isAuthReady || !postAuthNavDone) return;
    const t = setTimeout(() => {
      if (typeof window !== "undefined" && window.__hideAppSplash) window.__hideAppSplash();
    }, 60);
    return () => clearTimeout(t);
  }, [isLoadingAuth, isLoadingPublicSettings, isAuthReady, postAuthNavDone]);

  // 2FA gate: use AuthContext user — no extra /User/me call needed
  useEffect(() => {
    if (isLoadingAuth) return; // wait for auth to resolve
    if (!user) { setTwoFAChecked(true); return; } // guest — no 2FA needed
    // Check if already verified in this session
    const verified = sessionStorage.getItem("2fa_verified");
    const verifiedEmail = sessionStorage.getItem("2fa_email");
    if (verified === "1" && verifiedEmail === user.email) {
      setTwoFAChecked(true);
      return;
    }
    if (!user.two_factor_enabled) { setTwoFAChecked(true); return; }
    setTwoFAUser(user);
    setTwoFAChecked(true);
  }, [user, isLoadingAuth]);

  // Capture referral code from URL and persist for membership/pro signup bonus
  // Runs only when user becomes available from AuthContext (no extra /User/me calls)
  useEffect(() => {
    if (!user) return; // wait until auth resolves — guest visitors skip all of this

    const runAttribution = async () => {
      // Handle invite link attribution (from /invite/:code redirect)
      const invCode = localStorage.getItem("invite_code");
      if (invCode) {
        if (!user.referred_by_email) {
          const links = await base44.entities.InviteLink.filter({ code: invCode }, null, 1).catch(() => []);
          const link = links[0];
          if (link) {
            await base44.auth.updateMe({
              referred_by_email: link.created_by_email,
              referred_by_name: link.created_by_name || link.created_by_email,
              referred_by_role: link.created_by_role || "admin",
            }).catch(() => {});
          }
        }
        localStorage.removeItem("invite_code");
      }

      const params = new URLSearchParams(window.location.search);
      const ref = params.get('ref');
      if (ref) {
        localStorage.setItem('fan_ref_code', ref);
        // Referred-by attribution — only set once
        if (!user.referred_by_email) {
          const allUsers = await base44.entities.User.list(null, 500).catch(() => []);
          if (allUsers.length) {
            const refId2 = ref.replace(/^[a-z]+_/, '');
            const referrer = allUsers.find(r => r.id?.slice(-8) === refId2 && r.email !== user.email);
            if (referrer) {
              await base44.auth.updateMe({
                referred_by_email: referrer.email,
                referred_by_name: referrer.full_name || referrer.email,
                referred_by_role: referrer.role || 'user',
              });
            } else if (ref.startsWith('admin_')) {
              await base44.auth.updateMe({ referred_by_email: 'admin', referred_by_name: 'Admin', referred_by_role: 'admin' });
            }
          }
        }
      } else if (!user.referred_by_email) {
        // No ref param — attribute to admin (direct signup)
        await base44.auth.updateMe({ referred_by_email: 'admin', referred_by_name: 'Admin', referred_by_role: 'admin' });
      }
    };

    runAttribution().catch(() => {});
  }, [user?.email]); // run once per user session (email as stable dep)

  // Show 2FA modal if needed (after auth is resolved)
  if (twoFAChecked && twoFAUser) {
    return <TwoFactorModal user={twoFAUser} onVerified={() => setTwoFAUser(null)} />;
  }

  // Handle authentication errors — only block for hard errors (not loading)
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    }
    // auth_required is a normal guest/unauthenticated state — render the app publicly.
  }

  // CRITICAL PERF FIX: Do NOT block render on auth/settings loading for public pages.
  // The Hero and public homepage render immediately. Auth state hydrates in the background.
  // Only block if a 2FA user needs to be verified (already handled above).
  // Protected routes (organizer, admin) handle their own auth checks internally.

  // Render the main app
  return (
    <>
    <Routes>
      {/* Public pages with main layout */}
      <Route element={<MainLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/search" element={<Search />} />
        <Route path="/events/:id" element={<EventDetail />} />
        <Route path="/checkout/:eventId" element={<Checkout />} />
        <Route path="/order-confirmation/:orderId" element={<OrderConfirmation />} />
        <Route path="/my-tickets" element={<MyTickets />} />
        <Route path="/my-resale-earnings" element={<MyResaleEarnings />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/fan-profile" element={<MyFanProfile />} />
        <Route path="/fans/:id" element={<FanPublicProfile />} />
        <Route path="/feed" element={<FanFeed />} />
        <Route path="/messages" element={<Messages />} />
      </Route>

      {/* Organizer dashboard */}
      <Route element={<OrganizerLayout />}>
        <Route path="/organizer" element={<OrganizerDashboard />} />
        <Route path="/organizer/create" element={<CreateEvent />} />
        <Route path="/organizer/events" element={<OrganizerEvents />} />
        <Route path="/organizer/events/:id" element={<EventManage />} />
        <Route path="/organizer/events/:id/edit" element={<EditEvent />} />
        <Route path="/organizer/scanner" element={<OrganizerScanner />} />
        <Route path="/organizer/table-scanner" element={<TableScanner />} />
        <Route path="/organizer/scan" element={<UnifiedScanner />} />
        <Route path="/organizer/live" element={<OrganizerLiveAnalytics />} />
        <Route path="/organizer/team" element={<OrganizerTeam />} />
        <Route path="/organizer/analytics" element={<OrganizerAnalytics />} />
        <Route path="/organizer/promos" element={<OrganizerPromos />} />
        <Route path="/organizer/performance" element={<EventPerformance />} />
        <Route path="/organizer/payouts" element={<OrganizerPayouts />} />
        <Route path="/organizer/pl" element={<OrganizerPLReport />} />
        <Route path="/organizer/general-expenses" element={<OrganizerGeneralExpenses />} />
        <Route path="/organizer/email" element={<OrganizerEmailMarketing />} />
        <Route path="/organizer/bookings" element={<OrganizerBookings />} />
        <Route path="/organizer/raffles" element={<OrganizerRaffles />} />
        <Route path="/organizer/giveaways" element={<OrganizerGiveaways />} />
        <Route path="/organizer/polls" element={<OrganizerPolls />} />
        <Route path="/organizer/embed" element={<OrganizerEmbedWidgets />} />
        <Route path="/organizer/media" element={<OrganizerMediaLibrary />} />
        <Route path="/organizer/gallery" element={<OrganizerGallery />} />
        <Route path="/organizer/profile" element={<OrganizerProfilePage />} />
        <Route path="/organizer/quick-links" element={<OrganizerQuickLinks />} />
        <Route path="/organizer/storage" element={<OrganizerStoragePage />} />
        <Route path="/organizer/referral" element={<ProReferralProgram />} />
        <Route path="/organizer/loyalty" element={<OrganizerLoyaltyProgram />} />
        <Route path="/organizer/blast" element={<OrganizerUserBlast />} />
        <Route path="/organizer/booking-calendar" element={<BookingCalendar />} />
        <Route path="/organizer/sellers" element={<TicketSellers />} />
        <Route path="/organizer/prize-scanner" element={<OrganizerPrizeScannerPage />} />
        <Route path="/booking/contract/:bookingId" element={<BookingContractPage />} />
      </Route>

      {/* Admin panel */}
      <Route path="/admin" element={<AdminDashboard />}>
        <Route path="team" element={<AdminTeam />} />
        <Route path="media" element={<AdminMedia />} />
        <Route path="moderation" element={<AdminMediaModeration />} />
        <Route path="discovery" element={<AdminEventDiscovery />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="events" element={<AdminEvents />} />
        <Route path="orders" element={<AdminOrders />} />
        <Route path="fees" element={<AdminOrganizerFees />} />
        <Route path="white-labels" element={<AdminWhiteLabels />} />
        <Route path="referral" element={<AdminReferrals />} />
        <Route path="affiliate" element={<AdminAffiliateEvents />} />
        <Route path="giveaways" element={<AdminGiveaways />} />
        <Route path="analytics" element={<AdminAnalytics />} />
        <Route path="sub-wl" element={<AdminSubWLProposals />} />
        <Route path="organizers" element={<AdminOrganizers />} />
        <Route path="artists" element={<AdminArtists />} />
        <Route path="artist-posts" element={<AdminArtistPosts />} />
        <Route path="pl" element={<AdminPL />} />
        <Route path="expenses" element={<AdminExpenses />} />
        <Route path="payouts" element={<AdminPayouts />} />
        <Route path="resell" element={<AdminResell />} />
        <Route path="raffles-polls" element={<AdminRafflesPolls />} />
        <Route path="crash-logs" element={<AdminCrashLogs />} />
        <Route path="data-cleanup" element={<AdminDataCleanup />} />
        <Route path="video-budgets" element={<AdminVideoBudgets />} />
        <Route path="storage" element={<AdminStorageUsage />} />
        <Route path="embed" element={<AdminEmbedWidgets />} />
        <Route path="loyalty-points" element={<AdminLoyaltyPointRules />} />
      </Route>

      {/* Booking Calendar (shared, no bottom nav) */}
      <Route path="/booking-calendar" element={<BookingCalendar />} />
      <Route path="/booking/contract/:bookingId" element={<BookingContractPage />} />

      {/* Discovery & Calendar */}
      <Route element={<MainLayout />}>
        <Route path="/discover" element={<Discovery />} />
        <Route path="/all-events" element={<AllEvents />} />
        <Route path="/calendar" element={<EventCalendar />} />
        <Route path="/recommend" element={<RecommendedEvents />} />
      </Route>

      {/* Affiliate partner events */}
      <Route element={<MainLayout />}>
        <Route path="/partner-events" element={<AffiliateEvents />} />
        <Route path="/community" element={<CommunityFeed />} />
      </Route>

      {/* Resale market */}
      <Route element={<MainLayout />}>
        <Route path="/resale" element={<ResaleMarket />} />
        <Route path="/organizers/:id" element={<OrganizerPublicProfile />} />
        <Route path="/resale-marketplace" element={<ResaleMarketplace />} />
        <Route path="/saved" element={<SavedEvents />} />
        <Route path="/organizers" element={<AllOrganizers />} />
        <Route path="/gallery" element={<EventGallery />} />
        <Route path="/faq" element={<FAQ />} />
      </Route>

      {/* Artists public pages */}
      <Route element={<MainLayout />}>
        <Route path="/artists" element={<Artists />} />
        <Route path="/artists/:id" element={<ArtistProfile />} />
        <Route path="/artists/:id/tour" element={<ArtistTour />} />
        <Route path="/artist-media" element={<ArtistMedia />} />
        <Route path="/artists/:id/tour/:showId" element={<ArtistTourDetail />} />
      </Route>
      <Route path="/artist/signup" element={<ArtistSignup />} />
      <Route path="/organizer/signup" element={<OrganizerSignup />} />
      <Route path="/book/:id" element={<BookArtist />} />
      <Route path="/rider/:artistId" element={<TechnicalRiderPublic />} />

      {/* Artist studio */}
      <Route element={<ArtistLayout />}>
        <Route path="/artist" element={<ArtistDashboard />} />
        <Route path="/artist/posts" element={<ArtistPosts />} />
        <Route path="/artist/donations" element={<ArtistDonations />} />
        <Route path="/artist/raffles" element={<ArtistRaffles />} />
        <Route path="/artist/giveaways" element={<ArtistGiveaways />} />
        <Route path="/artist/analytics" element={<ArtistAnalytics />} />
        <Route path="/artist/payouts" element={<ArtistPayouts />} />
        <Route path="/artist/pl" element={<ArtistPL />} />
        <Route path="/artist/bookings" element={<ArtistBookings />} />
        <Route path="/artist/inbox" element={<ArtistInbox />} />
        <Route path="/artist/tiers" element={<ArtistTiers />} />
        <Route path="/artist/video" element={<ArtistVideoChats />} />
        <Route path="/artist/merch" element={<ArtistMerch />} />
        <Route path="/artist/gallery" element={<ArtistGallery />} />
        <Route path="/artist/downloads" element={<ArtistDownloads />} />
        <Route path="/artist/shoutouts" element={<ArtistShoutouts />} />
        <Route path="/artist/tour" element={<ArtistTourSchedule />} />
        <Route path="/artist/agency" element={<ArtistBookingAgency />} />
        <Route path="/artist/rider" element={<ArtistTechnicalRider />} />
        <Route path="/artist/referral" element={<ArtistReferralPerformance />} />
        <Route path="/artist/embed" element={<ArtistEmbedWidgets />} />
        <Route path="/artist/loyalty" element={<ArtistLoyaltyProgram />} />
        <Route path="/artist/prize-scanner" element={<ArtistPrizeScanner />} />
        <Route path="/artist/my-profile" element={<ArtistMyProfile />} />
      </Route>

      {/* Vendor scanner */}
      <Route path="/scanner" element={<VendorScanner />} />
      <Route path="/agent-dashboard" element={<WhiteLabelDashboard />} />
      <Route path="/user-blast" element={<UserBlast />} />
      <Route path="/redeem-transfer" element={<RedeemTransfer />} />
      <Route path="/raffle-win/:raffleId" element={<RaffleWinPage />} />
      <Route path="/raffle/:raffleId" element={<RaffleDetail />} />
      <Route path="/poll/:pollId" element={<PollDetail />} />
      <Route path="/vendor-dashboard" element={<VendorDashboard />} />
      <Route path="/white-label/embed" element={<WhiteLabelEmbedWidgets />} />
      <Route path="/seller/embed" element={<TicketSellerEmbedWidgets />} />
      <Route path="/affiliate-program" element={<AffiliateProgram />} />
      <Route path="/giveaways" element={<Giveaways />} />
      <Route path="/giveaways/:id" element={<GiveawayDetail />} />
      <Route path="/my-prizes" element={<MyPrizes />} />
      <Route path="/affiliate-earnings" element={<AffiliateEarningsReport />} />
      <Route path="/affiliate-analytics" element={<AffiliateReferralAnalytics />} />
      <Route path="/terms" element={<TermsAndConditions />} />
      <Route path="/policy" element={<Policy />} />
      <Route path="/privacy-policy" element={<PrivacyPolicy />} />
      <Route path="/pricing" element={<Pricing />} />
      <Route path="/support" element={<Contact />} />
      <Route path="/account-deletion" element={<AccountDeletion />} />

      {/* Public embed routes — no nav/header/footer */}
      <Route path="/embed/organizer/:id/events" element={<EmbedOrganizerEvents />} />
      <Route path="/embed/organizer/:id/profile" element={<EmbedOrganizerProfile />} />
      <Route path="/embed/organizer/:id/raffles-polls" element={<EmbedOrganizerRafflesPolls />} />
      <Route path="/embed/artist/:id/profile" element={<EmbedArtistProfile />} />
      <Route path="/embed/artist/:id/tour" element={<EmbedArtistTour />} />
      <Route path="/embed/artist/:id/media" element={<EmbedArtistMedia />} />
      <Route path="/embed/white-label/:id/profile" element={<EmbedWhiteLabelProfile />} />
      <Route path="/embed/seller/:id/profile" element={<EmbedSellerProfile />} />

      <Route path="/invite/:code" element={<InviteRedirect />} />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
    {showFanOnboarding && <FanOnboardingModal onClose={() => setShowFanOnboarding(false)} />}
    </>
  );
};


// Install global error handlers once at module level
installGlobalErrorHandlers();

function App() {
  // Detect real iOS devices only (not macOS desktop)
  const ua = navigator.userAgent;
  const isIOS = /iPhone|iPad|iPod/.test(ua) || (/Mac OS X/.test(ua) && navigator.maxTouchPoints > 1);

  // Apply synchronously before first render — iOS only
  if (isIOS) {
    document.documentElement.classList.add('ios-device');
    // Set CSS variable to the actual safe-area value (only on iOS)
    document.documentElement.style.setProperty('--safe-area-inset-top', 'env(safe-area-inset-top, 0px)');
  } else {
    document.documentElement.classList.remove('ios-device');
    document.documentElement.style.setProperty('--safe-area-inset-top', '0px');
  }

  return (
    <ErrorBoundary>
      <I18nProvider>
        <QueryClientProvider client={queryClientInstance}>
          <Router>
            <AuthProvider>
              <ScrollToTop />
              <AuthenticatedApp />
              <Toaster />
              <SonnerToaster />
            </AuthProvider>
          </Router>
        </QueryClientProvider>
      </I18nProvider>
    </ErrorBoundary>
  );
}

export default App