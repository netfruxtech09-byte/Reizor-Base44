import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Only log to console — render errors are not business-relevant system logs
    console.error("[ErrorBoundary]", error, info);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleHome = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-background">
          <div className="text-center space-y-5 max-w-sm w-full">
            <div className="w-16 h-16 rounded-2xl bg-destructive/10 border border-destructive/30 flex items-center justify-center mx-auto">
              <span className="text-3xl">⚠️</span>
            </div>
            <div>
              <h2 className="text-xl font-display font-black text-foreground">Something went wrong</h2>
              <p className="text-sm text-muted-foreground mt-2">
                Something went wrong. Please reload the app.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={this.handleReload}
                className="inline-flex items-center justify-center px-6 py-2.5 text-sm font-bold text-primary-foreground bg-primary rounded-lg hover:opacity-90 transition-opacity"
              >
                Reload App
              </button>
              <button
                onClick={this.handleHome}
                className="inline-flex items-center justify-center px-6 py-2.5 text-sm font-bold border border-border/50 rounded-lg hover:bg-muted transition-colors"
              >
                Go Home
              </button>
            </div>
            {this.state.error?.message && (
              <p className="text-[10px] font-mono text-muted-foreground/50 break-all">
                {this.state.error.message}
              </p>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}