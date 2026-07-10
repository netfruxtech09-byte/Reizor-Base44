import { Link } from "react-router-dom";

const SECTIONS = [
  {
    title: "1. Introduction",
    content: `Reizor ("we", "our", or "us") is committed to protecting your personal information. This Privacy Policy explains how we collect, use, store, and protect your data when you use the Reizor platform — including our website, mobile application, and related services.\n\nBy using Reizor, you agree to the collection and use of information as described in this policy.`,
  },
  {
    title: "2. Information We Collect",
    content: `We collect the following types of information:\n\n• Account Information: name, email address, and password when you register.\n• Profile Information: city, bio, phone number, music preferences, and profile photos you provide.\n• Transaction Data: ticket purchases, order history, payment method type (we do not store full card numbers), and refund records.\n• Usage Data: pages visited, search queries, events viewed, tickets scanned, and interactions within the platform.\n• Device & Technical Data: IP address, browser type, operating system, and device identifiers.\n• Location Data: city-level location if you grant location access for personalized event recommendations.`,
  },
  {
    title: "3. How We Use Your Data",
    content: `We use your data to:\n\n• Create and manage your Reizor account.\n• Process ticket purchases and send digital tickets.\n• Personalize event recommendations based on your location and music preferences.\n• Send transactional emails (order confirmations, event updates, ticket transfers).\n• Send promotional emails about new events — you may opt out at any time.\n• Detect and prevent fraud, abuse, and unauthorized activity.\n• Improve platform features through usage analytics.\n• Comply with legal obligations.`,
  },
  {
    title: "4. Sharing of Information",
    content: `We do not sell your personal data.\n\nWe may share your information with:\n\n• Event Organizers: your name and email may be shared with organizers of events you have purchased tickets for, solely for event management and entry verification purposes.\n• Payment Processors: payment details are handled by our third-party payment provider. We only receive confirmation and partial payment information.\n• Service Providers: we use third-party services for hosting, analytics, and email delivery. These providers are contractually bound to protect your data.\n• Legal Authorities: we may disclose data when required by law, court order, or governmental authority.`,
  },
  {
    title: "5. Cookies & Tracking",
    content: `Reizor uses cookies and similar tracking technologies to:\n\n• Keep you logged into your account.\n• Remember your preferences and settings.\n• Analyze platform usage and improve performance.\n• Detect security threats.\n\nYou may control cookie settings via your browser. Disabling cookies may limit certain platform features.\n\nWe do not use cookies for third-party advertising.`,
  },
  {
    title: "6. Data Retention",
    content: `We retain your account data for as long as your account is active or as needed to provide services.\n\nTransaction records are retained for up to 7 years for legal and accounting purposes.\n\nYou may request deletion of your account and personal data at any time (see Section 8).`,
  },
  {
    title: "7. Data Security",
    content: `We implement industry-standard security measures to protect your data, including:\n\n• Encrypted data transmission (HTTPS/TLS).\n• Secure storage with access controls.\n• Regular security reviews.\n\nHowever, no method of transmission over the internet is 100% secure. We encourage you to use strong passwords and keep your credentials confidential.`,
  },
  {
    title: "8. Your Rights",
    content: `Depending on your jurisdiction, you may have the following rights:\n\n• Access: request a copy of the personal data we hold about you.\n• Correction: request correction of inaccurate or incomplete data.\n• Deletion: request deletion of your personal data ("right to be forgotten").\n• Portability: request your data in a portable, machine-readable format.\n• Opt-Out: unsubscribe from marketing emails at any time using the unsubscribe link in any email.\n\nTo exercise any of these rights, contact us at: privacy@reizor.com`,
  },
  {
    title: "9. Children's Privacy",
    content: `Reizor is not intended for users under the age of 16. We do not knowingly collect personal data from minors.\n\nIf you believe a minor has provided us with personal data, please contact us immediately at privacy@reizor.com and we will take steps to remove the information.`,
  },
  {
    title: "10. Third-Party Links",
    content: `The Reizor platform may contain links to third-party websites or services (e.g., artist social media profiles, external ticketing partners). We are not responsible for the privacy practices of those third parties.\n\nWe encourage you to review the privacy policy of any third-party service you visit.`,
  },
  {
    title: "11. Changes to This Policy",
    content: `We may update this Privacy Policy from time to time. When we do, we will update the "Last Updated" date at the top of this page.\n\nSignificant changes will be communicated via email or a notice on the platform. Your continued use of Reizor after any changes constitutes your acceptance of the updated policy.`,
  },
  {
    title: "12. Contact Us",
    content: `If you have questions, concerns, or requests related to this Privacy Policy, please contact:\n\nReizor Privacy Team\nEmail: privacy@reizor.com\nSupport: support@reizor.com\n\nWe aim to respond to all privacy-related inquiries within 5 business days.`,
  },
];

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 space-y-10">
        {/* Header */}
        <div>
          <p className="font-mono text-xs text-primary uppercase tracking-widest mb-3">Legal</p>
          <h1 className="font-display font-black text-4xl sm:text-5xl tracking-tighter mb-2">
            Privacy Policy
          </h1>
          <p className="text-muted-foreground font-mono text-sm">Last updated: April 2026</p>
          <div className="mt-6 h-px bg-border/50" />
        </div>

        <p className="text-sm text-muted-foreground leading-relaxed">
          At Reizor, we take your privacy seriously. This policy explains exactly what data we collect, why we collect it, and how we protect it.
        </p>

        {/* Sections */}
        <div className="space-y-8">
          {SECTIONS.map((s) => (
            <div key={s.title} className="space-y-3">
              <h2 className="font-display font-bold text-lg text-foreground">{s.title}</h2>
              <div className="space-y-2">
                {s.content.split("\n\n").map((para, i) => (
                  <p key={i} className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{para}</p>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="pt-8 border-t border-border/50 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="font-mono text-xs text-muted-foreground">
            © {new Date().getFullYear()} Reizor. All rights reserved.
          </p>
          <Link to="/" className="font-mono text-xs text-primary hover:underline">
            ← Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}