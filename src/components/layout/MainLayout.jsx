import { Outlet, useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import Navbar from "./Navbar";
import Footer from "./Footer";
import FloatingChatButton from "../support/FloatingChatButton";
import MobileBottomNav from "./MobileBottomNav";
import RouteErrorBoundary from "@/components/RouteErrorBoundary";
import OfflineBanner from "@/components/shared/OfflineBanner";

const pageVariants = {
  initial: { opacity: 0, x: 18 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.22, ease: [0.25, 0.46, 0.45, 0.94] } },
  exit:    { opacity: 0, x: -12, transition: { duration: 0.15, ease: "easeIn" } },
};

export default function MainLayout() {
  const location = useLocation();
  return (
    <div className="min-h-screen bg-background flex flex-col mobile-bottom-nav-spacing">
      <Navbar />
      <OfflineBanner />
      <main className="main-content flex-1 overflow-x-hidden">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={location.pathname}
            variants={pageVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            style={{ willChange: "transform, opacity" }}
          >
            <RouteErrorBoundary routeKey={location.pathname}>
              <Outlet />
            </RouteErrorBoundary>
          </motion.div>
        </AnimatePresence>
      </main>
      <Footer />
      <FloatingChatButton />
      <MobileBottomNav />
    </div>
  );
}