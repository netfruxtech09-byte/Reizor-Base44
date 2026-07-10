import { useState, useEffect } from 'react';
import { Mail, Plus, Send, Edit2, Trash2, Eye, BarChart3, ImagePlus, X, Calendar, Users, CheckCircle2, Clock } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { EMAIL_TEMPLATES } from './EmailMarketingTemplates';

const TYPE_META = {
  cart_abandonment:        { label: 'Cart Abandonment',    color: 'text-orange-400 bg-orange-400/10 border-orange-400/20' },
  post_event_thank_you:    { label: 'Post-Event Thanks',   color: 'text-green-400 bg-green-400/10 border-green-400/20' },
  upcoming_event_reminder: { label: 'Event Reminder',      color: 'text-blue-400 bg-blue-400/10 border-blue-400/20' },
  re_engagement:           { label: 'Re-engagement',       color: 'text-pink-400 bg-pink-400/10 border-pink-400/20' },
  new_event_announcement:  { label: 'New Announcement',    color: 'text-accent bg-accent/10 border-accent/20' },
};

const BLANK_FORM = {
  campaign_type: 'cart_abandonment',
  name: '',
  subject_line: '',
  email_body: '',
  event_id: '',
  flyer_url: '',
  target_country: '',
  target_state: '',
  target_city: '',
  is_active: true,
};

