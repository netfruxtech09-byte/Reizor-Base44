import { useState, useRef, useEffect } from "react";
import { X, Send, MessageCircle, ChevronDown, RotateCcw } from "lucide-react";
import { Link } from "react-router-dom";
import { detectIsIOS } from "@/hooks/useIsIOS";

const BOT_NAME = "Reizor Support";

// ── Knowledge base ──────────────────────────────────────────
const KB = [
  {
    keywords: ["ticket", "buy", "purchase", "checkout", "order", "buying"],
    answer: "To purchase tickets, find your event on our **Events** page and click **Buy Now**. Select your ticket type and quantity, then complete checkout with your card. Your QR ticket will be emailed and saved under **My Tickets**.",
    links: [{ label: "Browse Events", to: "/search" }, { label: "My Tickets", to: "/my-tickets" }],
  },
  {
    keywords: ["refund", "cancel", "money back", "return"],
    answer: "All sales are final per our refund policy. However, if an event is **cancelled by the organizer**, a refund or credit may be issued. You can also try reselling your ticket on our Resale Market before the event.",
    links: [{ label: "Refund Policy", to: "/terms#section-6" }, { label: "Resale Market", to: "/resale" }],
  },
  {
    keywords: ["resale", "resell", "sell ticket", "secondary", "marketplace"],
    answer: "You can list your ticket for resale on our **Resale Marketplace** (if the organizer has enabled resale for that event). Go to **My Tickets**, find your ticket, and tap **Resell**.",
    links: [{ label: "Resale Marketplace", to: "/resale-marketplace" }, { label: "My Tickets", to: "/my-tickets" }],
  },
  {
    keywords: ["login", "sign in", "account", "password", "register", "signup", "access"],
    answer: "If you're having trouble logging in, try refreshing the page and using your registered email. If you've forgotten your password, use the **Forgot Password** link on the login screen. For account issues, contact support@reizor.com.",
    links: [],
  },
  {
    keywords: ["event", "find event", "discover", "search", "upcoming"],
    answer: "You can browse and discover upcoming events on our **Discover** and **Search** pages. Filter by genre, city, or date to find exactly what you're looking for!",
    links: [{ label: "Discover Events", to: "/discover" }, { label: "Search", to: "/search" }],
  },
  {
    keywords: ["payment", "card", "stripe", "charge", "fee", "cost", "price"],
    answer: "We accept all major credit/debit cards via **Stripe** (a secure payment processor). Prices shown at checkout include all service fees and taxes. Your card is charged only once and you'll get an email confirmation.",
    links: [{ label: "Browse Events", to: "/search" }],
  },
  {
    keywords: ["artist", "artist profile", "book artist", "lineup", "performer"],
    answer: "You can explore artist profiles, see their tour schedules, and even book them for your event! Head to the **Artists** page to browse. Artists can sign up for their own studio profile.",
    links: [{ label: "Artists", to: "/artists" }, { label: "Artist Signup", to: "/artist/signup" }],
  },
  {
    keywords: ["organizer", "host event", "create event", "list event", "organise"],
    answer: "Want to host an event? Any user can become an organizer. Click **Host an Event** in the footer or go to your **Organizer Dashboard** to create and manage events, sell tickets, and track analytics.",
    links: [{ label: "Organizer Dashboard", to: "/organizer" }],
  },
  {
    keywords: ["qr", "scan", "entry", "door", "check in", "venue"],
    answer: "Your QR ticket is in **My Tickets**. Show it at the venue for scanning. Each QR code is valid for one-time entry only. Make sure your screen brightness is turned up!",
    links: [{ label: "My Tickets", to: "/my-tickets" }],
  },
  {
    keywords: ["community", "feed", "post", "share", "social"],
    answer: "Join our **Community Feed** to share moments, connect with fans, and stay in the loop with events. You can post photos, share event links, and follow artists.",
    links: [{ label: "Community", to: "/community" }],
  },
  {
    keywords: ["affiliate", "earn", "commission", "referral", "promo code"],
    answer: "Earn money by promoting Reizor events! Join our **Affiliate Program** to get unique tracking links and earn commissions on every ticket sold through your link.",
    links: [{ label: "Affiliate Program", to: "/affiliate-program" }],
    iosHidden: true,
  },
  {
    keywords: ["loyalty", "reward", "points", "tier", "cashback"],
    answer: "Some organizers offer **Loyalty Programs** where you earn rewards for attending their events. Check an organizer's public profile to see if they have a loyalty tier system set up for their fans.",
    links: [{ label: "Discover Events", to: "/discover" }],
  },
  {
    keywords: ["terms", "policy", "legal", "rules", "tos"],
    answer: "You can read our full Terms of Service, Refund Policy, and Privacy Policy in the links below.",
    links: [{ label: "Terms of Service", to: "/terms" }, { label: "Privacy Policy", to: "/privacy-policy" }, { label: "Policies", to: "/policy" }],
  },
  {
    keywords: ["delete account", "remove account", "close account"],
    answer: "To request account deletion, please contact our support team at **support@reizor.com** with your registered email address and we'll process it within 5 business days.",
    links: [],
  },
];

