import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Mail, Bot, AlertTriangle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import SupportChatbot from "./support/SupportChatbot";

export default function ContactForm() {
  const [tab, setTab] = useState("chat"); // "chat" | "form"
  const [formData, setFormData] = useState({ name: "", email: "", subject: "", message: "" });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const [humanChecked, setHumanChecked] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!humanChecked) {
      setError("Please confirm you are not a robot.");
      return;
    }
    setLoading(true);
    try {
      await base44.functions.invoke("emailService", {
        to: "reizorsocialnetwork@gmail.com",
        subject: `Contact Form: ${formData.subject}`,
        body: `Name: ${formData.name}<br>Email: ${formData.email}<br><br>Message:<br>${formData.message.replace(/\n/g, '<br>')}`,
        replyTo: formData.email,
        _source: "contact-form",
      });
      setSuccess(true);
      setError("");
      setFormData({ name: "", email: "", subject: "", message: "" });
      setHumanChecked(false);
      setTimeout(() => setSuccess(false), 5000);
    } catch (err) {
      setError("Failed to send message. Please email reizorsocialnetwork@gmail.com directly.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="contact-form" className="space-y-6 max-w-7xl mx-auto">
      <div className="text-center">
        <h3 className="font-display font-black text-4xl sm:text-5xl tracking-tight mb-2">SUPPORT</h3>
        <p className="text-muted-foreground">Have questions? We'd love to hear from you.</p>
      </div>

      {/* Tab switcher */}
      <div className="flex max-w-md mx-auto rounded-xl overflow-hidden border border-border/60 p-1 bg-card gap-1">
        <button
          onClick={() => setTab("chat")}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-mono font-bold transition-all ${
            tab === "chat" ? "bg-gradient-to-r from-primary to-accent text-white shadow" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Bot className="w-4 h-4" /> Chat with Bot
        </button>
        <button
          onClick={() => setTab("form")}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-mono font-bold transition-all ${
            tab === "form" ? "bg-gradient-to-r from-primary to-accent text-white shadow" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Mail className="w-4 h-4" /> Send Email
        </button>
      </div>

      {/* Chatbot panel */}
      {tab === "chat" && (
        <div className="max-w-md mx-auto">
          <SupportChatbot inline />
        </div>
      )}

      {/* Contact form panel */}
      {tab === "form" && (
      <form onSubmit={handleSubmit} className="space-y-4 max-w-md mx-auto">
        {success && (
          <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-sm">
            ✓ Message sent successfully!
          </div>
        )}
        {error && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}
        
        <input
          type="text"
          name="name"
          placeholder="Your Name"
          value={formData.name}
          onChange={handleChange}
          required
          className="w-full px-4 py-2 rounded-lg bg-card border border-border text-foreground placeholder-muted-foreground focus:border-primary outline-none transition"
        />
        
        <input
          type="email"
          name="email"
          placeholder="Your Email"
          value={formData.email}
          onChange={handleChange}
          required
          className="w-full px-4 py-2 rounded-lg bg-card border border-border text-foreground placeholder-muted-foreground focus:border-primary outline-none transition"
        />
        
        <input
          type="text"
          name="subject"
          placeholder="Subject"
          value={formData.subject}
          onChange={handleChange}
          required
          className="w-full px-4 py-2 rounded-lg bg-card border border-border text-foreground placeholder-muted-foreground focus:border-primary outline-none transition"
        />
        
        <textarea
          name="message"
          placeholder="Your Message"
          value={formData.message}
          onChange={handleChange}
          required
          rows="5"
          className="w-full px-4 py-2 rounded-lg bg-card border border-border text-foreground placeholder-muted-foreground focus:border-primary outline-none transition resize-none"
        />
        
        {/* Anti-spam checkbox */}
        <label className="flex items-center gap-3 px-4 py-3 rounded-lg bg-card border border-border cursor-pointer select-none hover:border-primary/40 transition-colors">
          <input
            type="checkbox"
            checked={humanChecked}
            onChange={(e) => setHumanChecked(e.target.checked)}
            className="sr-only"
          />
          <div
            className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all ${
              humanChecked ? 'bg-primary border-primary' : 'border-border'
            }`}
          >
            {humanChecked && <span className="text-white text-xs font-bold">✓</span>}
          </div>
          <span className="text-sm text-muted-foreground">I am not a robot</span>
        </label>

        <Button type="submit" className="w-full font-display font-bold" disabled={loading}>
          {loading ? "Sending..." : "Send Message"}
        </Button>
      </form>
      )}


    </div>
  );
}