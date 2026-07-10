import { useState } from "react";
import { Trophy, X, Mail, Copy, Check, Download, Share2, Gift, Calendar, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { base44 } from "@/api/base44Client";
import { sendEmail } from "@/utils/emailService";
import { buildEmailBody } from "@/utils/emailTemplate";
import { toast } from "sonner";

/**
 * Post-draw winner spotlight modal.
 * Props:
 *   winners    — array of { item_subject, winner_email, winner_name }
 *   event      — { id, title, organizer_name }
 *   drawnAt    — ISO string
 *   onClose    — fn
 */
export default function WinnerResultModal({ winners, event, drawnAt, onClose }) {
  const [copied, setCopied] = useState(false);
  const [resending, setResending] = useState({}); // { email: bool }
  const [generatingFlyer, setGeneratingFlyer] = useState(false);
  const [flyerUrl, setFlyerUrl] = useState(null);

  // Group winners by prize
  const grouped = {};
  winners.forEach(w => {
    if (!grouped[w.item_subject]) grouped[w.item_subject] = [];
    grouped[w.item_subject].push(w);
  });

  const announcementText = winners.map(w =>
    `🏆 ${w.winner_name || w.winner_email} won: ${w.item_subject} at ${event.title}`
  ).join("\n");

  const handleCopy = () => {
    const text = `🎉 Raffle Winners — ${event.title}\n\n${announcementText}\n\nDrawn: ${format(new Date(drawnAt), "MMM d, yyyy h:mm a")}\n\nPowered by Reizor`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Announcement copied!");
  };

  const buildWinnerEmail = (email, name, prizeList) => ({
    to: email,
    subject: `🎉 Congratulations! You won the raffle for ${event.title}`,
    body: buildEmailBody({
      title: "🏆 You're a Raffle Winner!",
      greeting: `Hi ${name || "Winner"},`,
      message: `Congratulations! You have been selected as a raffle winner for <strong>${event.title}</strong>.`,
      infoBox: {
        highlight: true,
        rows: [
          { label: "Event", value: event.title },
          { label: "Prize Won", value: prizeList.join(", ") },
          { label: "Drawn At", value: format(new Date(drawnAt), "MMM d, yyyy h:mm a") },
          ...(event.organizer_name ? [{ label: "Organizer", value: event.organizer_name }] : []),
        ],
      },
      extraLines: [
        "To claim your prize, visit the event or contact the organizer directly.",
        "Please bring a valid ID and mention your winning email when claiming your prize.",
        flyerUrl ? `<a href="${flyerUrl}" style="color:#ff1b8d;">Download your winner flyer to share on social media!</a>` : null,
      ].filter(Boolean),
      ctaText: "Claim My Prize →",
      ctaUrl: `${window.location.origin}/my-tickets`,
      footerNote: flyerUrl
        ? `Share your win on social media! Download flyer: ${flyerUrl}`
        : "Contact the event organizer if you have questions about prize collection.",
    }),
  });

  const handleResend = async (email, name, prizeList) => {
    setResending(r => ({ ...r, [email]: true }));
    await sendEmail({ _source: "WinnerResultModal/resend", ...buildWinnerEmail(email, name, prizeList) }).catch(() => {});
    toast.success(`Email resent to ${email}`);
    setResending(r => ({ ...r, [email]: false }));
  };

  const handleGenerateFlyer = async () => {
    setGeneratingFlyer(true);
    const firstWinner = winners[0];
    const prizes = [...new Set(winners.map(w => w.item_subject))].join(", ");
    const prompt = `Create a vibrant, celebratory social media winner announcement flyer. Dark background with gold/purple accent colors. 
Text elements to include: "WINNER!" at the top in large bold text, "Congratulations ${firstWinner?.winner_name || "Our Winner"}!" in the center, 
"Prize: ${prizes}", "Event: ${event.title}", "Powered by Reizor" at the bottom in small text. 
Style: modern nightlife/event poster aesthetic, confetti/star elements, trophy emoji graphic, professional social media square format (1:1).`;

    const result = await base44.integrations.Core.GenerateImage({ prompt }).catch(() => null);
    if (result?.url) {
      setFlyerUrl(result.url);
      toast.success("Winner flyer generated!");
    } else {
      toast.error("Flyer generation failed. Try again.");
    }
    setGeneratingFlyer(false);
  };

  const handleDownloadFlyer = async () => {
    if (!flyerUrl) return;
    const a = document.createElement("a");
    a.href = flyerUrl;
    a.download = `winner-flyer-${event.title.replace(/\s+/g, "-").toLowerCase()}.png`;
    a.target = "_blank";
    a.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-card border border-border/60 rounded-2xl w-full max-w-lg shadow-2xl overflow-y-auto max-h-[90vh]">

        {/* Header */}
        <div className="relative bg-gradient-to-br from-yellow-500/20 via-primary/10 to-accent/10 p-6 rounded-t-2xl border-b border-border/50">
          <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-lg hover:bg-muted/50 text-muted-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-yellow-500/20 flex items-center justify-center">
              <Trophy className="w-6 h-6 text-yellow-400" />
            </div>
            <div>
              <h2 className="font-display font-black text-xl text-yellow-400">Winner Selected!</h2>
              <p className="text-xs text-muted-foreground font-mono">
                {format(new Date(drawnAt), "MMM d, yyyy · h:mm a")}
              </p>
            </div>
          </div>
          <p className="text-sm text-green-400 font-mono mt-2">✓ Winner selected successfully. Notifications sent.</p>
        </div>

        {/* Winner cards */}
        <div className="p-5 space-y-3">
          {Object.entries(grouped).map(([prize, ws]) => (
            <div key={prize} className="rounded-xl border border-yellow-500/30 bg-yellow-500/5 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2 bg-yellow-500/10 border-b border-yellow-500/20">
                <Gift className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
                <span className="font-mono font-bold text-xs text-yellow-400 uppercase tracking-wider">{prize}</span>
              </div>
              <div className="divide-y divide-border/20">
                {ws.map((w, i) => {
                  const prizeList = grouped[prize].length > 0 ? [prize] : [prize];
                  return (
                    <div key={i} className="px-4 py-3 space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <Trophy className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
                            <span className="font-display font-bold text-sm">{w.winner_name || w.winner_email}</span>
                          </div>
                          <p className="text-xs text-muted-foreground font-mono mt-0.5 ml-5">{w.winner_email}</p>
                        </div>
                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-green-400/10 text-green-400 shrink-0 mt-1">
                          SELECTED
                        </span>
                      </div>
                      <div className="flex items-center gap-2 ml-5">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary/10 font-mono"
                          disabled={resending[w.winner_email]}
                          onClick={() => handleResend(w.winner_email, w.winner_name, [w.item_subject])}
                        >
                          {resending[w.winner_email]
                            ? <Loader2 className="w-3 h-3 animate-spin" />
                            : <Mail className="w-3 h-3" />}
                          Resend Email
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Event info row */}
          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/30 border border-border/40">
            <Calendar className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <span className="text-xs text-muted-foreground font-mono">{event.title}</span>
          </div>

          {/* Flyer section */}
          <div className="rounded-xl border border-accent/30 bg-accent/5 p-4 space-y-3">
            <p className="text-xs font-mono font-bold text-accent uppercase tracking-wider flex items-center gap-1.5">
              <Share2 className="w-3.5 h-3.5" /> Social Media Flyer
            </p>

            {flyerUrl ? (
              <div className="space-y-2">
                <img src={flyerUrl} alt="Winner Flyer" className="w-full rounded-lg border border-border/40" />
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={handleDownloadFlyer} className="flex-1 gap-1.5 text-xs font-mono">
                    <Download className="w-3 h-3" /> Download Flyer
                  </Button>
                  <Button size="sm" variant="outline" onClick={handleGenerateFlyer} disabled={generatingFlyer} className="text-xs font-mono">
                    {generatingFlyer ? <Loader2 className="w-3 h-3 animate-spin" /> : "Regenerate"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Generate an AI winner flyer the winner can share on social media.</p>
                <Button
                  size="sm"
                  onClick={handleGenerateFlyer}
                  disabled={generatingFlyer}
                  className="w-full gap-2 bg-accent hover:bg-accent/90 text-accent-foreground font-mono text-xs"
                >
                  {generatingFlyer
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating Flyer...</>
                    : <><Share2 className="w-3.5 h-3.5" /> Generate Winner Flyer</>}
                </Button>
              </div>
            )}
          </div>

          {/* Copy announcement */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className="w-full gap-2 font-mono text-xs border-border/50"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? "Copied!" : "Copy Winner Announcement"}
          </Button>
        </div>

        {/* Footer */}
        <div className="px-5 pb-5">
          <Button onClick={onClose} className="w-full font-display font-bold">
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}