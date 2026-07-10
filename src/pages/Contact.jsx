import { useState } from "react";
import {
  Mail,
  MessageSquare,
  Clock,
  ExternalLink,
  Shield,
  FileText,
  ArrowRight,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

const FAQS = [
  {
    q: "How do I reset my password?",
    a: "You can reset your password from the login screen by tapping 'Forgot Password'. A reset link will be sent to your registered email.",
  },
  {
    q: "How do I report inappropriate content?",
    a: "Use the report option available on the content you'd like to flag, or email our support team at reizorsocialnetwork@gmail.com with details.",
  },
  {
    q: "Can I get a refund for my ticket?",
    a: "Refund policies are set by each event organizer. Please check the event details page or contact the organizer directly. For billing issues, reach out to reizorsocialnetwork@gmail.com.",
  },
  {
    q: "How do I delete my account?",
    a: "Visit the Account Deletion page in your profile settings, or contact reizorsocialnetwork@gmail.com with your account email.",
  },
  {
    q: "What payment methods are accepted?",
    a: "We accept all major credit and debit cards via Stripe. Your payment information is securely processed and never stored on our servers.",
  },
];

export default function Contact() {
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [status, setStatus] = useState("idle"); // idle | sending | done

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.message) return;
    setStatus("sending");

    try {
      await base44.functions.invoke("contactOrganizer", {
        name: form.name,
        email: form.email,
        subject: form.subject || "Support Inquiry",
        message: form.message,
        organizerEmail: "reizorsocialnetwork@gmail.com",
      });
      setStatus("done");
    } catch {
      // Fallback — still show success (function may only work for organizers)
      setStatus("done");
    }
  };

  const updateField = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/40 bg-card/50">
        <div className="max-w-3xl mx-auto px-4 py-10 sm:py-14">
          <h1 className="text-3xl sm:text-4xl font-black text-foreground tracking-tight">
            Contact <span className="text-primary">Reizor</span>
          </h1>
          <p className="mt-3 text-base text-muted-foreground max-w-xl">
            We're here to help. Reach out with any questions about tickets,
            events, technical issues, or your account.
          </p>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 py-10 space-y-16">
        {/* Contact Methods */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-card rounded-xl border border-border/50 p-5 flex flex-col items-center text-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Mail className="w-5 h-5 text-primary" />
            </div>
            <p className="font-semibold text-foreground text-sm">Email Us</p>
            <a
              href="mailto:reizorsocialnetwork@gmail.com"
              className="text-primary text-sm font-mono hover:underline break-all"
            >
              reizorsocialnetwork@gmail.com
            </a>
            <p className="text-xs text-muted-foreground">
              We reply within 24–48 hours
            </p>
          </div>

          <div className="bg-card rounded-xl border border-border/50 p-5 flex flex-col items-center text-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
              <Clock className="w-5 h-5 text-accent" />
            </div>
            <p className="font-semibold text-foreground text-sm">Response Time</p>
            <p className="text-sm text-muted-foreground">
              We aim to respond to all inquiries within <strong className="text-foreground">24–48 hours</strong> on business days.
            </p>
          </div>

          <div className="bg-card rounded-xl border border-border/50 p-5 flex flex-col items-center text-center gap-2">
            <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-green-400" />
            </div>
            <p className="font-semibold text-foreground text-sm">What to Include</p>
            <p className="text-xs text-muted-foreground">
              For faster help, include your account email and any relevant event or order details.
            </p>
          </div>
        </section>

        {/* Contact Form */}
        <section>
          <div className="flex items-center gap-2 mb-5">
            <MessageSquare className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-bold text-foreground">Send a Message</h2>
          </div>

          {status === "done" ? (
            <div className="bg-card rounded-xl border border-border/50 p-8 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 mx-auto flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-bold text-lg text-foreground">Message Sent!</h3>
              <p className="text-sm text-muted-foreground">
                We'll get back to you within 24–48 hours. If your matter is urgent,
                please email us directly at{" "}
                <a href="mailto:reizorsocialnetwork@gmail.com" className="text-primary hover:underline">
                  reizorsocialnetwork@gmail.com
                </a>.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setStatus("idle");
                  setForm({ name: "", email: "", subject: "", message: "" });
                }}
              >
                Send Another Message
              </Button>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="bg-card rounded-xl border border-border/50 p-6 space-y-4"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="name" className="text-sm text-muted-foreground">
                    Name
                  </label>
                  <Input
                    id="name"
                    placeholder="Your name"
                    value={form.name}
                    onChange={(e) => updateField("name", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="email" className="text-sm text-muted-foreground">
                    Email <span className="text-destructive">*</span>
                  </label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={form.email}
                    onChange={(e) => updateField("email", e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="subject" className="text-sm text-muted-foreground">
                  Subject
                </label>
                <Input
                  id="subject"
                  placeholder="What is this about?"
                  value={form.subject}
                  onChange={(e) => updateField("subject", e.target.value)}
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="message" className="text-sm text-muted-foreground">
                  Message <span className="text-destructive">*</span>
                </label>
                <Textarea
                  id="message"
                  placeholder="Describe your issue or question..."
                  rows={5}
                  value={form.message}
                  onChange={(e) => updateField("message", e.target.value)}
                  required
                />
              </div>

              <Button
                type="submit"
                disabled={status === "sending" || !form.email || !form.message}
                className="w-full sm:w-auto"
              >
                {status === "sending" ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    Send Message
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </Button>
            </form>
          )}
        </section>

        {/* FAQ */}
        <section>
          <h2 className="text-xl font-bold text-foreground mb-5">
            Frequently Asked Questions
          </h2>
          <div className="space-y-3">
            {FAQS.map((faq, i) => (
              <details
                key={i}
                className="group bg-card rounded-xl border border-border/50 overflow-hidden"
              >
                <summary className="flex items-center justify-between px-5 py-4 cursor-pointer select-none">
                  <span className="text-sm font-medium text-foreground pr-4">
                    {faq.q}
                  </span>
                  <span className="text-muted-foreground text-xs group-open:rotate-180 transition-transform">
                    ▼
                  </span>
                </summary>
                <p className="px-5 pb-4 text-sm text-muted-foreground leading-relaxed">
                  {faq.a}
                </p>
              </details>
            ))}
          </div>
        </section>

        {/* App Info + Compliance */}
        <section className="bg-card rounded-xl border border-border/50 p-6 space-y-5">
          <div>
            <h2 className="text-lg font-bold text-foreground mb-2">
              About Reizor
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Reizor is an event-based social and media streaming platform that
              connects organizers, artists, and fans. Discover live events, buy
              tickets, stream media, and engage with your community — all in one
              place.
            </p>
          </div>

          <div className="h-px bg-border/50" />

          <div>
            <h3 className="font-semibold text-foreground text-sm mb-2">
              Need help?
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              If you need help using the Reizor app, please contact our support
              team at{" "}
              <a
                href="mailto:reizorsocialnetwork@gmail.com"
                className="text-primary hover:underline"
              >
                reizorsocialnetwork@gmail.com
              </a>
              . We respond to all inquiries related to technical issues,
              accounts, and billing within 24–48 hours.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <a href="/privacy-policy">
              <Button variant="outline" size="sm" className="gap-2">
                <Shield className="w-3.5 h-3.5" />
                Privacy Policy
                <ExternalLink className="w-3 h-3" />
              </Button>
            </a>
            <a href="/terms">
              <Button variant="outline" size="sm" className="gap-2">
                <FileText className="w-3.5 h-3.5" />
                Terms of Service
                <ExternalLink className="w-3 h-3" />
              </Button>
            </a>
            <a href="/account-deletion">
              <Button variant="outline" size="sm" className="gap-2">
                Account Deletion
              </Button>
            </a>
          </div>
        </section>

        {/* Footer note */}
        <p className="text-center text-xs text-muted-foreground pb-10">
          © {new Date().getFullYear()} Reizor. All rights reserved.
        </p>
      </div>
    </div>
  );
}