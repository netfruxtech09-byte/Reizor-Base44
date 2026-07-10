import { Link } from "react-router-dom";

const TERMS_SECTIONS = [
  {
    num: "1", title: "About Reizor",
    content: `Reizor is a digital ticketing platform that enables users to discover events, purchase tickets, manage digital ticket access, and resell eligible tickets through authorized platform features.\n\nReizor acts solely as a technology and marketplace platform connecting event organizers, venues, artists, promoters, and attendees. Unless explicitly stated otherwise, Reizor is not the organizer, promoter, venue operator, producer, sponsor, or host of any listed event and is not responsible for the execution or operation of events hosted by third parties.`,
  },
  {
    num: "2", title: "Acceptance of Terms",
    content: `By accessing, browsing, registering for, or using Reizor through its website, mobile applications, or related services, you acknowledge that you have read, understood, and agreed to be legally bound by these Terms & Conditions, including any policies referenced herein.\n\nIf you do not agree to these Terms, you must immediately discontinue use of the platform.`,
  },
  {
    num: "3", title: "Eligibility",
    content: `You must be legally capable of entering into a binding agreement in your jurisdiction to use Reizor.\n\nBy using the platform, you represent and warrant that:\n• All information provided by you is true, accurate, current, and complete\n• You will maintain and promptly update your information when necessary\n• Your use of the platform complies with all applicable laws and regulations\n\nReizor reserves the right to refuse access, suspend accounts, or cancel transactions if eligibility requirements are not met.`,
  },
  {
    num: "4", title: "Account Registration & Security",
    content: `Certain platform features require account registration.\n\nYou are solely responsible for:\n• Maintaining the confidentiality and security of your login credentials\n• Restricting access to your account and devices\n• All activity conducted through your account\n\nYou agree to immediately notify Reizor of any unauthorized use, suspected security breach, or account compromise.\n\nReizor may suspend, restrict, terminate, or investigate accounts involved in suspected fraud, abuse, unauthorized resale activity, payment disputes, chargebacks, security violations, or violations of these Terms.`,
  },
  {
    num: "5", title: "Ticket Purchases",
    content: `All ticket purchases made through Reizor are final unless otherwise expressly stated on the applicable event page or required by applicable law.\n\nBefore completing checkout, users will be shown all applicable ticket prices, service fees, processing fees, taxes, and charges.\n\nTickets are delivered digitally and may include:\n• QR codes\n• Mobile entry credentials\n• Dynamic digital ticket technology\n• Other secure authentication methods\n\nEach ticket is valid for one-time entry only and may not be duplicated, copied, transferred, manipulated, or reused beyond authorized platform functionality.\n\nReizor reserves the right to cancel tickets suspected of fraud, duplication, unauthorized resale, misuse, or violation of these Terms.`,
  },
  {
    num: "6", title: "No Refund Policy",
    content: `ALL SALES ARE FINAL.\n\nExcept where required by law or expressly authorized by the event organizer, Reizor does not provide refunds, exchanges, credits, or compensation for:\n• Missed events\n• Failure to attend\n• Personal schedule conflicts\n• Travel issues or transportation delays\n• Illness or personal emergencies\n• Changes in personal circumstances\n• Dissatisfaction with performers, venue, lineup, seating, production quality, or event experience\n• Late arrival or denied entry due to failure to comply with venue or event rules\n\nIf an event is canceled and the organizer authorizes compensation, Reizor may issue either:\n• A refund to the original payment method, or\n• Non-cash platform credit\n\nThe form, amount, timing, and eligibility of compensation are determined solely by the organizer and applicable law.\n\nReizor does not guarantee refunds for postponed, rescheduled, modified, partially completed, interrupted, or lineup-changed events unless specifically authorized by the organizer or required by law.`,
  },
  {
    num: "7", title: "Ticket Resale",
    content: `Certain tickets may be eligible for resale exclusively through authorized Reizor resale functionality and only if permitted by the organizer for that specific event.\n\nTickets resold, transferred, or distributed outside the Reizor platform in violation of organizer rules may:\n• Be voided\n• Be denied entry\n• Lose eligibility for support, credit, or protection\n\nReizor reserves the right to:\n• Restrict resale eligibility\n• Limit resale pricing\n• Set resale windows\n• Cap resale quantities\n• Disable resale for specific events or users\n• Review and cancel suspicious resale activity\n\nSuccessful resale is never guaranteed.`,
  },
  {
    num: "8", title: "Credit Policy",
    content: `For certain eligible events, if a user is unable to successfully resell a ticket before the applicable cutoff time, Reizor or the organizer may, at their sole discretion, issue non-cash platform credit subject to event-specific rules and eligibility requirements.\n\nAny issued credit:\n• Has no cash value\n• Is non-refundable and non-transferable\n• May only be used for eligible future events\n• May be restricted to events from the same organizer\n• May exclude fees and taxes unless otherwise stated\n• May expire after the applicable validity period\n• May be revoked in cases of fraud, abuse, chargebacks, or policy violations\n\nCredit issuance is not guaranteed and may vary by organizer, event, or promotion.`,
  },
  {
    num: "9", title: "Credit Forfeiture",
    content: `If a user uses Reizor-issued credit to purchase another ticket and:\n• Does not attend the replacement event\n• Does not successfully resell the replacement ticket\n• Violates platform or organizer rules\n• Fails to use the credited ticket for any reason\n\nthen the user forfeits both:\n• The issued credit, and\n• The replacement ticket\n\nNo additional refund, replacement credit, rollover balance, exchange, or compensation will be provided.`,
  },
  {
    num: "10", title: "Ticket Validity & Digital Entry",
    content: `Each ticket contains a unique digital authentication credential and may only be scanned or redeemed once.\n\nDuplicate, copied, altered, fraudulent, unauthorized, manipulated, or tampered tickets are void.\n\nReizor and event organizers reserve the right to:\n• Deny entry\n• Cancel tickets\n• Block transfers\n• Suspend accounts\n\nwithout refund, credit, or compensation where fraud or misuse is suspected.`,
  },
  {
    num: "11", title: "Event Responsibility",
    content: `Each event organizer is solely responsible for:\n• Event production and operation\n• Venue access and capacity\n• Artist lineup and appearances\n• Event scheduling\n• Security and safety measures\n• Licensing and legal compliance\n• Staffing and crowd management\n• Event postponements, modifications, interruptions, or cancellations\n\nReizor does not control or guarantee:\n• Event quality\n• Artist attendance\n• Venue conditions\n• Sound, lighting, production, or technical performance\n• Event timing or duration\n• Admission availability\n• Overall attendee experience`,
  },
  {
    num: "12", title: "Prohibited Conduct",
    content: `Users may not:\n• Use bots, scripts, automation tools, or unauthorized software\n• Circumvent ticket purchase limits\n• Resell tickets outside authorized channels\n• Copy, forge, duplicate, manipulate, or alter tickets\n• Engage in fraudulent chargebacks or payment abuse\n• Interfere with platform operations, servers, or security systems\n• Access accounts without authorization\n• Use Reizor for unlawful purposes\n\nViolations may result in:\n• Ticket cancellation\n• Loss of credits or balances\n• Account suspension or permanent termination\n• IP/device blocking\n• Legal action or law enforcement referral`,
  },
  {
    num: "13", title: "Fees & Payments",
    content: `Reizor may charge:\n• Service fees\n• Platform fees\n• Processing fees\n• Resale fees\n• Other disclosed charges\n\nAll applicable fees will be displayed prior to purchase confirmation.\n\nPayments are processed through third-party payment providers. Reizor is not responsible for:\n• Banking delays\n• Processor outages\n• Transaction failures\n• Currency conversion issues\n• Payment provider errors\n• Unauthorized financial institution holds\n\nUsers are responsible for ensuring valid payment methods and sufficient available funds.`,
  },
  {
    num: "14", title: "Disclaimer of Warranties",
    content: `Reizor provides the platform and services on an "AS IS" and "AS AVAILABLE" basis.\n\nTo the maximum extent permitted by law, Reizor disclaims all warranties, express or implied, including:\n• Merchantability\n• Fitness for a particular purpose\n• Non-infringement\n• Availability\n• Accuracy\n• Reliability\n• Security\n• Continuous or error-free operation\n\nReizor does not warrant that the platform will be uninterrupted, secure, virus-free, or free of technical issues.`,
  },
  {
    num: "15", title: "Limitation of Liability",
    content: `To the fullest extent permitted by law, Reizor and its affiliates, officers, directors, employees, contractors, partners, and licensors shall not be liable for any:\n• Indirect damages\n• Incidental damages\n• Consequential damages\n• Special damages\n• Punitive damages\n• Loss of profits\n• Loss of opportunity\n• Loss of attendance\n• Travel or accommodation costs\n• Event-related losses\n• Data loss\n• Business interruption\n\narising out of or related to:\n• Use of the platform\n• Ticket purchases\n• Event cancellations or modifications\n• Organizer actions\n• Unauthorized account activity\n• Platform outages or technical failures\n\nIn all cases, Reizor's total liability shall not exceed the total amount paid by the user for the specific transaction giving rise to the claim.`,
  },
  {
    num: "16", title: "Governing Law & Jurisdiction",
    content: `These Terms & Conditions shall be governed by and interpreted in accordance with the laws of the State of New York, without regard to conflict of law principles.\n\nAny dispute, claim, or legal proceeding arising out of or relating to Reizor or these Terms shall be brought exclusively in the state or federal courts located in New York County, New York.\n\nBy using Reizor, you consent to the exclusive jurisdiction and venue of such courts.`,
  },
];

