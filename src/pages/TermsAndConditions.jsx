const SECTIONS = [
  {
    num: "1",
    title: "About Reizor",
    body: [
      { type: "p", text: "Reizor is a digital ticketing and event platform that enables users to discover events, purchase tickets, resell eligible tickets, and manage event entry." },
      { type: "p", text: "Reizor operates solely as a technology platform connecting event organizers with customers. Unless explicitly stated, Reizor is not the event organizer, promoter, venue, or host." },
    ],
  },
  {
    num: "2",
    title: "Acceptance of Terms",
    body: [
      { type: "p", text: 'By accessing or using Reizor through our website, mobile application, or related services (the "Platform"), you agree to be bound by these Terms & Conditions.' },
      { type: "p", text: "If you do not agree, you must not use the Platform." },
    ],
  },
  {
    num: "3",
    title: "Eligibility",
    body: [
      { type: "p", text: "You must be legally capable of entering into a binding agreement to use Reizor." },
      { type: "p", text: "By using the Platform, you confirm that:" },
      { type: "ul", items: ["All information you provide is accurate and current", "You meet all applicable legal age requirements"] },
    ],
  },
  {
    num: "4",
    title: "Account Registration",
    body: [
      { type: "p", text: "Certain features require account creation." },
      { type: "p", text: "You are responsible for:" },
      { type: "ul", items: ["Maintaining the confidentiality of your login credentials", "All activity under your account"] },
      { type: "p", text: "Reizor may suspend or terminate accounts if fraud, misuse, or security concerns arise." },
    ],
  },
  {
    num: "5",
    title: "Ticket Purchases",
    body: [
      { type: "ul", items: [
        "All purchases are final unless otherwise stated or required by law",
        "Pricing, fees, and taxes are disclosed before checkout",
        "Tickets are delivered digitally (e.g., QR codes)",
        "Each ticket is valid for one-time use only",
      ]},
    ],
  },
  {
    num: "6",
    title: "Refund Policy",
    body: [
      { type: "p", text: "ALL SALES ARE FINAL. Except where required by law or expressly authorized by the event organizer, Reizor does not provide refunds, exchanges, credits, or compensation for:" },
      { type: "ul", items: ["Missed events", "Failure to attend", "Personal schedule conflicts", "Travel issues or transportation delays", "Illness or personal emergencies", "Changes in personal circumstances", "Dissatisfaction with performers, venue, lineup, seating, production quality, or event experience", "Late arrival or denied entry due to failure to comply with venue or event rules"] },
      { type: "p", text: "If an event is canceled and the organizer authorizes compensation, Reizor may issue either:" },
      { type: "ul", items: ["A refund to the original payment method, or", "Non-cash platform credit"] },
      { type: "p", text: "The form, amount, timing, and eligibility of compensation are determined solely by the organizer and applicable law." },
      { type: "p", text: "Reizor does not guarantee refunds for postponed, rescheduled, modified, partially completed, interrupted, or lineup-changed events unless specifically authorized by the organizer or required by law." },
    ],
  },
  {
    num: "7",
    title: "Ticket Resale",
    body: [
      { type: "ul", items: [
        "Resale is permitted only if enabled by the event organizer",
        "Resale must occur exclusively through Reizor",
        "Tickets resold externally may be invalidated",
      ]},
      { type: "p", text: "Reizor may control resale pricing, availability, and eligibility." },
    ],
  },
  {
    num: "8",
    title: "Credit Policy",
    body: [
      { type: "p", text: "If resale is unsuccessful, Reizor may issue account credit subject to eligibility rules." },
      { type: "p", text: "Credits:" },
      { type: "ul", items: [
        "Are non-transferable and non-cash",
        "May be limited to the same organizer",
        "May exclude fees",
        "May expire",
      ]},
      { type: "p", text: "Reizor may deny credit in cases of fraud, abuse, or violations." },
    ],
  },
  {
    num: "9",
    title: "Credit Forfeiture",
    body: [
      { type: "p", text: "If credit is used to purchase another ticket and that ticket is not used or resold:" },
      { type: "ul", items: ["The credit and ticket are forfeited", "No replacement or refund will be issued"] },
      { type: "p", text: "Credits may only be used once unless otherwise stated." },
    ],
  },
  {
    num: "10",
    title: "Ticket Validity & Entry",
    body: [
      { type: "ul", items: [
        "Each ticket contains a unique digital credential",
        "Tickets may only be used once",
      ]},
      { type: "p", text: "Invalid tickets include:" },
      { type: "ul", items: ["Duplicated or altered tickets", "Unauthorized resale tickets"] },
      { type: "p", text: "Reizor may deny entry or cancel tickets suspected of fraud." },
    ],
  },
  {
    num: "11",
    title: "Event Responsibility",
    body: [
      { type: "p", text: "Event organizers are solely responsible for:" },
      { type: "ul", items: [
        "Event execution",
        "Lineups and scheduling",
        "Venue operations and safety",
        "Compliance with laws",
      ]},
      { type: "p", text: "Reizor does not guarantee event quality or availability." },
    ],
  },
  {
    num: "12",
    title: "Organizer Rights & Platform Controls",
    body: [
      { type: "p", text: "Reizor may:" },
      { type: "ul", items: ["Remove event listings", "Suspend organizers", "Withhold payouts"] },
      { type: "p", text: "This may occur due to fraud, disputes, legal risk, or safety concerns." },
    ],
  },
  {
    num: "13",
    title: "Prohibited Conduct",
    body: [
      { type: "p", text: "You may not:" },
      { type: "ul", items: [
        "Use bots or automation tools",
        "Resell tickets outside the platform (when restricted)",
        "Copy, forge, or manipulate tickets",
        "Bypass security measures",
        "Interfere with platform operations",
      ]},
      { type: "p", text: "Violations may result in account termination, ticket cancellation, and legal action." },
    ],
  },
  {
    num: "14",
    title: "Fees & Payments",
    body: [
      { type: "p", text: "Reizor may charge service, processing, or platform fees." },
      { type: "p", text: "Payments are handled by third-party processors. Reizor is not responsible for their errors or delays." },
    ],
  },
  {
    num: "15",
    title: "Chargebacks & Payment Disputes",
    body: [
      { type: "p", text: "You agree to contact Reizor before initiating a chargeback." },
      { type: "p", text: "If a chargeback is filed:" },
      { type: "ul", items: [
        "Your account may be suspended",
        "Tickets may be canceled",
        "You may be liable for associated fees",
      ]},
    ],
  },
  {
    num: "16",
    title: "Fraud Prevention",
    body: [
      { type: "p", text: "Reizor may:" },
      { type: "ul", items: [
        "Monitor activity",
        "Cancel suspicious transactions",
        "Require identity verification",
        "Limit or restrict accounts",
      ]},
      { type: "p", text: "Failure to comply may result in suspension." },
    ],
  },
  {
    num: "17",
    title: "Intellectual Property",
    body: [
      { type: "p", text: "All platform content, branding, and technology are owned by Reizor or its licensors." },
      { type: "p", text: "You may not copy, modify, or use content without permission." },
    ],
  },
  {
    num: "18",
    title: "Platform Availability",
    body: [
      { type: "p", text: "Reizor does not guarantee uninterrupted service." },
      { type: "p", text: "We may modify, suspend, or discontinue features at any time." },
    ],
  },
  {
    num: "19",
    title: "Termination & Suspension",
    body: [
      { type: "p", text: "Reizor may suspend or terminate access at any time for violations, fraud, or risk to the platform." },
    ],
  },
  {
    num: "20",
    title: "Disclaimer",
    body: [
      { type: "p", text: 'The Platform is provided "as is" and "as available."' },
      { type: "p", text: "Reizor disclaims all warranties to the fullest extent permitted by law." },
    ],
  },
  {
    num: "21",
    title: "Limitation of Liability",
    body: [
      { type: "p", text: "Reizor is not liable for:" },
      { type: "ul", items: [
        "Indirect or consequential damages",
        "Loss of profits or opportunity",
        "Event-related issues",
      ]},
      { type: "p", text: "This includes cancellations, injuries, or venue conditions." },
    ],
  },
  {
    num: "22",
    title: "Indemnification",
    body: [
      { type: "p", text: "You agree to indemnify and hold harmless Reizor and its affiliates from any claims arising from:" },
      { type: "ul", items: [
        "Your use of the Platform",
        "Your violation of these Terms",
        "Your event-related conduct",
      ]},
    ],
  },
  {
    num: "23",
    title: "Force Majeure",
    body: [
      { type: "p", text: "Reizor is not responsible for delays or failures due to events beyond its control, including:" },
      { type: "ul", items: [
        "Natural disasters",
        "Government actions",
        "Public health emergencies",
        "Infrastructure failures",
      ]},
    ],
  },
  {
    num: "24",
    title: "Electronic Communications",
    body: [
      { type: "p", text: "By using Reizor, you consent to receive electronic communications, including emails, SMS, and notifications." },
    ],
  },
  {
    num: "25",
    title: "Privacy",
    body: [
      { type: "p", text: "Your use of the Platform is also governed by our Privacy Policy." },
    ],
  },
  {
    num: "26",
    title: "Assignment",
    body: [
      { type: "p", text: "You may not transfer your rights under these Terms." },
      { type: "p", text: "Reizor may assign its rights at any time." },
    ],
  },
  {
    num: "27",
    title: "Severability",
    body: [
      { type: "p", text: "If any provision is invalid, the remaining Terms remain enforceable." },
    ],
  },
  {
    num: "28",
    title: "Entire Agreement",
    body: [
      { type: "p", text: "These Terms and related policies constitute the full agreement between you and Reizor." },
    ],
  },
  {
    num: "29",
    title: "Waiver",
    body: [
      { type: "p", text: "Failure to enforce any provision does not waive that right." },
    ],
  },
  {
    num: "30",
    title: "Governing Law",
    body: [
      { type: "p", text: "These Terms are governed by the laws of the State of New York." },
      { type: "p", text: "All disputes must be resolved in courts located in New York County, New York." },
    ],
  },
  {
    num: "31",
    title: "Changes to Terms",
    body: [
      { type: "p", text: "Reizor may update these Terms at any time." },
      { type: "p", text: "Continued use of the Platform constitutes acceptance of updates." },
    ],
  },
  {
    num: "32",
    title: "Pro Referral Program",
    body: [
      { type: "p", text: "Reizor offers an optional referral program." },
      { type: "p", text: "Participants earn:" },
      { type: "ul", items: ["$3 per referred fan who signs up for any cashback membership"] },
      { type: "p", text: "Credits:" },
      { type: "ul", items: ["Non-transferable and non-cash"] },
      { type: "p", text: "Reizor may modify or terminate the program at any time." },
    ],
  },
  {
    num: "33",
    title: "Membership Raffle Benefits Policy",
    body: [
      { type: "p", text: "Certain membership tiers on Reizor may include promotional raffle benefits, sweepstakes access, giveaways, or entry-based rewards offered by event organizers or Reizor promotional campaigns." },
      { type: "p", text: "Raffle Entries" },
      { type: "p", text: "Membership tiers may receive promotional raffle entries as follows:" },
      { type: "ul", items: ["Standard Membership: One (1) raffle entry", "Premium Membership: Three (3) raffle entries"] },
      { type: "p", text: "Reizor reserves the right to modify, suspend, limit, or discontinue raffle entry allocations, membership benefits, or promotional programs at any time without prior notice." },
      { type: "p", text: "No Guarantee of Winning" },
      { type: "p", text: "Raffle participation does not guarantee:" },
      { type: "ul", items: [
        "Selection as a winner",
        "Receipt of any prize, benefit, access, ticket, or promotional reward",
        "Future raffle availability",
      ]},
      { type: "p", text: "Odds of winning depend on the number of eligible participants and organizer discretion." },
      { type: "p", text: "Organizer-Controlled Promotions" },
      { type: "p", text: "Certain raffles, giveaways, and promotional rewards may be operated, managed, or fulfilled directly by third-party event organizers, promoters, venues, sponsors, or partners. Reizor is not responsible for:" },
      { type: "ul", items: [
        "Organizer decisions",
        "Prize fulfillment delays",
        "Event cancellations",
        "Changes to rewards",
        "Disqualification decisions",
        "Taxes, fees, or expenses related to prizes",
      ]},
      { type: "p", text: "Organizers reserve the right to establish additional eligibility requirements, restrictions, or rules for their promotions." },
      { type: "p", text: "Prize & Credit Limitations" },
      { type: "p", text: "Unless expressly stated otherwise in writing:" },
      { type: "ul", items: [
        "Raffle prizes have no cash value",
        "Prizes are non-transferable and non-refundable",
        "Any promotional credits issued are redeemable only within the Reizor platform",
        "Credits may only be used toward eligible participating events or services offered through Reizor",
        "Promotional credits may expire and may be subject to additional restrictions",
      ]},
      { type: "p", text: "Credits cannot be redeemed for cash, cryptocurrency, bank transfers, or external payment methods." },
      { type: "p", text: "Public Announcement of Winners" },
      { type: "p", text: "By participating in a raffle or promotional campaign, participants consent to Reizor and/or event organizers publicly announcing first name, username, social handle, city/state or country, and promotional content related to the win for marketing, advertising, and promotional purposes without additional compensation unless prohibited by applicable law." },
      { type: "p", text: "Fraud, Abuse & Disqualification" },
      { type: "p", text: "Reizor and participating organizers reserve the right to void entries, suspend accounts, disqualify participants, or cancel promotions if fraud, abuse, manipulation, fake accounts, payment disputes, policy violations, or suspicious activity is detected." },
      { type: "p", text: "Legal Compliance" },
      { type: "p", text: "Raffles, sweepstakes, giveaways, and promotional campaigns may not be available in all jurisdictions and may be subject to local laws and regulations. Users are responsible for ensuring participation is lawful in their jurisdiction." },
      { type: "p", text: "Random Winner Selection" },
      { type: "p", text: "Unless otherwise stated for a specific promotion, raffle winners are selected through an automated random selection process. Winners are not manually chosen by Reizor employees, representatives, organizers, or affiliates." },
      { type: "p", text: "Selection results are generated electronically or through automated systems designed to provide random outcomes without human influence, favoritism, or subjective decision-making." },
      { type: "p", text: "Reizor does not guarantee:" },
      { type: "ul", items: [
        "Equal probability across separate promotions",
        "Continuous availability of automated systems",
        "Error-free operation of third-party technologies or software used in the selection process",
      ]},
      { type: "p", text: "In the event of technical errors, fraud, system malfunctions, or unforeseen issues affecting raffle integrity, Reizor reserves the right to suspend, modify, void, or restart the affected promotion at its sole discretion." },
      { type: "p", text: "No Guarantee of Winning from Event Participation" },
      { type: "p", text: "Purchasing a ticket, attending an event, or participating in any event activity does not guarantee that a participant will win, be selected, or receive any raffle prize, giveaway reward, or promotional benefit. Event attendance alone does not constitute eligibility for any promotion unless explicitly stated in the specific promotion's rules." },
    ],
  },
  {
    num: "34",
    title: "Contact Information",
    body: [
      { type: "p", text: "For questions regarding these Terms:" },
      { type: "contact" },
    ],
  },
];

