import { useState } from "react";
import { ChevronDown } from "lucide-react";
import PageMeta from "@/components/seo/PageMeta";
import StructuredData from "@/components/seo/StructuredData";

const FAQ_ITEMS = [
  {
    q: "What is Reizor?",
    a: "Reizor is a music events and ticketing platform where you can discover upcoming events, buy tickets, and connect with event organizers and artists. Whether you're looking for techno, house, hip-hop, or any other genre, Reizor helps you find your next night out.",
  },
  {
    q: "How do I buy tickets?",
    a: "Browse events on the Home page or use the Search and Discovery pages to find events near you. Click on any event to see details, select your tickets, and complete the secure checkout with Stripe. You'll receive your tickets via email and in the My Tickets section.",
  },
  {
    q: "Can I get a refund?",
    a: "Refund policies are set by each event organizer. Generally, all ticket sales are final. Check the event page for the organizer's specific refund policy. If an event is cancelled by the organizer, you will be refunded automatically.",
  },
  {
    q: "How do I become an event organizer?",
    a: "Sign up on Reizor and navigate to the Organizer Signup page. Fill in your profile details, and you'll gain access to the organizer dashboard where you can create, manage, and promote your events. It's free to sign up — you only pay when you sell tickets.",
  },
  {
    q: "What are the fees for organizers?",
    a: "Reizor charges a small platform fee per ticket sold plus a credit card processing fee. Organizers can choose to pass these fees to buyers or absorb them. You can customize fee settings in your organizer dashboard under Payout settings.",
  },
  {
    q: "How do I resell a ticket I can't use?",
    a: "If you can't attend an event, you can list your ticket on the Resale Market. Go to My Tickets, select the ticket, and choose 'Resell'. Set your price and the ticket becomes available for other fans to purchase. You'll receive payment once the ticket is sold.",
  },
  {
    q: "What are loyalty programs?",
    a: "Organizers can set up loyalty programs where fans earn rewards for attending multiple events. Rewards can include free tickets, discounts, backstage access, or cashback. Check individual organizer profiles to see their loyalty tiers.",
  },
  {
    q: "How are artists featured on Reizor?",
    a: "Artists can create profiles showcasing their music, tour dates, albums, and merchandise. Fans can follow artists, book them for events, and support them through donations. Artists sign up through the Artist Signup page.",
  },
  {
    q: "Is my payment information secure?",
    a: "Yes. All payments are processed through Stripe, a PCI-DSS Level 1 certified payment processor. Reizor never stores your full credit card details. Your payment data is encrypted and handled securely.",
  },
  {
    q: "How do I contact an event organizer?",
    a: "Visit the organizer's public profile page and click the 'Contact Organizer' button. You can send them a message directly through the platform. Organizers receive notifications and can respond via email.",
  },
  {
    q: "What is the Resale Market?",
    a: "The Resale Market allows fans to safely buy and sell tickets they can't use. Sellers list their tickets at their chosen price, and buyers can purchase verified tickets at potentially discounted rates. All resale transactions are handled securely through the platform.",
  },
  {
    q: "Do you have a mobile app?",
    a: "Reizor is a web-based platform that works great on mobile browsers. You can add Reizor to your phone's home screen for an app-like experience. We're continuously improving the mobile experience.",
  },
];

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": FAQ_ITEMS.map((item) => ({
    "@type": "Question",
    "name": item.q,
    "acceptedAnswer": {
      "@type": "Answer",
      "text": item.a,
    },
  })),
};

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState(null);

  return (
    <div className="min-h-screen py-8 px-4 sm:px-6 max-w-3xl mx-auto">
      <PageMeta
        title="FAQ — REIZOR"
        description="Find answers to common questions about Reizor — tickets, events, refunds, loyalty programs, resale market, and more."
        canonical="https://reizor.com/faq"
      />
      <StructuredData data={faqSchema} />

      {/* Header */}
      <div className="mb-8">
        <span className="font-mono text-xs text-primary tracking-[0.3em] uppercase">★ Help Center</span>
        <h1 className="font-display font-black text-4xl tracking-tight mt-1">FREQUENTLY ASKED QUESTIONS</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Everything you need to know about Reizor — events, tickets, organizers, and more.
        </p>
      </div>

      {/* FAQ Accordion */}
      <div className="space-y-3">
        {FAQ_ITEMS.map((item, i) => (
          <div
            key={i}
            className="rounded-xl bg-card border border-border/50 overflow-hidden"
          >
            <button
              onClick={() => setOpenIndex(openIndex === i ? null : i)}
              className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-muted/30 transition-colors"
            >
              <span className="font-display font-bold text-sm sm:text-base pr-2">
                {item.q}
              </span>
              <ChevronDown
                className={`w-5 h-5 text-muted-foreground shrink-0 transition-transform duration-200 ${
                  openIndex === i ? "rotate-180" : ""
                }`}
              />
            </button>
            {openIndex === i && (
              <div className="px-5 pb-4 pt-0">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {item.a}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Footer CTA */}
      <div className="mt-12 p-6 rounded-2xl bg-gradient-to-br from-primary/10 to-accent/10 border border-primary/20 text-center">
        <p className="font-display font-bold text-lg mb-2">Still have questions?</p>
        <p className="text-sm text-muted-foreground mb-4">
          Browse events, explore organizer profiles, or reach out to us.
        </p>
        <div className="flex gap-3 justify-center flex-wrap">
          <a
            href="/search"
            className="inline-flex items-center px-5 py-2.5 rounded-lg bg-primary text-primary-foreground font-bold text-sm hover:bg-primary/90 transition-colors"
          >
            Browse Events
          </a>
          <a
            href="/terms"
            className="inline-flex items-center px-5 py-2.5 rounded-lg border-2 border-primary/60 text-primary font-bold text-sm hover:bg-primary/10 transition-colors"
          >
            Terms & Conditions
          </a>
        </div>
      </div>
    </div>
  );
}