const POLICY_SECTIONS = [
  {
    title: "All Sales Are Final",
    content: `All ticket purchases made through Reizor are final.\n\nExcept where required by applicable law or expressly authorized by the event organizer, Reizor does not provide refunds, exchanges, or compensation for:\n• Change of personal plans\n• Failure to attend an event\n• Late arrival\n• Travel or transportation issues\n• Illness or emergencies\n• Dissatisfaction with the event, venue, lineup, performers, or experience\n• Any other personal circumstance preventing attendance`,
  },
  {
    title: "Ticket Resale",
    content: `Ticket resale may only occur through authorized Reizor resale functionality and only for events where resale has been enabled by the organizer.\n\nResale eligibility, pricing limits, resale windows, transferability, and resale availability may vary by organizer and event.\n\nTickets sold, transferred, or distributed outside authorized Reizor channels may:\n• Be invalidated\n• Be denied entry\n• Lose eligibility for credit or support\n\nReizor reserves the right to restrict, suspend, deny, or cancel resale activity suspected of fraud, abuse, manipulation, or violation of platform policies.\n\nSuccessful resale is never guaranteed.`,
  },
  {
    title: "If You Cannot Attend",
    content: `If you are unable to attend an event, you may attempt to resell your eligible ticket through the Reizor platform before the resale deadline.\n\nReizor does not guarantee:\n• That a ticket will successfully resell\n• Resale demand or buyer availability\n• Specific resale timing\n• Full or partial recovery of the original purchase amount\n\nUsers remain fully responsible for unused tickets that are not successfully resold.`,
  },
  {
    title: "Credit for Eligible Unsold Tickets",
    content: `For certain eligible events, if a ticket does not successfully resell before the resale cutoff time, Reizor or the organizer may, at their sole discretion and subject to applicable law, issue non-cash account credit.\n\nAny approved credit:\n• Is issued only to the original purchaser's Reizor account\n• Has no cash value\n• Is non-transferable\n• Is non-refundable\n• May exclude fees, taxes, or additional charges\n• May only be used for eligible future events from the same organizer\n• May expire after the stated validity period\n• May be revoked in cases of fraud, abuse, chargebacks, or policy violations\n\nCredit issuance is not guaranteed and may vary by event, organizer, promotion, or account standing.`,
  },
  {
    title: "Credit Use",
    content: `Any ticket purchased using Reizor-issued credit is considered a final sale.\n\nUsers are solely responsible for:\n• Attending the replacement event\n• Managing replacement tickets\n• Reselling eligible replacement tickets before the applicable deadline\n\nCredit cannot be converted to cash, refunded, or reissued except where required by law.`,
  },
  {
    title: "Credit Forfeiture",
    content: `If a user uses Reizor-issued credit to purchase another ticket and:\n• Does not attend the replacement event,\n• Does not successfully resell the replacement ticket before the applicable deadline, or\n• Otherwise fails to use the replacement ticket,\n\nthen both the replacement ticket and the previously issued credit will be permanently forfeited.\n\nNo additional refund, replacement credit, rollover balance, exchange, or compensation will be issued.`,
  },
  {
    title: "One-Time Credit Use",
    content: `Unless expressly stated otherwise by Reizor, issued credit may only be used one time.\n\nUnused, expired, canceled, revoked, or forfeited credit will not be reinstated, refunded, replaced, or extended.`,
  },
  {
    title: "Event Cancellation & Changes",
    content: `If an event is canceled and the organizer authorizes compensation, the organizer may choose to provide:\n• A refund,\n• Account credit,\n• A replacement ticket,\n• Access to a rescheduled event, or\n• Another form of compensation permitted by applicable law\n\nReizor may assist with processing authorized compensation; however, final decisions regarding refunds, credits, replacements, postponements, and event-related remedies are determined by the organizer and applicable law.\n\nReizor does not guarantee refunds or compensation for postponed, rescheduled, interrupted, partially completed, or modified events unless required by law or authorized by the organizer.`,
  },
  {
    title: "Digital Tickets & QR Entry",
    content: `All tickets issued through Reizor are delivered digitally and may include QR codes, dynamic ticket technology, or other digital authentication methods.\n\nEach ticket is valid for one-time entry only.\n\nTickets may be rejected, voided, or canceled without refund or credit if they are:\n• Previously scanned\n• Duplicated\n• Copied\n• Altered or manipulated\n• Fraudulently obtained\n• Purchased through unauthorized channels\n• Used in violation of organizer or platform rules`,
  },
  {
    title: "Fraud, Abuse & Platform Protection",
    content: `Reizor reserves the right to deny resale access, deny credit eligibility, suspend payouts, cancel tickets, restrict accounts, or permanently ban users involved in:\n• Fraudulent activity\n• Suspicious transactions\n• Automated purchasing or bots\n• Chargeback abuse\n• Manipulation of resale systems\n• Repeated event no-shows\n• Violations of platform policies or organizer rules\n\nReizor may investigate accounts and transactions to protect the integrity, security, and fairness of the platform.`,
  },
  {
    title: "Organizer Responsibility",
    content: `Event organizers are solely responsible for:\n• Event production and execution\n• Venue operations and compliance\n• Event safety and staffing\n• Accurate event listings and information\n• Artist appearances and scheduling\n• Honoring valid tickets\n• Compliance with applicable laws, permits, and regulations\n\nReizor may remove events, suspend organizer access, hold or delay payouts, cancel listings, or take other protective actions where fraud, disputes, legal risk, policy violations, or security concerns are suspected.`,
  },
  {
    title: "Final Decisions",
    content: `To the maximum extent permitted by applicable law, Reizor reserves the right to make final decisions regarding:\n• Ticket validity\n• Resale eligibility\n• Credit eligibility\n• Credit forfeiture\n• Refund requests\n• Fraud investigations\n• Suspicious activity\n• Policy enforcement\n• Platform misuse`,
  },
  {
    title: "Contact",
    content: `For support or policy-related questions:\n\nSupport: support@reizor.com`,
  },
];