function SectionBody({ body }) {
  return (
    <div className="space-y-3">
      {body.map((block, i) => {
        if (block.type === "p") {
          return (
            <p key={i} className="text-muted-foreground text-sm leading-relaxed">
              {block.text}
            </p>
          );
        }
        if (block.type === "ul") {
          return (
            <ul key={i} className="space-y-1.5 pl-1">
              {block.items.map((item, j) => (
                <li key={j} className="flex items-start gap-2 text-sm text-muted-foreground leading-relaxed">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary/60 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          );
        }
        if (block.type === "contact") {
          return (
            <div key={i} className="p-4 rounded-lg bg-card border border-border/50 space-y-1">
              <p className="font-display font-bold text-sm">Reizor (RZR Music Group LLC)</p>
              <p className="text-sm text-muted-foreground">
                Email:{" "}
                <a href="mailto:reizormusic@gmail.com" className="text-primary hover:underline">
                  reizormusic@gmail.com
                </a>
              </p>
            </div>
          );
        }
        return null;
      })}
    </div>
  );
}

export default function TermsAndConditions() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-16">

        {/* Back button */}
        <button
          onClick={() => window.history.back()}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>
          Back
        </button>

        {/* Header */}
        <div className="mb-10">
          <p className="font-mono text-xs text-primary uppercase tracking-widest mb-3">Legal</p>
          <h1 className="font-display font-black text-4xl sm:text-5xl tracking-tighter mb-2">
            Terms & Conditions
          </h1>
          <p className="text-muted-foreground text-sm font-mono mb-1">Operated by RZR Music Group LLC</p>
          <p className="text-muted-foreground font-mono text-xs">Last updated: April 2026</p>
          <div className="mt-6 h-px bg-border/50" />
        </div>

        {/* Sections */}
        <div className="space-y-8">
          {SECTIONS.map((section) => (
            <div key={section.num} id={`section-${section.num}`} className="scroll-mt-8">
              <div className="flex items-baseline gap-3 mb-3">
                <span className="font-mono text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded shrink-0 leading-5">
                  {section.num}
                </span>
                <h2 className="font-display font-bold text-base sm:text-lg tracking-tight">
                  {section.title}
                </h2>
              </div>
              <div className="pl-9">
                <SectionBody body={section.body} />
              </div>
              <div className="mt-8 h-px bg-border/30" />
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-10 pt-4 text-center">
          <p className="font-mono text-xs text-muted-foreground">
            © 2026 Reizor. All rights reserved.&nbsp;·&nbsp;
            <a href="mailto:reizormusic@gmail.com" className="text-primary hover:underline">
              reizormusic@gmail.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}