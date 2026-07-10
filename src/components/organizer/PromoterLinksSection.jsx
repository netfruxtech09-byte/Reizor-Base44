import { useState } from 'react';
import { Plus, Trash2, Copy, Check, Link, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { APP_BASE_URL } from "@/lib/appUrl";

function generateCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

const BLANK_LINK = {
  promoter_name: '',
  promoter_email: '',
  promoter_phone: '',
  tracking_code: '',
  max_tickets: '',
  max_tables: '',
  custom_ticket_price: '',
  custom_table_price: '',
  commission_type: 'none',
  commission_value: '',
  start_date: '',
  expiry_date: '',
  status: 'active',
};

export default function PromoterLinksSection({ links, onChange, eventId }) {
  const [open, setOpen] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState(null);

  const add = () => {
    onChange([...links, { ...BLANK_LINK, tracking_code: generateCode() }]);
    setOpen(true);
  };

  const remove = (i) => {
    onChange(links.filter((_, idx) => idx !== i));
  };

  const update = (i, field, value) => {
    const updated = [...links];
    updated[i] = { ...updated[i], [field]: value };
    onChange(updated);
  };

  const regenerateCode = (i) => {
    update(i, 'tracking_code', generateCode());
  };

  const copyLink = (i) => {
    const code = links[i].tracking_code;
    if (!code) { toast.error('No tracking code set'); return; }
    const base = eventId
      ? `${APP_BASE_URL}/events/${eventId}?seller=${code}`
      : `(save event first to get full link) ?seller=${code}`;
    navigator.clipboard.writeText(base);
    setCopiedIdx(i);
    toast.success('Tracking link copied!');
    setTimeout(() => setCopiedIdx(null), 2000);
  };

  return (
    <div className="rounded-xl bg-card border border-border/50 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/20 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-lg">🔗</span>
          <div className="text-left">
            <p className="font-display font-bold text-sm">Promoter / Ticket Seller Links</p>
            <p className="text-xs text-muted-foreground font-mono">
              {links.length > 0 ? `${links.length} link${links.length !== 1 ? 's' : ''} configured` : 'Track sales by promoter or ticket seller'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {links.length > 0 && (
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-primary/20 text-primary">
              {links.length}
            </span>
          )}
          {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-border/30 px-4 pb-4 space-y-4 pt-4">
          <p className="text-xs text-muted-foreground font-mono">
            Each promoter gets a unique link. When a buyer visits the event through their link and completes a purchase, it's tracked under that promoter.
          </p>

          {links.map((link, i) => (
            <div key={i} className="p-4 rounded-lg bg-secondary border border-border/50 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-primary">Promoter {i + 1}</span>
                <button onClick={() => remove(i)} className="text-destructive hover:opacity-70">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Name + Email + Phone */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[10px] font-mono text-muted-foreground">Promoter Name *</Label>
                  <Input value={link.promoter_name} onChange={e => update(i, 'promoter_name', e.target.value)}
                    placeholder="John Smith" className="mt-1 bg-background border-border/50 text-sm" />
                </div>
                <div>
                  <Label className="text-[10px] font-mono text-muted-foreground">Email (optional)</Label>
                  <Input value={link.promoter_email} onChange={e => update(i, 'promoter_email', e.target.value)}
                    placeholder="promoter@email.com" className="mt-1 bg-background border-border/50 text-sm" />
                </div>
                <div>
                  <Label className="text-[10px] font-mono text-muted-foreground">Phone (optional)</Label>
                  <Input value={link.promoter_phone} onChange={e => update(i, 'promoter_phone', e.target.value)}
                    placeholder="+1 555 000 0000" className="mt-1 bg-background border-border/50 text-sm" />
                </div>
                <div>
                  <Label className="text-[10px] font-mono text-muted-foreground">Status</Label>
                  <div className="mt-1 flex rounded-md border border-border/50 overflow-hidden">
                    {['active', 'inactive'].map(s => (
                      <button key={s} type="button" onClick={() => update(i, 'status', s)}
                        className={`flex-1 py-1.5 text-xs font-mono font-bold capitalize transition-all ${link.status === s ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted'}`}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Tracking code */}
              <div>
                <Label className="text-[10px] font-mono text-muted-foreground">Tracking Code (auto-generated or custom)</Label>
                <div className="flex gap-2 mt-1">
                  <Input value={link.tracking_code} onChange={e => update(i, 'tracking_code', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                    placeholder="ABC123" className="font-mono bg-background border-border/50 text-sm flex-1" />
                  <Button type="button" size="sm" variant="outline" onClick={() => regenerateCode(i)} className="shrink-0 text-xs">
                    Regenerate
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => copyLink(i)} className="shrink-0">
                    {copiedIdx === i ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </Button>
                </div>
                {link.tracking_code && (
                  <p className="text-[10px] font-mono text-muted-foreground mt-1">
                    Link: <span className="text-accent">/events/{eventId || '[event-id]'}?seller={link.tracking_code}</span>
                  </p>
                )}
              </div>

              {/* Limits */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[10px] font-mono text-muted-foreground">Max Tickets (0 = unlimited)</Label>
                  <Input type="number" value={link.max_tickets} onChange={e => update(i, 'max_tickets', e.target.value)}
                    placeholder="0" className="mt-1 bg-background border-border/50 text-sm" />
                </div>
                <div>
                  <Label className="text-[10px] font-mono text-muted-foreground">Max Tables (0 = unlimited)</Label>
                  <Input type="number" value={link.max_tables} onChange={e => update(i, 'max_tables', e.target.value)}
                    placeholder="0" className="mt-1 bg-background border-border/50 text-sm" />
                </div>
              </div>

              {/* Custom Pricing */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[10px] font-mono text-muted-foreground">Custom Ticket Price (0 = use event price)</Label>
                  <Input type="number" value={link.custom_ticket_price} onChange={e => update(i, 'custom_ticket_price', e.target.value)}
                    placeholder="0" className="mt-1 bg-background border-border/50 text-sm" />
                </div>
                <div>
                  <Label className="text-[10px] font-mono text-muted-foreground">Custom Table Price (0 = use event price)</Label>
                  <Input type="number" value={link.custom_table_price} onChange={e => update(i, 'custom_table_price', e.target.value)}
                    placeholder="0" className="mt-1 bg-background border-border/50 text-sm" />
                </div>
              </div>

              {/* Commission */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[10px] font-mono text-muted-foreground">Commission Type</Label>
                  <div className="mt-1 flex rounded-md border border-border/50 overflow-hidden">
                    {[{v:'none',l:'None'},{v:'fixed',l:'Fixed $'},{v:'percentage',l:'%'}].map(({v,l}) => (
                      <button key={v} type="button" onClick={() => update(i, 'commission_type', v)}
                        className={`flex-1 py-1.5 text-[10px] font-mono font-bold transition-all ${link.commission_type === v ? 'bg-primary text-primary-foreground' : 'bg-background text-muted-foreground hover:bg-muted'}`}>
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
                {link.commission_type !== 'none' && (
                  <div>
                    <Label className="text-[10px] font-mono text-muted-foreground">
                      {link.commission_type === 'fixed' ? 'Commission ($)' : 'Commission (%)'}
                    </Label>
                    <Input type="number" value={link.commission_value} onChange={e => update(i, 'commission_value', e.target.value)}
                      placeholder="0" className="mt-1 bg-background border-border/50 text-sm" />
                  </div>
                )}
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-[10px] font-mono text-muted-foreground">Start Date (optional)</Label>
                  <Input type="datetime-local" value={link.start_date} onChange={e => update(i, 'start_date', e.target.value)}
                    className="mt-1 bg-background border-border/50 text-sm" />
                </div>
                <div>
                  <Label className="text-[10px] font-mono text-muted-foreground">Expiry Date (optional)</Label>
                  <Input type="datetime-local" value={link.expiry_date} onChange={e => update(i, 'expiry_date', e.target.value)}
                    className="mt-1 bg-background border-border/50 text-sm" />
                </div>
              </div>
            </div>
          ))}

          <Button type="button" variant="outline" size="sm" onClick={add} className="gap-2">
            <Plus className="w-3 h-3" /> Add Promoter Link
          </Button>
        </div>
      )}
    </div>
  );
}