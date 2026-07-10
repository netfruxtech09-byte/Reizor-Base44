import { Mail, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function AccountDeletion() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="border-b border-border/50">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <h1 className="text-4xl sm:text-5xl font-display font-bold tracking-tight">
            Account Deletion
          </h1>
          <p className="text-muted-foreground mt-2 text-lg">
            Learn how to delete your Reizor account
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Introduction */}
        <div className="mb-12">
          <p className="text-foreground text-base sm:text-lg leading-relaxed">
            Users can delete their Reizor account inside the app.
          </p>
        </div>

        {/* Steps */}
        <div className="mb-12">
          <h2 className="text-2xl font-display font-bold mb-6 text-foreground">
            Steps
          </h2>
          <ol className="space-y-4">
            {[
              "Open the Reizor app.",
              "Log in to your account.",
              "Go to My Profile.",
              "Tap Delete Account.",
              "Confirm account deletion."
            ].map((step, idx) => (
              <li
                key={idx}
                className="flex gap-4 p-4 rounded-lg bg-card border border-border/50 hover:border-border/75 transition-colors"
              >
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 text-primary border border-primary/30 flex items-center justify-center font-display font-bold text-sm">
                  {idx + 1}
                </div>
                <div className="flex-1 flex items-center">
                  <p className="text-foreground font-medium">{step}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        {/* Alternative Method */}
        <div className="p-6 rounded-lg bg-secondary/40 border border-border/50">
          <h3 className="text-lg font-display font-bold mb-3 text-foreground">
            Need Help?
          </h3>
          <p className="text-foreground text-sm sm:text-base leading-relaxed mb-4">
            If you cannot access your account, please email us from your registered email address with the subject "Delete My Reizor Account".
          </p>
          <a
            href="mailto:support@reizor.com?subject=Delete%20My%20Reizor%20Account"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-white font-display font-bold text-sm hover:bg-primary/90 transition-colors"
          >
            <Mail className="w-4 h-4" />
            support@reizor.com
          </a>
        </div>

        {/* Footer Note */}
        <div className="mt-12 pt-8 border-t border-border/50">
          <p className="text-xs sm:text-sm text-muted-foreground">
            This page provides information about account deletion for app store compliance. Your privacy and account security are important to us.
          </p>
        </div>
      </div>
    </div>
  );
}