function ScrollBox({ label, tag, children }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-primary bg-primary/10 px-2 py-1 rounded">
          {tag}
        </span>
        <h2 className="font-display font-bold text-xl tracking-tight">{label}</h2>
      </div>
      <div className="h-72 overflow-y-auto rounded-xl border border-border/60 bg-card/60 p-5 space-y-5 text-sm text-muted-foreground leading-relaxed scrollbar-thin">
        {children}
      </div>
    </div>
  );
}

export default function Policy() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-16 space-y-14">
        {/* Header */}
         <div>
           <p className="font-mono text-xs text-primary uppercase tracking-widest mb-3">Legal</p>
           <h1 className="font-display font-black text-4xl sm:text-5xl tracking-tighter mb-2">
             Policies
           </h1>
           <p className="text-muted-foreground font-mono text-sm">Last updated: March 2026</p>
           <div className="mt-6 p-4 rounded-lg bg-primary/10 border border-primary/30 mb-6">
             <p className="text-sm text-muted-foreground">
               <strong>Refund Policy:</strong> Please see the{" "}
               <Link to="/terms#section-6" className="text-primary font-semibold hover:underline">
                 Refund Policy section in our Terms of Service
               </Link>
               {" "}for complete refund policy information.
             </p>
           </div>
           <div className="h-px bg-border/50" />
         </div>

        {/* Terms & Conditions scroll box */}
        <ScrollBox label="Terms & Conditions" tag="01">
          {TERMS_SECTIONS.map((s) => (
            <div key={s.num} className="pb-4 border-b border-border/30 last:border-0 last:pb-0">
              <p className="font-display font-bold text-foreground text-sm mb-2">
                {s.num}. {s.title}
              </p>
              {s.content.split("\n\n").map((block, i) => {
                const lines = block.split("\n");
                const isBulletBlock = lines.some(l => l.startsWith("•"));
                if (isBulletBlock) {
                  return (
                    <ul key={i} className="mb-2 space-y-0.5 pl-1">
                      {lines.map((line, j) =>
                        line.startsWith("•") ? (
                          <li key={j} className="flex items-start gap-1.5">
                            <span className="text-primary mt-0.5 shrink-0">•</span>
                            <span>{line.slice(1).trim()}</span>
                          </li>
                        ) : (
                          line.trim() && <p key={j} className="mb-1">{line}</p>
                        )
                      )}
                    </ul>
                  );
                }
                return <p key={i} className="mb-2 last:mb-0">{block}</p>;
              })}
            </div>
          ))}
        </ScrollBox>

        {/* Refund Policy scroll box */}
        <ScrollBox label="Ticketing, Resale & Credit Policy" tag="02">
          {POLICY_SECTIONS.map((s, idx) => (
            <div key={idx} className="pb-4 border-b border-border/30 last:border-0 last:pb-0">
              <p className="font-display font-bold text-foreground text-sm mb-2">{s.title}</p>
              {s.content.split("\n\n").map((block, i) => {
                const lines = block.split("\n");
                const isBulletBlock = lines.some(l => l.startsWith("•"));
                if (isBulletBlock) {
                  return (
                    <ul key={i} className="mb-2 space-y-0.5 pl-1">
                      {lines.map((line, j) =>
                        line.startsWith("•") ? (
                          <li key={j} className="flex items-start gap-1.5">
                            <span className="text-primary mt-0.5 shrink-0">•</span>
                            <span>{line.slice(1).trim()}</span>
                          </li>
                        ) : (
                          line.trim() && <p key={j} className="mb-1">{line}</p>
                        )
                      )}
                    </ul>
                  );
                }
                return <p key={i} className="mb-2 last:mb-0">{block}</p>;
              })}
            </div>
          ))}
        </ScrollBox>

        {/* Footer note */}
        <div className="pt-8 border-t border-border/50 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="font-mono text-xs text-muted-foreground">
            © 2026 Reizor. All rights reserved.
          </p>
          <Link to="/" className="font-mono text-xs text-primary hover:underline">
            ← Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}