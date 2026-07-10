import { useState, useEffect } from 'react';
import { Copy, Check, Edit2, Trash2, Plus, Power, BarChart3, Link, RefreshCw } from 'lucide-react';
import { getAppUrl } from '@/lib/appUrl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { format } from 'date-fns';

function generateCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

const BLANK = {
  promoter_name: '', promoter_email: '', promoter_phone: '',
  tracking_code: '', max_tickets: '', max_tables: '',
  custom_ticket_price: '', custom_table_price: '',
  commission_type: 'none', commission_value: '',
  start_date: '', expiry_date: '', status: 'active',
};

export default function PromoterLinksManager({ eventId, eventTitle, organizerId }) {
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ ...BLANK, tracking_code: generateCode() });
  const [saving, setSaving] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  const load = async () => {
    const data = await base44.entities.SellerLink.filter({ event_id: eventId }, '-created_date', 100).catch(() => []);
    setLinks(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, [eventId]);

  const openNew = () => {
    setEditing(null);
    setForm({ ...BLANK, tracking_code: generateCode() });
    setShowForm(true);
  };

  const openEdit = (link) => {
    setEditing(link);
    setForm({
      promoter_name: link.promoter_name || '',
      promoter_email: link.promoter_email || '',
      promoter_phone: link.promoter_phone || '',
      tracking_code: link.tracking_code || '',
      max_tickets: link.max_tickets || '',
      max_tables: link.max_tables || '',
      custom_ticket_price: link.custom_ticket_price || '',
      custom_table_price: link.custom_table_price || '',
      commission_type: link.commission_type || 'none',
      commission_value: link.commission_value || '',
      start_date: link.start_date ? new Date(link.start_date).toISOString().slice(0, 16) : '',
      expiry_date: link.expiry_date ? new Date(link.expiry_date).toISOString().slice(0, 16) : '',
      status: link.status || 'active',
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.promoter_name.trim()) { toast.error('Promoter name is required'); return; }
    if (!form.tracking_code.trim()) { toast.error('Tracking code is required'); return; }

    // Unique code check
    const existing = links.find(l => l.tracking_code === form.tracking_code && l.id !== editing?.id);
    if (existing) { toast.error('Tracking code already in use for this event'); return; }

    setSaving(true);
    const data = {
      event_id: eventId,
      event_title: eventTitle,
      organizer_id: organizerId,
      promoter_name: form.promoter_name,
      promoter_email: form.promoter_email,
      promoter_phone: form.promoter_phone,
      tracking_code: form.tracking_code.toUpperCase(),
      max_tickets: form.max_tickets ? Number(form.max_tickets) : 0,
      max_tables: form.max_tables ? Number(form.max_tables) : 0,
      custom_ticket_price: form.custom_ticket_price ? Number(form.custom_ticket_price) : 0,
      custom_table_price: form.custom_table_price ? Number(form.custom_table_price) : 0,
      commission_type: form.commission_type,
      commission_value: form.commission_value ? Number(form.commission_value) : 0,
      start_date: form.start_date ? new Date(form.start_date).toISOString() : null,
      expiry_date: form.expiry_date ? new Date(form.expiry_date).toISOString() : null,
      status: form.status,
    };

    if (editing) {
      await base44.entities.SellerLink.update(editing.id, data);
      toast.success('Promoter link updated');
    } else {
      await base44.entities.SellerLink.create({ ...data, tickets_sold: 0, tables_sold: 0, total_revenue: 0, commission_earned: 0 });
      toast.success('Promoter link created');
    }
    setSaving(false);
    setShowForm(false);
    load();
  };

  const handleDelete = async (link) => {
    if (link.tickets_sold > 0 || link.tables_sold > 0) {
      toast.error('Cannot delete a link with existing sales. Deactivate it instead.');
      return;
    }
    if (!window.confirm(`Delete link for ${link.promoter_name}?`)) return;
    await base44.entities.SellerLink.delete(link.id);
    setLinks(prev => prev.filter(l => l.id !== link.id));
    toast.success('Link deleted');
  };

  const toggleStatus = async (link) => {
    const newStatus = link.status === 'active' ? 'inactive' : 'active';
    await base44.entities.SellerLink.update(link.id, { status: newStatus });
    setLinks(prev => prev.map(l => l.id === link.id ? { ...l, status: newStatus } : l));
    toast.success(`Link ${newStatus}`);
  };

  const copyLink = (link) => {
    const url = getAppUrl(`/events/${eventId}?seller=${link.tracking_code}`);
    navigator.clipboard.writeText(url);
    setCopiedId(link.id);
    toast.success('Tracking link copied!');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const totalRevenue = links.reduce((s, l) => s + (l.total_revenue || 0), 0);
  const totalTickets = links.reduce((s, l) => s + (l.tickets_sold || 0), 0);
  const totalTables = links.reduce((s, l) => s + (l.tables_sold || 0), 0);

  if (loading) return <div className="flex justify-center py-8"><div className="w-5 h-5 border-2 border-muted border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display font-bold text-lg flex items-center gap-2"><Link className="w-4 h-4 text-primary" /> PROMOTER LINKS</h3>
          <p className="text-xs text-muted-foreground font-mono mt-0.5">{links.length} link{links.length !== 1 ? 's' : ''} · {totalTickets} tickets · {totalTables} tables · ${totalRevenue.toFixed(2)} revenue</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={load} className="gap-1.5"><RefreshCw className="w-3.5 h-3.5" /></Button>
          <Button size="sm" onClick={openNew} className="gap-1.5 glow-lime font-bold"><Plus className="w-3.5 h-3.5" /> Add Link</Button>
        </div>
      </div>

      {/* Summary stats */}
      {links.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Tickets Sold', value: totalTickets },
            { label: 'Tables Sold', value: totalTables },
            { label: 'Total Revenue', value: `$${totalRevenue.toFixed(2)}` },
          ].map(({ label, value }) => (
            <div key={label} className="p-3 rounded-lg bg-card border border-border/50 text-center">
              <p className="font-mono text-[10px] text-muted-foreground uppercase">{label}</p>
              <p className="font-mono font-bold text-lg mt-0.5">{value}</p>
            </div>
          ))}
        </div>
      )}

      {links.length === 0 ? (
        <div className="p-8 rounded-xl bg-card border border-border/50 text-center space-y-3">
          <Link className="w-8 h-8 text-muted-foreground/30 mx-auto" />
          <p className="text-muted-foreground text-sm">No promoter links yet. Add one to start tracking.</p>
          <Button size="sm" onClick={openNew} className="gap-2"><Plus className="w-3.5 h-3.5" /> Add First Link</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {links.map(link => {
            const ticketLimit = link.max_tickets > 0;
            const tableLimit = link.max_tables > 0;
            const ticketsFull = ticketLimit && link.tickets_sold >= link.max_tickets;
            const tablesFull = tableLimit && link.tables_sold >= link.max_tables;
            const isExpired = link.expiry_date && new Date(link.expiry_date) < new Date();

            return (
              <div key={link.id} className={`p-4 rounded-xl bg-card border ${link.status === 'inactive' || isExpired ? 'border-border/30 opacity-70' : 'border-border/50'}`}>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-sm">{link.promoter_name}</p>
                      <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                        isExpired ? 'text-destructive bg-destructive/10' :
                        link.status === 'active' ? 'text-green-400 bg-green-400/10' : 'text-muted-foreground bg-muted'
                      }`}>
                        {isExpired ? 'EXPIRED' : link.status.toUpperCase()}
                      </span>
                      <span className="text-[10px] font-mono text-accent bg-accent/10 px-1.5 py-0.5 rounded">
                        {link.tracking_code}
                      </span>
                    </div>
                    {link.promoter_email && <p className="text-xs text-muted-foreground font-mono mt-0.5">{link.promoter_email}</p>}
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <button onClick={() => copyLink(link)} className="p-1.5 rounded border border-border/50 hover:border-primary/40 text-muted-foreground hover:text-foreground transition-colors">
                      {copiedId === link.id ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                    <button onClick={() => toggleStatus(link)} className={`p-1.5 rounded border transition-colors ${link.status === 'active' ? 'border-green-400/30 text-green-400 hover:bg-green-400/10' : 'border-border/50 text-muted-foreground hover:border-primary/40'}`}>
                      <Power className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => openEdit(link)} className="p-1.5 rounded border border-border/50 hover:border-primary/40 text-muted-foreground hover:text-foreground transition-colors">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDelete(link)} className="p-1.5 rounded border border-destructive/30 text-destructive hover:bg-destructive/10 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Stats row */}
                <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="p-2 rounded bg-secondary/50">
                    <p className="font-mono text-[10px] text-muted-foreground">Tickets Sold</p>
                    <p className="font-bold">
                      {link.tickets_sold || 0}
                      {ticketLimit && <span className="text-muted-foreground font-normal"> / {link.max_tickets}</span>}
                    </p>
                    {ticketsFull && <p className="text-[9px] text-destructive font-mono">LIMIT REACHED</p>}
                  </div>
                  <div className="p-2 rounded bg-secondary/50">
                    <p className="font-mono text-[10px] text-muted-foreground">Tables Sold</p>
                    <p className="font-bold">
                      {link.tables_sold || 0}
                      {tableLimit && <span className="text-muted-foreground font-normal"> / {link.max_tables}</span>}
                    </p>
                    {tablesFull && <p className="text-[9px] text-destructive font-mono">LIMIT REACHED</p>}
                  </div>
                  <div className="p-2 rounded bg-secondary/50">
                    <p className="font-mono text-[10px] text-muted-foreground">Revenue</p>
                    <p className="font-bold text-green-400">${(link.total_revenue || 0).toFixed(2)}</p>
                  </div>
                  <div className="p-2 rounded bg-secondary/50">
                    <p className="font-mono text-[10px] text-muted-foreground">Commission</p>
                    <p className="font-bold text-yellow-400">${(link.commission_earned || 0).toFixed(2)}</p>
                  </div>
                </div>

                {/* Custom pricing / dates */}
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-mono text-muted-foreground">
                  {link.custom_ticket_price > 0 && <span>🎟️ Custom ticket: ${link.custom_ticket_price}</span>}
                  {link.custom_table_price > 0 && <span>🪑 Custom table: ${link.custom_table_price}</span>}
                  {link.commission_type !== 'none' && <span>💰 Commission: {link.commission_type === 'fixed' ? `$${link.commission_value}` : `${link.commission_value}%`}</span>}
                  {link.expiry_date && <span>⏱ Expires: {format(new Date(link.expiry_date), 'MMM d, yyyy')}</span>}
                  {link.last_sale_date && <span>Last sale: {format(new Date(link.last_sale_date), 'MMM d, yyyy')}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="bg-card border-border max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display font-black">{editing ? 'Edit Promoter Link' : 'New Promoter Link'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label className="text-xs font-mono text-muted-foreground">Promoter Name *</Label>
                <Input value={form.promoter_name} onChange={e => setForm(f => ({ ...f, promoter_name: e.target.value }))}
                  placeholder="John Smith" className="mt-1 bg-secondary border-border/50" />
              </div>
              <div>
                <Label className="text-xs font-mono text-muted-foreground">Email</Label>
                <Input value={form.promoter_email} onChange={e => setForm(f => ({ ...f, promoter_email: e.target.value }))}
                  placeholder="promoter@email.com" className="mt-1 bg-secondary border-border/50" />
              </div>
              <div>
                <Label className="text-xs font-mono text-muted-foreground">Phone</Label>
                <Input value={form.promoter_phone} onChange={e => setForm(f => ({ ...f, promoter_phone: e.target.value }))}
                  placeholder="+1 555 000 0000" className="mt-1 bg-secondary border-border/50" />
              </div>
            </div>

            <div>
              <Label className="text-xs font-mono text-muted-foreground">Tracking Code *</Label>
              <div className="flex gap-2 mt-1">
                <Input value={form.tracking_code}
                  onChange={e => setForm(f => ({ ...f, tracking_code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') }))}
                  placeholder="ABC123" className="font-mono bg-secondary border-border/50 flex-1" />
                <Button type="button" size="sm" variant="outline" onClick={() => setForm(f => ({ ...f, tracking_code: generateCode() }))}>
                  Regenerate
                </Button>
              </div>
              <p className="text-[10px] font-mono text-muted-foreground mt-1">Link: /events/{eventId}?seller={form.tracking_code || '...'}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-mono text-muted-foreground">Max Tickets (0 = unlimited)</Label>
                <Input type="number" value={form.max_tickets} onChange={e => setForm(f => ({ ...f, max_tickets: e.target.value }))}
                  placeholder="0" className="mt-1 bg-secondary border-border/50" />
              </div>
              <div>
                <Label className="text-xs font-mono text-muted-foreground">Max Tables (0 = unlimited)</Label>
                <Input type="number" value={form.max_tables} onChange={e => setForm(f => ({ ...f, max_tables: e.target.value }))}
                  placeholder="0" className="mt-1 bg-secondary border-border/50" />
              </div>
              <div>
                <Label className="text-xs font-mono text-muted-foreground">Custom Ticket Price (0 = default)</Label>
                <Input type="number" value={form.custom_ticket_price} onChange={e => setForm(f => ({ ...f, custom_ticket_price: e.target.value }))}
                  placeholder="0" className="mt-1 bg-secondary border-border/50" />
              </div>
              <div>
                <Label className="text-xs font-mono text-muted-foreground">Custom Table Price (0 = default)</Label>
                <Input type="number" value={form.custom_table_price} onChange={e => setForm(f => ({ ...f, custom_table_price: e.target.value }))}
                  placeholder="0" className="mt-1 bg-secondary border-border/50" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-mono text-muted-foreground">Commission Type</Label>
                <div className="mt-1 flex rounded-md border border-border/50 overflow-hidden">
                  {[{v:'none',l:'None'},{v:'fixed',l:'Fixed $'},{v:'percentage',l:'%'}].map(({v,l}) => (
                    <button key={v} type="button" onClick={() => setForm(f => ({ ...f, commission_type: v }))}
                      className={`flex-1 py-2 text-xs font-mono font-bold transition-all ${form.commission_type === v ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:bg-muted'}`}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              {form.commission_type !== 'none' && (
                <div>
                  <Label className="text-xs font-mono text-muted-foreground">Commission {form.commission_type === 'fixed' ? '($)' : '(%)'}</Label>
                  <Input type="number" value={form.commission_value} onChange={e => setForm(f => ({ ...f, commission_value: e.target.value }))}
                    placeholder="0" className="mt-1 bg-secondary border-border/50" />
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-mono text-muted-foreground">Start Date (optional)</Label>
                <Input type="datetime-local" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                  className="mt-1 bg-secondary border-border/50" />
              </div>
              <div>
                <Label className="text-xs font-mono text-muted-foreground">Expiry Date (optional)</Label>
                <Input type="datetime-local" value={form.expiry_date} onChange={e => setForm(f => ({ ...f, expiry_date: e.target.value }))}
                  className="mt-1 bg-secondary border-border/50" />
              </div>
            </div>

            <div>
              <Label className="text-xs font-mono text-muted-foreground">Status</Label>
              <div className="mt-1 flex rounded-md border border-border/50 overflow-hidden w-48">
                {['active', 'inactive'].map(s => (
                  <button key={s} type="button" onClick={() => setForm(f => ({ ...f, status: s }))}
                    className={`flex-1 py-2 text-xs font-mono font-bold capitalize transition-all ${form.status === s ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:bg-muted'}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button onClick={handleSave} disabled={saving} className="flex-1">{saving ? 'Saving...' : (editing ? 'Update Link' : 'Create Link')}</Button>
              <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}