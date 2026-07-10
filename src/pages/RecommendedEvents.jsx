import { useState, useEffect } from "react";
import { Lightbulb, Send, MapPin, Calendar, Mail, Link as LinkIcon, CheckCircle2, Clock, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { base44 } from "@/api/base44Client";
import { format } from "date-fns";
import { toast } from "sonner";
import PageMeta from "@/components/seo/PageMeta";

export default function RecommendedEvents() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recommendations, setRecommendations] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    event_name: "",
    event_date: "",
    venue_name: "",
    city: "",
    country: "",
    genre: "",
    organizer_name: "",
    organizer_email: "",
    organizer_phone: "",
    organizer_website: "",
    event_url: "",
    description: "",
    why_recommend: "",
  });

  useEffect(() => {
    const loadData = async () => {
      const currentUser = await base44.auth.me().catch(() => null);
      setUser(currentUser);

      if (currentUser) {
        const recs = await base44.entities.EventRecommendation.filter(
          { recommended_by_email: currentUser.email },
          "-created_date",
          100
        );
        setRecommendations(recs);
      }

      setLoading(false);
    };

    loadData();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!user) {
      base44.auth.redirectToLogin();
      return;
    }

    if (!form.event_name || !form.event_date || !form.venue_name || !form.city || !form.organizer_email) {
      toast.error("Please fill in all required fields");
      return;
    }

    setSubmitting(true);

    try {
      const recommendation = await base44.entities.EventRecommendation.create({
        ...form,
        recommended_by_email: user.email,
        recommended_by_name: user.full_name,
        status: "pending",
      });

      setRecommendations(prev => [recommendation, ...prev]);
      setForm({
        event_name: "",
        event_date: "",
        venue_name: "",
        city: "",
        country: "",
        genre: "",
        organizer_name: "",
        organizer_email: "",
        organizer_phone: "",
        organizer_website: "",
        event_url: "",
        description: "",
        why_recommend: "",
      });
      setShowForm(false);

      // Send admin notification
      await base44.integrations.Core.SendEmail({
        to: "support@reizor.com",
        subject: `📌 New Event Recommendation: ${form.event_name}`,
        body: `A user has recommended an event for listing on Reizor.\n\nEvent: ${form.event_name}\nDate: ${form.event_date}\nVenue: ${form.venue_name}, ${form.city}\nOrganizer: ${form.organizer_name} (${form.organizer_email})\n\nVisit admin dashboard to send outreach.`,
      }).catch(() => {});

      toast.success("Event recommended! Reizor will reach out to the organizer.");
    } catch (error) {
      toast.error(error.message || "Failed to submit recommendation");
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "listed":
        return <CheckCircle2 className="w-4 h-4 text-green-400" />;
      case "declined":
        return <XCircle className="w-4 h-4 text-destructive" />;
      case "pending":
      case "outreach_sent":
      case "organizer_contacted":
        return <Clock className="w-4 h-4 text-yellow-400" />;
      default:
        return null;
    }
  };

  const getStatusLabel = (status) => {
    const labels = {
      pending: "Pending Review",
      outreach_sent: "Outreach Sent",
      organizer_contacted: "In Discussions",
      listed: "Listed on Reizor",
      declined: "Organizer Declined",
      expired: "Event Expired",
    };
    return labels[status] || status;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen space-y-6 p-4 sm:p-6 max-w-4xl mx-auto">
      <PageMeta
        title="Recommend an Event — REIZOR"
        description="Know an event worth listing on Reizor? Recommend it and we'll reach out to the organizer to bring their event to the platform."
        canonical="https://reizor.com/recommend"
      />
      <div>
        <h1 className="font-display font-black text-4xl tracking-tight">RECOMMEND AN EVENT</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Help us discover new events & bring them to Reizor's platform
        </p>
      </div>

      {/* CTA Section */}
      {!showForm && (
        <div className="p-6 rounded-xl bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/30 text-center space-y-4">
          <Lightbulb className="w-8 h-8 text-primary mx-auto" />
          <div>
            <h2 className="font-display font-bold text-lg">Know An Event Worth Listing?</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Submit a recommendation and Reizor will contact the organizer to list tickets
            </p>
          </div>
          <Button onClick={() => setShowForm(true)} className="glow-lime font-display font-bold gap-2 mx-auto">
            <Send className="w-4 h-4" /> Recommend Event
          </Button>
        </div>
      )}

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="p-6 rounded-xl bg-card border border-border/50 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Event Name *</label>
              <Input
                required
                value={form.event_name}
                onChange={e => setForm(f => ({ ...f, event_name: e.target.value }))}
                placeholder="e.g., Ultra Music Festival"
                className="mt-1 bg-secondary border-border/50"
              />
            </div>
            <div>
              <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Date *</label>
              <Input
                required
                type="datetime-local"
                value={form.event_date}
                onChange={e => setForm(f => ({ ...f, event_date: e.target.value }))}
                className="mt-1 bg-secondary border-border/50"
              />
            </div>
            <div>
              <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Venue *</label>
              <Input
                required
                value={form.venue_name}
                onChange={e => setForm(f => ({ ...f, venue_name: e.target.value }))}
                placeholder="Venue name"
                className="mt-1 bg-secondary border-border/50"
              />
            </div>
            <div>
              <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">City *</label>
              <Input
                required
                value={form.city}
                onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                placeholder="New York"
                className="mt-1 bg-secondary border-border/50"
              />
            </div>
            <div>
              <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Country</label>
              <Input
                value={form.country}
                onChange={e => setForm(f => ({ ...f, country: e.target.value }))}
                placeholder="USA"
                className="mt-1 bg-secondary border-border/50"
              />
            </div>
            <div>
              <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Genre</label>
              <Input
                value={form.genre}
                onChange={e => setForm(f => ({ ...f, genre: e.target.value }))}
                placeholder="House, Techno, etc."
                className="mt-1 bg-secondary border-border/50"
              />
            </div>
          </div>

          <div className="border-t border-border/30 pt-4">
            <h3 className="font-display font-bold mb-3">Organizer Details *</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Name</label>
                <Input
                  value={form.organizer_name}
                  onChange={e => setForm(f => ({ ...f, organizer_name: e.target.value }))}
                  placeholder="Organizer name"
                  className="mt-1 bg-secondary border-border/50"
                />
              </div>
              <div>
                <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Email *</label>
                <Input
                  required
                  type="email"
                  value={form.organizer_email}
                  onChange={e => setForm(f => ({ ...f, organizer_email: e.target.value }))}
                  placeholder="organizer@example.com"
                  className="mt-1 bg-secondary border-border/50"
                />
              </div>
              <div>
                <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Phone</label>
                <Input
                  value={form.organizer_phone}
                  onChange={e => setForm(f => ({ ...f, organizer_phone: e.target.value }))}
                  placeholder="+1-555-0000"
                  className="mt-1 bg-secondary border-border/50"
                />
              </div>
              <div>
                <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Website</label>
                <Input
                  value={form.organizer_website}
                  onChange={e => setForm(f => ({ ...f, organizer_website: e.target.value }))}
                  placeholder="https://example.com"
                  className="mt-1 bg-secondary border-border/50"
                />
              </div>
            </div>
          </div>

          <div className="border-t border-border/30 pt-4">
            <h3 className="font-display font-bold mb-3">Additional Info</h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Event URL</label>
                <Input
                  value={form.event_url}
                  onChange={e => setForm(f => ({ ...f, event_url: e.target.value }))}
                  placeholder="https://example.com/event"
                  className="mt-1 bg-secondary border-border/50"
                />
              </div>
              <div>
                <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Description</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Tell us about the event..."
                  rows={3}
                  className="mt-1 w-full rounded-md bg-secondary border border-border/50 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Why Recommend?</label>
                <textarea
                  value={form.why_recommend}
                  onChange={e => setForm(f => ({ ...f, why_recommend: e.target.value }))}
                  placeholder="Why should Reizor list this event?"
                  rows={2}
                  className="mt-1 w-full rounded-md bg-secondary border border-border/50 px-3 py-2 text-sm"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              type="submit"
              disabled={submitting}
              className="flex-1 glow-lime font-display font-bold gap-1.5"
            >
              <Send className="w-4 h-4" /> {submitting ? "Submitting..." : "Submit Recommendation"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {/* User's Recommendations */}
      {recommendations.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-display font-bold text-lg">YOUR RECOMMENDATIONS</h2>
          <div className="grid gap-3">
            {recommendations.map(rec => (
              <div key={rec.id} className="p-4 rounded-lg bg-card border border-border/50 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-display font-bold text-lg">{rec.event_name}</p>
                    <div className="flex flex-wrap gap-2 mt-2 text-xs text-muted-foreground font-mono">
                      {rec.event_date && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> {format(new Date(rec.event_date), "MMM dd, yyyy")}
                        </span>
                      )}
                      {rec.venue_name && (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {rec.venue_name}, {rec.city}
                        </span>
                      )}
                      {rec.organizer_email && (
                        <span className="flex items-center gap-1">
                          <Mail className="w-3 h-3" /> {rec.organizer_email}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1.5 justify-end mb-2">
                      {getStatusIcon(rec.status)}
                      <span className="text-xs font-mono font-bold uppercase tracking-wider">
                        {getStatusLabel(rec.status)}
                      </span>
                    </div>
                    {rec.created_event_id && (
                      <a href={`/events/${rec.created_event_id}`} className="text-[10px] text-primary hover:underline flex items-center justify-end gap-1">
                        <LinkIcon className="w-3 h-3" /> View on Reizor
                      </a>
                    )}
                  </div>
                </div>
                {rec.description && <p className="text-sm text-muted-foreground">{rec.description}</p>}
                {rec.outreach_attempts > 0 && (
                  <p className="text-[10px] text-muted-foreground font-mono">
                    Outreach attempts: {rec.outreach_attempts} · Last sent: {rec.last_outreach_at ? format(new Date(rec.last_outreach_at), "MMM dd") : "N/A"}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {recommendations.length === 0 && !showForm && user && (
        <div className="text-center py-12 text-muted-foreground">
          <Lightbulb className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>No recommendations yet</p>
        </div>
      )}
    </div>
  );
}