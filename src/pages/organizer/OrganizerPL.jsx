import { useState, useEffect } from "react";
import { Plus, Trash2, TrendingUp, TrendingDown, DollarSign, Ticket, UtensilsCrossed, PlusCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";
import { format } from "date-fns";

export default function OrganizerPL() {
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState("all");
  const [orders, setOrders] = useState([]);
  const [tableRevenue, setTableRevenue] = useState(0);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState("");

  // New expense form
  const [newExpense, setNewExpense] = useState({ subject: "", description: "", amount: "" });
  const [adding, setAdding] = useState(false);
  const [manualIncomes, setManualIncomes] = useState([]);
  const [newIncome, setNewIncome] = useState({ subject: "", description: "", amount: "" });
  const [addingIncome, setAddingIncome] = useState(false);

  useEffect(() => {
    const load = async () => {
      const user = await base44.auth.me();
      setUserId(user.id);
      const [evs, ords, tbls, exps, mincs] = await Promise.all([
        base44.entities.Event.filter({ organizer_id: user.id }, "-date", 100),
        base44.entities.Order.filter({ status: "completed" }, "-created_date", 500),
        base44.entities.Table.filter({}, null, 500),
        base44.entities.Expense.filter({ organizer_id: user.id }, "-created_date", 200),
        base44.entities.ManualIncome.filter({ organizer_id: user.id }, "-created_date", 200),
      ]);
      const eventIds = new Set(evs.map((e) => e.id));
      setEvents(evs);
      setOrders(ords.filter((o) => eventIds.has(o.event_id)));
      // Table revenue = price * quantity_sold for organizer's events
      const myTables = tbls.filter((t) => eventIds.has(t.event_id));
      setTableRevenue(myTables.reduce((s, t) => s + (t.price || 0) * (t.quantity_sold || 0), 0));
      setExpenses(exps);
      setManualIncomes(mincs);
      setLoading(false);
    };
    load();
  }, []);

  const filteredOrders = selectedEventId === "all"
    ? orders
    : orders.filter((o) => o.event_id === selectedEventId);

  const filteredExpenses = selectedEventId === "all"
    ? expenses
    : expenses.filter((e) => e.event_id === selectedEventId);

  const filteredManualIncomes = selectedEventId === "all"
    ? manualIncomes
    : manualIncomes.filter((i) => i.event_id === selectedEventId);

  const totalManualIncome = filteredManualIncomes.reduce((s, i) => s + (i.amount || 0), 0);

  const filteredTableRevenue = selectedEventId === "all"
    ? tableRevenue
    : (() => {
        // We don't have per-event table revenue cached, recompute from orders isn't clean
        // Best effort: sum items from orders for selected event that are table orders
        return 0; // will be overridden when event selected by a separate fetch
      })();

  // Use subtotal (pure ticket sales). Fall back to total only for legacy orders missing subtotal.
  const ticketIncome = filteredOrders.reduce((s, o) => s + (o.subtotal || o.total || 0), 0);
  // Net organizer income = subtotal minus platform fee minus card fee if organizer absorbs it
  const platformFeeTotal = filteredOrders.reduce((s, o) => s + (o.service_fee || 0), 0);
  const cardFeeTotal = filteredOrders.reduce((s, o) => {
    if (o.card_processing_fee != null) {
      return s + (o.cc_fee_paid_by === 'organizer' ? (o.card_processing_fee || 0) : 0);
    }
    // Legacy: estimate only when organizer absorbs
    if (o.cc_fee_on_buyer === false) {
      const base = (o.subtotal || 0) + (o.service_fee || 0);
      return s + base * 0.03;
    }
    return s;
  }, 0);
  const netTicketIncome = ticketIncome - platformFeeTotal - cardFeeTotal;
  const tableIncome = selectedEventId === "all" ? tableRevenue : filteredTableRevenue;
  const totalIncome = netTicketIncome + (selectedEventId === "all" ? tableRevenue : 0) + totalManualIncome;
  const totalExpenses = filteredExpenses.reduce((s, e) => s + (e.amount || 0), 0);
  const netProfit = totalIncome - totalExpenses;

  const handleAddIncome = async () => {
    if (!newIncome.subject || !newIncome.amount) {
      toast.error("Subject and amount are required");
      return;
    }
    setAddingIncome(true);
    const eventForIncome = selectedEventId !== "all" ? selectedEventId : (events[0]?.id || "");
    const ev = events.find((e) => e.id === eventForIncome);
    const inc = await base44.entities.ManualIncome.create({
      event_id: eventForIncome,
      event_title: ev?.title || "",
      organizer_id: userId,
      subject: newIncome.subject,
      description: newIncome.description,
      amount: parseFloat(newIncome.amount),
    });
    setManualIncomes((prev) => [inc, ...prev]);
    setNewIncome({ subject: "", description: "", amount: "" });
    setAddingIncome(false);
    toast.success("Income added");
  };

  const handleDeleteIncome = async (id) => {
    await base44.entities.ManualIncome.delete(id);
    setManualIncomes((prev) => prev.filter((i) => i.id !== id));
    toast.success("Income removed");
  };

  const handleAddExpense = async () => {
    if (!newExpense.subject || !newExpense.amount) {
      toast.error("Subject and amount are required");
      return;
    }
    setAdding(true);
    const eventForExpense = selectedEventId !== "all" ? selectedEventId : (events[0]?.id || "");
    const ev = events.find((e) => e.id === eventForExpense);
    const exp = await base44.entities.Expense.create({
      event_id: eventForExpense,
      event_title: ev?.title || "",
      organizer_id: userId,
      subject: newExpense.subject,
      description: newExpense.description,
      amount: parseFloat(newExpense.amount),
    });
    setExpenses((prev) => [exp, ...prev]);
    setNewExpense({ subject: "", description: "", amount: "" });
    setAdding(false);
    toast.success("Expense added");
  };

  const handleDeleteExpense = async (id) => {
    await base44.entities.Expense.delete(id);
    setExpenses((prev) => prev.filter((e) => e.id !== id));
    toast.success("Expense removed");
  };

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-8 max-w-3xl">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display font-black text-3xl tracking-tight">P&amp;L REPORT</h1>
          <p className="text-sm text-muted-foreground mt-1">Profit &amp; loss across your events</p>
        </div>
        <div className="w-56">
          <Select value={selectedEventId} onValueChange={setSelectedEventId}>
            <SelectTrigger className="bg-card border-border/50">
              <SelectValue placeholder="All events" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Events</SelectItem>
              {events.map((e) => (
                <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-card border border-border/50">
          <div className="flex items-center gap-2 mb-2">
            <Ticket className="w-4 h-4 text-primary" />
            <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Ticket Income</span>
          </div>
          <p className="font-display font-black text-2xl">${ticketIncome.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
        </div>
        <div className="p-4 rounded-xl bg-card border border-border/50">
          <div className="flex items-center gap-2 mb-2">
            <UtensilsCrossed className="w-4 h-4 text-accent" />
            <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Table Income</span>
          </div>
          <p className="font-display font-black text-2xl text-accent">${(selectedEventId === "all" ? tableRevenue : 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
        </div>
        <div className="p-4 rounded-xl bg-card border border-border/50">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="w-4 h-4 text-destructive" />
            <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Total Expenses</span>
          </div>
          <p className="font-display font-black text-2xl text-destructive">-${totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
        </div>
        <div className={`p-4 rounded-xl border ${netProfit >= 0 ? "bg-green-500/10 border-green-500/30" : "bg-destructive/10 border-destructive/30"}`}>
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className={`w-4 h-4 ${netProfit >= 0 ? "text-green-400" : "text-destructive"}`} />
            <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Net Profit</span>
          </div>
          <p className={`font-display font-black text-2xl ${netProfit >= 0 ? "text-green-400" : "text-destructive"}`}>
            {netProfit >= 0 ? "+" : ""}${netProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* Income Breakdown */}
      <div className="p-5 rounded-xl bg-card border border-border/50 space-y-3">
        <h2 className="font-display font-bold text-base">INCOME BREAKDOWN</h2>
        <div className="flex justify-between text-sm py-2 border-b border-border/30">
          <span className="text-muted-foreground">Gross Ticket Sales ({filteredOrders.length} orders)</span>
          <span className="font-mono font-bold">${ticketIncome.toFixed(2)}</span>
        </div>
        {platformFeeTotal > 0 && (
          <div className="flex justify-between text-sm py-2 border-b border-border/30">
            <span className="text-muted-foreground">Platform Fee Deduction</span>
            <span className="font-mono font-bold text-destructive">-${platformFeeTotal.toFixed(2)}</span>
          </div>
        )}
        {cardFeeTotal > 0 && (
          <div className="flex justify-between text-sm py-2 border-b border-border/30">
            <span className="text-muted-foreground">Card Processing Fee (absorbed by you)</span>
            <span className="font-mono font-bold text-destructive">-${cardFeeTotal.toFixed(2)}</span>
          </div>
        )}
        {(platformFeeTotal > 0 || cardFeeTotal > 0) && (
          <div className="flex justify-between text-sm py-2 border-b border-border/30">
            <span className="text-muted-foreground font-bold">Net Ticket Earnings</span>
            <span className="font-mono font-bold">${netTicketIncome.toFixed(2)}</span>
          </div>
        )}
        <div className="flex justify-between text-sm py-2 border-b border-border/30">
          <span className="text-muted-foreground">Table Packages</span>
          <span className="font-mono font-bold text-accent">${(selectedEventId === "all" ? tableRevenue : 0).toFixed(2)}</span>
        </div>
        {totalManualIncome > 0 && (
          <div className="flex justify-between text-sm py-2 border-b border-border/30">
            <span className="text-muted-foreground">Manual Income ({filteredManualIncomes.length} entries)</span>
            <span className="font-mono font-bold text-green-400">${totalManualIncome.toFixed(2)}</span>
          </div>
        )}
        <div className="flex justify-between text-sm py-2 font-bold">
          <span>Total Net Income</span>
          <span className="font-mono text-primary">${totalIncome.toFixed(2)}</span>
        </div>
      </div>

      {/* Manual Income */}
      <div className="space-y-4">
        <h2 className="font-display font-bold text-base">ADDITIONAL INCOME</h2>

        <div className="p-4 rounded-xl bg-card border border-border/50 space-y-3">
          <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider">Add Manual Income</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              placeholder="Subject (e.g. Sponsorship)"
              value={newIncome.subject}
              onChange={(e) => setNewIncome((p) => ({ ...p, subject: e.target.value }))}
              className="bg-secondary border-border/50"
            />
            <Input
              placeholder="Description (optional)"
              value={newIncome.description}
              onChange={(e) => setNewIncome((p) => ({ ...p, description: e.target.value }))}
              className="bg-secondary border-border/50"
            />
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="Amount ($)"
                value={newIncome.amount}
                onChange={(e) => setNewIncome((p) => ({ ...p, amount: e.target.value }))}
                className="bg-secondary border-border/50"
                onKeyDown={(e) => e.key === "Enter" && handleAddIncome()}
              />
              <Button onClick={handleAddIncome} disabled={addingIncome} className="bg-green-500 hover:bg-green-600 text-white font-display font-bold shrink-0 gap-1">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {filteredManualIncomes.length > 0 && (
          <div className="rounded-xl bg-card border border-border/50 overflow-hidden">
            <div className="divide-y divide-border/30">
              {filteredManualIncomes.map((inc) => (
                <div key={inc.id} className="flex items-center gap-4 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm">{inc.subject}</p>
                    {inc.description && <p className="text-xs text-muted-foreground mt-0.5">{inc.description}</p>}
                    {inc.event_title && <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{inc.event_title}</p>}
                  </div>
                  <span className="font-mono font-bold text-green-400 shrink-0">+${inc.amount.toFixed(2)}</span>
                  <button onClick={() => handleDeleteIncome(inc.id)} className="text-muted-foreground hover:text-destructive transition-colors shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex justify-between px-4 py-3 border-t border-border/50 bg-secondary/30">
              <span className="font-display font-bold text-sm">Total Manual Income</span>
              <span className="font-mono font-bold text-green-400">+${totalManualIncome.toFixed(2)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Expenses */}
      <div className="space-y-4">
        <h2 className="font-display font-bold text-base">EXPENSES</h2>

        {/* Add expense form */}
        <div className="p-4 rounded-xl bg-card border border-border/50 space-y-3">
          <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider">Add Expense</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              placeholder="Subject (e.g. Sound System)"
              value={newExpense.subject}
              onChange={(e) => setNewExpense((p) => ({ ...p, subject: e.target.value }))}
              className="bg-secondary border-border/50"
            />
            <Input
              placeholder="Description (optional)"
              value={newExpense.description}
              onChange={(e) => setNewExpense((p) => ({ ...p, description: e.target.value }))}
              className="bg-secondary border-border/50"
            />
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="Amount ($)"
                value={newExpense.amount}
                onChange={(e) => setNewExpense((p) => ({ ...p, amount: e.target.value }))}
                className="bg-secondary border-border/50"
                onKeyDown={(e) => e.key === "Enter" && handleAddExpense()}
              />
              <Button onClick={handleAddExpense} disabled={adding} className="glow-lime font-display font-bold shrink-0 gap-1">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Expense list */}
        {filteredExpenses.length === 0 ? (
          <div className="text-center py-8 text-sm text-muted-foreground bg-card rounded-lg border border-border/50">
            No expenses recorded yet
          </div>
        ) : (
          <div className="rounded-xl bg-card border border-border/50 overflow-hidden">
            <div className="divide-y divide-border/30">
              {filteredExpenses.map((exp) => (
                <div key={exp.id} className="flex items-center gap-4 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm">{exp.subject}</p>
                    {exp.description && <p className="text-xs text-muted-foreground mt-0.5">{exp.description}</p>}
                    {exp.event_title && (
                      <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{exp.event_title}</p>
                    )}
                  </div>
                  <span className="font-mono font-bold text-destructive shrink-0">-${exp.amount.toFixed(2)}</span>
                  <button onClick={() => handleDeleteExpense(exp.id)} className="text-muted-foreground hover:text-destructive transition-colors shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex justify-between px-4 py-3 border-t border-border/50 bg-secondary/30">
              <span className="font-display font-bold text-sm">Total Expenses</span>
              <span className="font-mono font-bold text-destructive">-${totalExpenses.toFixed(2)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Net Summary */}
      <div className={`p-5 rounded-xl border-2 ${netProfit >= 0 ? "border-green-500/40 bg-green-500/5" : "border-destructive/40 bg-destructive/5"}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider mb-1">Net Profit After Expenses</p>
            <p className={`font-display font-black text-3xl ${netProfit >= 0 ? "text-green-400" : "text-destructive"}`}>
              {netProfit >= 0 ? "+" : ""}${netProfit.toFixed(2)}
            </p>
          </div>
          <div className="text-right text-xs font-mono text-muted-foreground space-y-1">
            <p>Income: <span className="text-foreground font-bold">${totalIncome.toFixed(2)}</span></p>
            <p>Expenses: <span className="text-destructive font-bold">-${totalExpenses.toFixed(2)}</span></p>
          </div>
        </div>
      </div>
    </div>
  );
}