import { useState, useEffect } from "react";
import { BarChart2, Plus, Trash2, Loader2, Save, Clock, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { format, isPast, isFuture } from "date-fns";

// LocalStorage for quick-reuse
const Q_KEY = "poll_questions_v1";
const A_KEY = "poll_answers_v1";
function getStored(key) { try { return JSON.parse(localStorage.getItem(key) || "[]"); } catch { return []; } }
function storeItem(key, val) {
  const list = getStored(key);
  if (!list.includes(val)) { localStorage.setItem(key, JSON.stringify([val, ...list].slice(0, 20))); }
}

function getPollStatus(poll) {
  const now = new Date();
  const start = new Date(poll.start_datetime);
  const end = new Date(poll.end_datetime);
  if (now < start) return "upcoming";
  if (now > end) return "ended";
  return "active";
}

function PollCard({ poll, currentUserEmail, onDelete }) {
  const [votes, setVotes] = useState({ a: poll.votes_a || 0, b: poll.votes_b || 0 });
  const [myVote, setMyVote] = useState(null);
  const [voting, setVoting] = useState(false);
  const [status, setStatus] = useState(getPollStatus(poll));

  // Real-time subscription
  useEffect(() => {
    setVotes({ a: poll.votes_a || 0, b: poll.votes_b || 0 });
    const unsub = base44.entities.EventPoll.subscribe((event) => {
      if (event.id === poll.id && event.data) {
        setVotes({ a: event.data.votes_a || 0, b: event.data.votes_b || 0 });
      }
    });
    // Update status every 30 seconds
    const timer = setInterval(() => setStatus(getPollStatus(poll)), 30000);
    return () => { unsub(); clearInterval(timer); };
  }, [poll.id]);

  // Check existing vote
  useEffect(() => {
    if (!currentUserEmail) return;
    base44.entities.PollVote.filter({ poll_id: poll.id, voter_email: currentUserEmail }, null, 1)
      .then(res => { if (res[0]) setMyVote(res[0].choice); })
      .catch(() => {});
  }, [poll.id, currentUserEmail]);

  const totalVotes = votes.a + votes.b;
  const pctA = totalVotes > 0 ? Math.round((votes.a / totalVotes) * 100) : 50;
  const pctB = 100 - pctA;

  const vote = async (choice) => {
    if (myVote || status !== "active" || !currentUserEmail) return;
    setVoting(true);
    try {
      await base44.entities.PollVote.create({ poll_id: poll.id, event_id: poll.event_id, voter_email: currentUserEmail, choice });
      // Update vote count on poll
      const newA = choice === "a" ? votes.a + 1 : votes.a;
      const newB = choice === "b" ? votes.b + 1 : votes.b;
      await base44.entities.EventPoll.update(poll.id, { votes_a: newA, votes_b: newB });
      setMyVote(choice);
      setVotes({ a: newA, b: newB });
      toast.success("Vote recorded!");
    } catch {
      toast.error("Failed to record vote");
    }
    setVoting(false);
  };

  const statusConfig = {
    upcoming: { label: "Upcoming", color: "text-accent bg-accent/10", icon: Clock },
    active: { label: "Live", color: "text-green-400 bg-green-400/10", icon: CheckCircle },
    ended: { label: "Ended", color: "text-muted-foreground bg-muted", icon: XCircle },
  }[status];
  const StatusIcon = statusConfig.icon;

  return (
    <div className="p-4 rounded-xl bg-card border border-border/50 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`font-mono text-[10px] font-bold uppercase px-2 py-0.5 rounded flex items-center gap-1 ${statusConfig.color}`}>
              <StatusIcon className="w-3 h-3" /> {statusConfig.label}
            </span>
            <span className="font-mono text-[10px] text-muted-foreground">
              {format(new Date(poll.start_datetime), "MMM d, h:mm a")} → {format(new Date(poll.end_datetime), "MMM d, h:mm a")}
            </span>
          </div>
          <p className="font-bold text-sm">{poll.question}</p>
        </div>
        {onDelete && (
          <button onClick={() => onDelete(poll.id)} className="text-muted-foreground hover:text-destructive transition-colors shrink-0">
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Vote options */}
      <div className="space-y-2">
        {[
          { key: "a", label: poll.option_a, pct: pctA, votes: votes.a },
          { key: "b", label: poll.option_b, pct: pctB, votes: votes.b },
        ].map(opt => (
          <button
            key={opt.key}
            onClick={() => vote(opt.key)}
            disabled={!!myVote || status !== "active" || voting || !currentUserEmail}
            className={`w-full text-left rounded-lg border p-3 transition-all relative overflow-hidden ${
              myVote === opt.key
                ? "border-primary bg-primary/10"
                : myVote || status !== "active"
                ? "border-border/40 cursor-default"
                : "border-border/50 hover:border-primary/50 cursor-pointer"
            }`}
          >
            {/* Progress bar background */}
            {(myVote || status === "ended") && (
              <div
                className="absolute inset-y-0 left-0 bg-primary/10 rounded-lg transition-all duration-500"
                style={{ width: `${opt.pct}%` }}
              />
            )}
            <div className="relative flex items-center justify-between">
              <span className="text-sm font-medium">
                {opt.key === "a" ? "A" : "B"}. {opt.label}
                {myVote === opt.key && <span className="ml-2 text-primary text-xs font-mono">✓ Your vote</span>}
              </span>
              {(myVote || status === "ended") && (
                <span className="font-mono font-bold text-sm">{opt.pct}%</span>
              )}
            </div>
            {(myVote || status === "ended") && (
              <p className="text-[10px] font-mono text-muted-foreground mt-0.5 relative">{opt.votes} vote{opt.votes !== 1 ? "s" : ""}</p>
            )}
          </button>
        ))}
      </div>

      {totalVotes > 0 && (
        <p className="font-mono text-[10px] text-muted-foreground text-right">{totalVotes} total votes</p>
      )}
      {status === "active" && !currentUserEmail && (
        <p className="text-xs text-muted-foreground text-center">Sign in to vote</p>
      )}
    </div>
  );
}

export default function PollManager({ event, isOrganizer = false }) {
  const [polls, setPolls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [form, setForm] = useState({ question: "", option_a: "", option_b: "", start_datetime: "", end_datetime: "" });
  const [showQSuggestions, setShowQSuggestions] = useState(false);
  const [showASuggestions, setShowASuggestions] = useState(null); // "a" | "b" | null

  const savedQuestions = getStored(Q_KEY);
  const savedAnswers = getStored(A_KEY);

  useEffect(() => {
    load();
    base44.auth.me().then(u => setCurrentUser(u)).catch(() => {});
  }, [event.id]);

  const load = async () => {
    setLoading(true);
    const data = await base44.entities.EventPoll.filter({ event_id: event.id }, "-created_date", 20).catch(() => []);
    setPolls(data);
    setLoading(false);
  };

  const handleSave = async () => {
    const { question, option_a, option_b, start_datetime, end_datetime } = form;
    if (!question.trim() || !option_a.trim() || !option_b.trim() || !start_datetime || !end_datetime) {
      toast.error("Fill in all poll fields"); return;
    }
    if (new Date(end_datetime) <= new Date(start_datetime)) {
      toast.error("End date must be after start date"); return;
    }
    setSaving(true);
    storeItem(Q_KEY, question.trim());
    storeItem(A_KEY, option_a.trim());
    storeItem(A_KEY, option_b.trim());

    await base44.entities.EventPoll.create({
      event_id: event.id,
      event_title: event.title,
      organizer_id: event.organizer_id,
      question: question.trim(),
      option_a: option_a.trim(),
      option_b: option_b.trim(),
      votes_a: 0,
      votes_b: 0,
      start_datetime,
      end_datetime,
      status: "upcoming",
    });
    toast.success("Poll created!");
    setShowForm(false);
    setForm({ question: "", option_a: "", option_b: "", start_datetime: "", end_datetime: "" });
    setSaving(false);
    load();
  };

  const handleDelete = async (pollId) => {
    await base44.entities.EventPoll.delete(pollId);
    setPolls(prev => prev.filter(p => p.id !== pollId));
    toast.success("Poll removed");
  };

  if (loading) return null;

  // Don't show the section to non-organizers when there are no polls
  if (!isOrganizer && polls.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-accent" />
          <h3 className="font-display font-bold text-lg">POLLS</h3>
          {polls.length > 0 && (
            <span className="font-mono text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded">{polls.length} poll{polls.length > 1 ? "s" : ""}</span>
          )}
        </div>
        {isOrganizer && (
          <Button size="sm" variant="outline" onClick={() => setShowForm(v => !v)} className="gap-2">
            <Plus className="w-4 h-4" /> New Poll
          </Button>
        )}
      </div>

      {/* Create form (organizer only) */}
      {showForm && isOrganizer && (
        <div className="p-4 rounded-xl bg-card border border-accent/20 space-y-3">
          <p className="font-mono text-xs text-accent font-bold uppercase tracking-wider">Create Poll</p>

          {/* Question */}
          <div className="relative">
            <label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Poll Question</label>
            <Input
              placeholder="e.g. Which track should I play tonight?"
              value={form.question}
              onChange={e => { setForm(f => ({ ...f, question: e.target.value })); setShowQSuggestions(true); }}
              onFocus={() => setShowQSuggestions(true)}
              onBlur={() => setTimeout(() => setShowQSuggestions(false), 150)}
              className="bg-background border-border/50"
            />
            {showQSuggestions && savedQuestions.length > 0 && (
              <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-popover border border-border rounded-lg shadow-lg max-h-36 overflow-y-auto">
                {savedQuestions.filter(q => !form.question || q.toLowerCase().includes(form.question.toLowerCase())).slice(0, 6).map(q => (
                  <button key={q} className="w-full text-left px-3 py-2 text-sm hover:bg-muted" onMouseDown={() => { setForm(f => ({ ...f, question: q })); setShowQSuggestions(false); }}>
                    {q}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Options */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {["a", "b"].map(opt => (
              <div key={opt} className="relative">
                <label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Option {opt.toUpperCase()}</label>
                <Input
                  placeholder={opt === "a" ? "e.g. Mio Mio" : "e.g. Bo Bo"}
                  value={form[`option_${opt}`]}
                  onChange={e => { setForm(f => ({ ...f, [`option_${opt}`]: e.target.value })); setShowASuggestions(opt); }}
                  onFocus={() => setShowASuggestions(opt)}
                  onBlur={() => setTimeout(() => setShowASuggestions(null), 150)}
                  className="bg-background border-border/50"
                />
                {showASuggestions === opt && savedAnswers.length > 0 && (
                  <div className="absolute z-20 top-full mt-1 left-0 right-0 bg-popover border border-border rounded-lg shadow-lg max-h-36 overflow-y-auto">
                    {savedAnswers.filter(a => !form[`option_${opt}`] || a.toLowerCase().includes(form[`option_${opt}`].toLowerCase())).slice(0, 6).map(a => (
                      <button key={a} className="w-full text-left px-3 py-2 text-sm hover:bg-muted" onMouseDown={() => { setForm(f => ({ ...f, [`option_${opt}`]: a })); setShowASuggestions(null); }}>
                        {a}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Dates */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Start Date & Time</label>
              <Input type="datetime-local" value={form.start_datetime} onChange={e => setForm(f => ({ ...f, start_datetime: e.target.value }))} className="bg-background border-border/50" />
            </div>
            <div>
              <label className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">End Date & Time</label>
              <Input type="datetime-local" value={form.end_datetime} onChange={e => setForm(f => ({ ...f, end_datetime: e.target.value }))} className="bg-background border-border/50" />
            </div>
          </div>

          <div className="flex gap-2 justify-end">
            <Button size="sm" variant="ghost" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Create Poll
            </Button>
          </div>
        </div>
      )}

      {polls.length === 0 && !showForm && (
        <p className="text-sm text-muted-foreground text-center py-6 bg-card rounded-lg border border-border/50">
          {isOrganizer ? "No polls yet. Create one to engage your fans!" : "No active polls for this event."}
        </p>
      )}

      {polls.map(poll => (
        <PollCard
          key={poll.id}
          poll={poll}
          currentUserEmail={currentUser?.email}
          onDelete={isOrganizer ? handleDelete : null}
        />
      ))}
    </div>
  );
}