const STORAGE_KEY = "reizor_chat_history";
const GREETING = {
  role: "bot",
  text: "👋 Hi! I'm the Reizor support bot. How can I help you today? You can ask me about tickets, refunds, events, accounts, or anything else!",
  links: [],
};

function loadMessages() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return [GREETING];
}

function saveMessages(msgs) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(msgs)); } catch {}
}

const QUICK_REPLIES = [
  "How do I buy tickets?",
  "Refund policy",
  "Resell my ticket",
  "Login issues",
  "Payment questions",
  "Host an event",
];

function getBotReply(text) {
  const lower = text.toLowerCase();
  const kb = detectIsIOS() ? KB.filter(e => !e.iosHidden) : KB;
  for (const entry of kb) {
    if (entry.keywords.some(k => lower.includes(k))) {
      return { text: entry.answer, links: entry.links };
    }
  }
  return {
    text: "I'm not sure about that one. Please contact our support team at **support@reizor.com** and we'll help you shortly! You can also use the contact form below.",
    links: [],
  };
}

function MessageBubble({ msg }) {
  const isBot = msg.role === "bot";
  // Parse **bold** markdown
  const renderText = (text) =>
    text.split(/(\*\*[^*]+\*\*)/).map((part, i) =>
      part.startsWith("**") && part.endsWith("**")
        ? <strong key={i} className="text-foreground font-semibold">{part.slice(2, -2)}</strong>
        : part
    );

  return (
    <div className={`flex ${isBot ? "justify-start" : "justify-end"} mb-3`}>
      {isBot && (
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shrink-0 mr-2 mt-0.5 text-xs font-bold text-white">R</div>
      )}
      <div className={`max-w-[82%] ${isBot ? "" : ""}`}>
        <div className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
          isBot
            ? "bg-card border border-border/60 text-muted-foreground rounded-tl-sm"
            : "bg-gradient-to-br from-primary to-accent text-white rounded-tr-sm"
        }`}>
          {renderText(msg.text)}
        </div>
        {isBot && msg.links?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {msg.links.map((l, i) => (
              <Link key={i} to={l.to}
                className="text-[11px] font-mono font-bold text-accent border border-accent/30 bg-accent/10 px-2 py-0.5 rounded-full hover:bg-accent/20 transition-colors"
              >
                {l.label} →
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function SupportChatbot({ inline = false, onClose }) {
  const [messages, setMessages] = useState(() => loadMessages());
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [showQuick, setShowQuick] = useState(() => {
    const saved = loadMessages();
    return saved.length <= 1;
  });
  const msgContainerRef = useRef(null);
  const isFirstRender = useRef(true);
  const [userScrolledUp, setUserScrolledUp] = useState(false);
  const lastMsgCount = useRef(messages.length);

  // Track whether user has manually scrolled up
  const handleScroll = () => {
    const el = msgContainerRef.current;
    if (!el) return;
    const threshold = 100; // px from bottom
    setUserScrolledUp(el.scrollHeight - el.scrollTop - el.clientHeight > threshold);
  };

  // Auto-scroll only when user is near bottom or sent a new message
  useEffect(() => {
    const el = msgContainerRef.current;
    if (!el) return;
    const isNewMsg = messages.length > lastMsgCount.current;
    lastMsgCount.current = messages.length;
    // Don't scroll on initial mount with greeting
    if (isFirstRender.current) {
      isFirstRender.current = false;
      // Still scroll to bottom on first render (e.g. restored history)
      el.scrollTop = el.scrollHeight;
      return;
    }
    // Only auto-scroll if user is near bottom OR a new message just arrived
    if (isNewMsg || !userScrolledUp) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, typing, userScrolledUp]);

  // Persist messages to localStorage whenever they change
  useEffect(() => {
    saveMessages(messages);
  }, [messages]);

  const sendMessage = (text) => {
    if (!text.trim()) return;
    setShowQuick(false);
    setMessages(prev => [...prev, { role: "user", text }]);
    setInput("");
    setTyping(true);
    setTimeout(() => {
      const reply = getBotReply(text);
      setMessages(prev => [...prev, { role: "bot", ...reply }]);
      setTyping(false);
    }, 700);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    sendMessage(input);
  };

  const reset = () => {
    const fresh = [GREETING];
    setMessages(fresh);
    saveMessages(fresh);
    setShowQuick(true);
    setInput("");
  };

  const containerClass = inline
    ? "flex flex-col bg-card border border-border/60 rounded-2xl overflow-hidden"
    : "flex flex-col bg-background border border-border/60 rounded-2xl overflow-hidden shadow-2xl shadow-black/40";

  return (
    <div className={containerClass} style={{ height: inline ? 420 : "100%" }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-primary/20 via-accent/10 to-primary/5 border-b border-border/50 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold text-sm">R</div>
          <div>
            <p className="font-display font-bold text-sm">{BOT_NAME}</p>
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-[10px] text-muted-foreground font-mono">Online</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={reset} className="p-1.5 rounded-full hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground" title="Reset chat">
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          {onClose && (
            <button onClick={onClose} className="p-1.5 rounded-full hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div
        ref={msgContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 pt-4 pb-2 space-y-1 min-h-0 relative"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {messages.map((msg, i) => <MessageBubble key={i} msg={msg} />)}

        {/* Typing indicator */}
        {typing && (
          <div className="flex justify-start mb-3">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center shrink-0 mr-2 mt-0.5 text-xs font-bold text-white">R</div>
            <div className="px-3.5 py-2.5 rounded-2xl rounded-tl-sm bg-card border border-border/60">
              <div className="flex gap-1 items-center h-4">
                {[0, 1, 2].map(i => (
                  <span key={i} className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Quick replies */}
        {showQuick && !typing && (
          <div className="flex flex-wrap gap-1.5 pb-1 pt-1">
            {QUICK_REPLIES.map((q, i) => (
              <button key={i} onClick={() => sendMessage(q)}
                className="text-[11px] font-mono border border-primary/30 bg-primary/10 text-primary px-2.5 py-1 rounded-full hover:bg-primary/20 transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        )}

        {/* Jump to latest */}
        {userScrolledUp && (
          <button
            onClick={() => {
              const el = msgContainerRef.current;
              if (el) { el.scrollTop = el.scrollHeight; setUserScrolledUp(false); }
            }}
            className="sticky bottom-0 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card border border-border shadow-lg text-[11px] font-mono text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all"
          >
            <ChevronDown className="w-3 h-3" /> Jump to latest
          </button>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex items-center gap-2 px-3 py-3 border-t border-border/50 bg-card/50 shrink-0">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Ask a question..."
          className="flex-1 bg-background border border-border/60 rounded-xl px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:border-primary outline-none transition"
        />
        <button
          type="submit"
          disabled={!input.trim() || typing}
          className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shrink-0 disabled:opacity-40 transition-opacity hover:opacity-90"
        >
          <Send className="w-4 h-4 text-white" />
        </button>
      </form>
    </div>
  );
}