export default function EmailMarketingManager({ organizerId }) {
  const [campaigns, setCampaigns] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(BLANK_FORM);
  const [sending, setSending] = useState(null); // campaign id being sent
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [uploadingFlyer, setUploadingFlyer] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      const [camps, evs] = await Promise.all([
        base44.entities.EmailCampaign.filter({ organizer_id: organizerId }, '-created_date', 100),
        base44.entities.Event.filter({ organizer_id: organizerId }, '-created_date', 100),
      ]);
      setCampaigns(camps);
      setEvents(evs);
      setLoading(false);
    };
    load();
  }, [organizerId]);

  const openNew = () => {
    setEditingId(null);
    setFormData(BLANK_FORM);
    setShowForm(true);
  };

  const handleTemplateSelect = (type) => {
    const template = EMAIL_TEMPLATES[type];
    setFormData(f => ({
      ...f,
      campaign_type: type,
      name: template.name,
      subject_line: template.subject_line,
      email_body: template.email_body,
    }));
  };

  const handleSave = async () => {
    if (!formData.name || !formData.subject_line || !formData.email_body || !formData.event_id) {
      toast.error('Please fill in all required fields');
      return;
    }
    setSaving(true);
    const user = await base44.auth.me();
    const event = events.find(e => e.id === formData.event_id);
    try {
      if (editingId) {
        await base44.entities.EmailCampaign.update(editingId, formData);
        setCampaigns(prev => prev.map(c => c.id === editingId ? { ...c, ...formData } : c));
        toast.success('Campaign updated');
      } else {
        const c = await base44.entities.EmailCampaign.create({
          ...formData,
          organizer_id: organizerId,
          organizer_email: user.email,
          event_title: event?.title || '',
        });
        setCampaigns(prev => [c, ...prev]);
        toast.success('Campaign created');
      }
      setShowForm(false);
      setEditingId(null);
      setFormData(BLANK_FORM);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this campaign?')) return;
    try {
      await base44.entities.EmailCampaign.delete(id);
      setCampaigns(prev => prev.filter(c => c.id !== id));
      toast.success('Campaign deleted');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleSendNow = async (campaign) => {
    setSending(campaign.id);
    try {
      const res = await base44.functions.invoke('triggerEmailCampaign', { campaign_id: campaign.id });
      toast.success(`Sent to ${res.data.emails_sent} recipients`);
      setCampaigns(prev => prev.map(c => c.id === campaign.id
        ? { ...c, sent_at: new Date().toISOString(), last_triggered: new Date().toISOString() }
        : c
      ));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSending(null);
    }
  };

  const handleEdit = (campaign) => {
    setEditingId(campaign.id);
    setFormData({
      campaign_type: campaign.campaign_type,
      name: campaign.name,
      subject_line: campaign.subject_line,
      email_body: campaign.email_body,
      event_id: campaign.event_id,
      flyer_url: campaign.flyer_url || '',
      target_country: campaign.target_country || '',
      target_state: campaign.target_state || '',
      target_city: campaign.target_city || '',
      is_active: campaign.is_active,
    });
    setShowForm(true);
  };

  const handleFlyerUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('Flyer must be under 5 MB'); e.target.value = ''; return; }
    setUploadingFlyer(true);
    const res = await base44.integrations.Core.UploadFile({ file });
    setFormData(f => ({ ...f, flyer_url: res.file_url }));
    setUploadingFlyer(false);
  };

  const handleToggleActive = async (id, current) => {
    try {
      await base44.entities.EmailCampaign.update(id, { is_active: !current });
      setCampaigns(prev => prev.map(c => c.id === id ? { ...c, is_active: !current } : c));
      toast.success(current ? 'Campaign paused' : 'Campaign activated');
    } catch (err) {
      toast.error(err.message);
    }
  };

  if (loading) return (
    <div className="flex justify-center py-16">
      <div className="w-7 h-7 border-2 border-muted border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-display font-black text-2xl tracking-tight">Email Campaigns</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {campaigns.length === 0 ? 'No campaigns yet' : `${campaigns.length} campaign${campaigns.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        {campaigns.length > 0 && (
          <Button onClick={openNew} className="glow-lime font-display font-bold gap-2 shrink-0">
            <Plus className="w-4 h-4" /> New Campaign
          </Button>
        )}
      </div>

      {/* Empty state */}
      {campaigns.length === 0 ? (
        <div className="py-16 rounded-2xl bg-card border border-border/50 text-center space-y-4 px-6">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <Mail className="w-8 h-8 text-primary/60" />
          </div>
          <div>
            <p className="font-bold text-lg">No campaigns yet</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">Create your first email campaign to start engaging your attendees.</p>
          </div>
          <Button onClick={openNew} className="gap-2">
            <Plus className="w-4 h-4" /> Create First Campaign
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {campaigns.map(c => {
            const event = events.find(e => e.id === c.event_id);
            const typeMeta = TYPE_META[c.campaign_type] || { label: c.campaign_type?.replace(/_/g, ' '), color: 'text-muted-foreground bg-muted border-border/50' };
            const isSendingThis = sending === c.id;

            return (
              <div key={c.id} className="rounded-2xl bg-card border border-border/50 overflow-hidden">
                {/* Card body */}
                <div className="p-4 sm:p-5 space-y-3">
                  {/* Row 1: title + badges */}
                  <div className="flex items-start gap-3 justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center flex-wrap gap-2 mb-1.5">
                        <h3 className="font-bold text-base leading-tight">{c.name}</h3>
                        <span className={`text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-full border ${typeMeta.color}`}>
                          {typeMeta.label}
                        </span>
                        {c.sent_at && (
                          <span className="text-[10px] font-mono font-bold uppercase px-2 py-0.5 rounded-full border text-green-400 bg-green-400/10 border-green-400/20">
                            Sent
                          </span>
                        )}
                      </div>
                      {/* Subject line */}
                      <p className="text-sm text-foreground/80 font-medium truncate">"{c.subject_line}"</p>
                    </div>
                  </div>

                  {/* Row 2: event + sent info */}
                  <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 shrink-0 text-accent/70" />
                      {event?.title || 'No event linked'}
                    </span>
                    {c.sent_at && (
                      <span className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-green-400" />
                        Sent {format(new Date(c.sent_at), 'MMM d, yyyy')}
                      </span>
                    )}
                    {!c.sent_at && (
                      <span className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 shrink-0 text-muted-foreground/50" />
                        Not sent yet
                      </span>
                    )}
                  </div>

                  {/* Row 3: stats if available */}
                  {c.sent_at && (c.recipient_count || c.opened_count || c.clicked_count) && (
                    <div className="flex gap-3 sm:gap-6 pt-1">
                      {[
                        { label: 'Recipients', value: c.recipient_count || 0, icon: Users },
                        { label: 'Opened', value: c.opened_count || 0, icon: Eye },
                        { label: 'Clicked', value: c.clicked_count || 0, icon: BarChart3 },
                      ].map(({ label, value, icon: Icon }) => (
                        <div key={label} className="text-center">
                          <p className="font-bold text-sm">{value}</p>
                          <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wide">{label}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Action bar */}
                <div className="flex items-center gap-2 sm:gap-3 px-4 py-3 border-t border-border/40 bg-secondary/20 flex-wrap justify-between sm:justify-start">
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => handleEdit(c)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/50 hover:border-primary/40 text-xs text-muted-foreground hover:text-foreground transition-colors min-h-[36px]">
                      <Edit2 className="w-3.5 h-3.5" /><span>Edit</span>
                    </button>
                    <button
                      onClick={() => setSelectedCampaign(c)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/50 hover:border-accent/50 text-xs text-muted-foreground hover:text-accent transition-colors min-h-[36px]">
                      <Eye className="w-3.5 h-3.5" /><span>Preview</span>
                    </button>
                    <button
                      onClick={() => handleSendNow(c)}
                      disabled={!!isSendingThis}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-primary/40 bg-primary/10 hover:bg-primary/20 text-xs text-primary transition-colors min-h-[36px] disabled:opacity-50">
                      <Send className="w-3.5 h-3.5" />
                      <span>{isSendingThis ? 'Sending...' : 'Send Now'}</span>
                    </button>
                  </div>
                  <button
                    onClick={() => handleDelete(c.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-destructive/30 text-xs text-destructive hover:bg-destructive/10 transition-colors min-h-[36px]">
                    <Trash2 className="w-3.5 h-3.5" /><span>Delete</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Create / Edit Campaign Dialog ── */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="bg-card border-border max-w-2xl w-[95vw] max-h-[92vh] overflow-y-auto p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/40">
            <DialogTitle className="font-display font-black text-xl">
              {editingId ? 'Edit Campaign' : 'New Email Campaign'}
            </DialogTitle>
            <p className="text-sm text-muted-foreground mt-0.5">
              {editingId ? 'Update your campaign details below.' : 'Choose a template and fill in the details.'}
            </p>
          </DialogHeader>

          <div className="px-6 py-5 space-y-6">
            {/* Template picker */}
            <div>
              <Label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Campaign Type</Label>
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {Object.entries(EMAIL_TEMPLATES).map(([key, template]) => (
                  <button key={key} onClick={() => handleTemplateSelect(key)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      formData.campaign_type === key
                        ? 'border-primary bg-primary/10 ring-1 ring-primary/30'
                        : 'border-border/50 hover:border-primary/40 bg-secondary/30'
                    }`}>
                    <p className="font-bold text-sm">{template.name}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{template.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Event + Name */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Event <span className="text-destructive">*</span></Label>
                <select
                  value={formData.event_id}
                  onChange={e => setFormData(f => ({ ...f, event_id: e.target.value }))}
                  className="mt-1.5 w-full rounded-lg bg-secondary border border-border/50 px-3 py-2.5 text-sm focus:outline-none focus:border-primary transition-colors">
                  <option value="">Select an event...</option>
                  {events.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Campaign Name <span className="text-destructive">*</span></Label>
                <Input
                  value={formData.name}
                  onChange={e => setFormData(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g., Summer Festival Blast"
                  className="mt-1.5 bg-secondary border-border/50" />
              </div>
            </div>

            {/* Subject line */}
            <div>
              <Label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Subject Line <span className="text-destructive">*</span></Label>
              <Input
                value={formData.subject_line}
                onChange={e => setFormData(f => ({ ...f, subject_line: e.target.value }))}
                placeholder="Use {{event_name}}, {{attendee_name}} as variables"
                className="mt-1.5 bg-secondary border-border/50" />
            </div>

            {/* Email body */}
            <div>
              <Label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Email Body <span className="text-destructive">*</span></Label>
              <textarea
                value={formData.email_body}
                onChange={e => setFormData(f => ({ ...f, email_body: e.target.value }))}
                placeholder="Write your email content here..."
                className="mt-1.5 w-full rounded-lg bg-secondary border border-white/25 px-3 py-2.5 text-sm resize-y focus:outline-none focus:border-primary transition-colors min-h-[160px]"
                rows={8}
              />
            </div>

            {/* Flyer upload */}
            <div>
              <Label className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Flyer Image <span className="text-muted-foreground font-normal normal-case">(optional)</span></Label>
              <p className="text-[11px] text-muted-foreground mt-0.5 mb-2">Embed a flyer above the email body (JPG/PNG, max 5 MB)</p>
              {formData.flyer_url ? (
                <div className="relative rounded-xl overflow-hidden border border-border/50 bg-secondary">
                  <img src={formData.flyer_url} alt="Flyer" className="w-full max-h-52 object-contain" />
                  <button
                    onClick={() => setFormData(f => ({ ...f, flyer_url: '' }))}
                    className="absolute top-2 right-2 w-8 h-8 rounded-full bg-destructive/90 hover:bg-destructive flex items-center justify-center">
                    <X className="w-4 h-4 text-white" />
                  </button>
                </div>
              ) : (
                <label className={`flex flex-col items-center gap-2 px-4 py-6 rounded-xl border-2 border-dashed border-border/40 hover:border-primary/40 cursor-pointer transition-colors bg-secondary/30 text-center ${uploadingFlyer ? 'opacity-60 pointer-events-none' : ''}`}>
                  <ImagePlus className="w-6 h-6 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">{uploadingFlyer ? 'Uploading...' : 'Click to upload flyer'}</span>
                  <span className="text-[10px] text-muted-foreground/60 font-mono">JPG, PNG · max 5 MB</span>
                  <input type="file" accept="image/*" onChange={handleFlyerUpload} className="hidden" />
                </label>
              )}
            </div>

            {/* Location targeting (new_event_announcement only) */}
            {formData.campaign_type === 'new_event_announcement' && (
              <div className="p-4 rounded-xl bg-accent/5 border border-accent/20 space-y-3">
                <div>
                  <p className="text-xs font-mono font-bold text-accent uppercase tracking-wider">Location Targeting <span className="font-normal normal-case">(optional)</span></p>
                  <p className="text-[11px] text-muted-foreground mt-1">Leave blank to reach all Reizor users, or target by location.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { key: 'target_country', label: 'Country', placeholder: 'e.g. USA' },
                    { key: 'target_state', label: 'State', placeholder: 'e.g. NY' },
                    { key: 'target_city', label: 'City', placeholder: 'e.g. New York' },
                  ].map(({ key, label, placeholder }) => (
                    <div key={key}>
                      <Label className="text-xs font-mono text-muted-foreground">{label}</Label>
                      <Input
                        value={formData[key]}
                        onChange={e => setFormData(f => ({ ...f, [key]: e.target.value }))}
                        placeholder={placeholder}
                        className="mt-1 bg-secondary border-border/50" />
                    </div>
                  ))}
                </div>
                <p className="text-[11px] font-mono text-accent">
                  {(formData.target_country || formData.target_state || formData.target_city)
                    ? `📍 Targeting: ${[formData.target_city, formData.target_state, formData.target_country].filter(Boolean).join(', ')}`
                    : '🌍 Audience: All Reizor platform users'}
                </p>
              </div>
            )}


          </div>

          {/* Footer buttons */}
          <div className="px-6 pb-6 pt-2 flex flex-col sm:flex-row gap-3 border-t border-border/40">
            <Button onClick={handleSave} disabled={saving} className="flex-1 glow-lime font-display font-bold h-11">
              {saving ? 'Saving...' : editingId ? 'Update Campaign' : 'Save Campaign'}
            </Button>
            <Button variant="outline" onClick={() => setShowForm(false)} className="sm:w-32 h-11">
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Preview Dialog ── */}
      {selectedCampaign && (
        <Dialog open={!!selectedCampaign} onOpenChange={() => setSelectedCampaign(null)}>
          <DialogContent className="bg-card border-border max-w-xl w-[95vw] max-h-[92vh] overflow-y-auto p-0">
            <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/40">
              <DialogTitle className="font-display font-black text-xl">Campaign Preview</DialogTitle>
              <p className="text-sm text-muted-foreground mt-0.5">{selectedCampaign.name}</p>
            </DialogHeader>

            <div className="px-6 py-5 space-y-4">
              {/* Subject */}
              <div className="p-4 rounded-xl bg-secondary/40 border border-border/40 space-y-1">
                <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Subject Line</p>
                <p className="font-bold text-base">{selectedCampaign.subject_line}</p>
              </div>

              {/* Campaign type */}
              <div className="flex flex-wrap gap-2">
                {(() => {
                  const meta = TYPE_META[selectedCampaign.campaign_type] || { label: selectedCampaign.campaign_type?.replace(/_/g, ' '), color: 'text-muted-foreground bg-muted border-border/50' };
                  return (
                    <span className={`text-[10px] font-mono font-bold uppercase px-2.5 py-1 rounded-full border ${meta.color}`}>{meta.label}</span>
                  );
                })()}
                {selectedCampaign.sent_at && (
                  <span className="text-[10px] font-mono font-bold uppercase px-2.5 py-1 rounded-full border text-green-400 bg-green-400/10 border-green-400/20">Sent</span>
                )}
              </div>

              {/* Flyer */}
              {selectedCampaign.flyer_url && (
                <div>
                  <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-2">Flyer</p>
                  <img src={selectedCampaign.flyer_url} alt="Flyer" className="w-full rounded-xl object-contain max-h-64 border border-border/50" />
                </div>
              )}

              {/* Body */}
              <div>
                <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-2">Email Body</p>
                <div className="p-4 rounded-xl bg-secondary/30 border border-border/40">
                  <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground/90">{selectedCampaign.email_body}</p>
                </div>
              </div>

              {/* Stats */}
              {selectedCampaign.sent_at && (
                <div className="p-4 rounded-xl bg-secondary/30 border border-border/40 space-y-3">
                  <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Send Stats</p>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'Recipients', value: selectedCampaign.recipient_count || 0 },
                      { label: 'Opened', value: selectedCampaign.opened_count || 0 },
                      { label: 'Clicked', value: selectedCampaign.clicked_count || 0 },
                    ].map(({ label, value }) => (
                      <div key={label} className="text-center p-3 rounded-lg bg-secondary/40">
                        <p className="font-bold text-lg">{value}</p>
                        <p className="text-[10px] font-mono text-muted-foreground uppercase mt-0.5">{label}</p>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground font-mono">
                    Last sent: {format(new Date(selectedCampaign.sent_at), 'MMM d, yyyy · h:mm a')}
                  </p>
                </div>
              )}
            </div>

            <div className="px-6 pb-6 pt-2 flex gap-3 border-t border-border/40">
              <Button onClick={() => { setSelectedCampaign(null); handleEdit(selectedCampaign); }} variant="outline" className="flex-1 h-11">
                <Edit2 className="w-4 h-4 mr-2" /> Edit
              </Button>
              <Button onClick={() => setSelectedCampaign(null)} className="flex-1 h-11">
                Close
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}