import { useState } from "react";
import { Link } from "react-router-dom";
import { Link2, Copy, Check, CalendarCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { APP_BASE_URL } from "@/lib/appUrl";

/**
 * Renders a shareable booking link for an approved artist.
 * Pass variant="button" for a full CTA, "inline" for a compact copy row, "icon" for icon-only.
 */
export default function ArtistBookingLink({ artist, variant = "inline" }) {
  const [copied, setCopied] = useState(false);

  if (!artist || artist.approval_status !== "approved") return null;

  const bookingUrl = `${APP_BASE_URL}/book/${artist.id}`;

  const handleCopy = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(bookingUrl);
      setCopied(true);
      toast.success("Booking link copied!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy link");
    }
  };

  if (variant === "button") {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <Button asChild variant="outline" size="sm" className="font-display font-bold gap-1.5 border-primary/40 text-primary hover:bg-primary/10">
          <Link to={`/book/${artist.id}`}>
            <CalendarCheck className="w-3.5 h-3.5" /> Book {artist.display_name}
          </Link>
        </Button>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border/50 text-xs font-mono text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
        >
          {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
          {copied ? "Copied!" : "Copy Link"}
        </button>
      </div>
    );
  }

  if (variant === "icon") {
    return (
      <button
        onClick={handleCopy}
        title="Copy booking link"
        className="p-1.5 rounded-md text-muted-foreground hover:text-primary transition-colors"
      >
        {copied ? <Check className="w-4 h-4 text-green-400" /> : <Link2 className="w-4 h-4" />}
      </button>
    );
  }

  // default: "inline"
  return (
    <div className="flex items-center gap-2 p-3 rounded-lg bg-secondary border border-border/50">
      <Link2 className="w-3.5 h-3.5 text-primary shrink-0" />
      <span className="text-xs font-mono text-muted-foreground truncate flex-1">{bookingUrl}</span>
      <button
        onClick={handleCopy}
        className="flex items-center gap-1 text-xs font-mono font-bold shrink-0 text-primary hover:text-primary/80 transition-colors"
      >
        {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
        {copied ? "Copied!" : "Copy"}
      </button>
    </div>
  );
}