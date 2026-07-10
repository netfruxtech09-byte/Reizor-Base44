/**
 * RouteErrorBoundary — wraps each route outlet.
 * Resets automatically when the route (key) changes, so iOS swipe-back
 * navigating to a previously crashed route gets a fresh render instead of
 * staying stuck on the error screen.
 *
 * Also catches cases where a component crashes after back-navigation because
 * props/state are null (common iOS WebView issue).
 */
import { Component } from "react";
import { logCrash } from "@/lib/crashLogger";

export default class RouteErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    logCrash({
      message: error?.message || String(error),
      stack: error?.stack || "",
      type: "render_error",
      componentStack: info?.componentStack || "",
      extraContext: `route: ${window.location.pathname} [route boundary]`,
    });
  }

  // When the route key changes (navigation / back gesture), reset the boundary
  // so the new page gets a clean render instead of the error screen.
  static getDerivedStateFromProps(props, state) {
    if (state.hasError && props.routeKey !== state.lastErrorRouteKey) {
      return { hasError: false, lastErrorRouteKey: null };
    }
    return null;
  }

  componentDidUpdate(prevProps) {
    if (this.state.hasError && prevProps.routeKey !== this.props.routeKey) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[60vh] flex items-center justify-center p-6">
          <div className="text-center space-y-4 max-w-xs">
            <div className="text-4xl">⚠️</div>
            <h2 className="text-lg font-display font-bold">Page failed to load</h2>
            <p className="text-sm text-muted-foreground">Something went wrong. Please go back or reload.</p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <button
                onClick={() => { window.history.back(); }}
                className="px-5 py-2 text-sm font-bold border border-border/50 rounded-lg hover:bg-muted transition-colors"
              >
                Go Back
              </button>
              <button
                onClick={() => { window.location.href = "/"; }}
                className="px-5 py-2 text-sm font-bold text-primary-foreground bg-primary rounded-lg hover:opacity-90 transition-opacity"
              >
                Go Home
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}