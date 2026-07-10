import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import EmailMarketingManager from '../../components/organizer/EmailMarketingManager';

export default function OrganizerEmailMarketing() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display font-black text-3xl sm:text-4xl tracking-tight">Email Marketing Automation</h1>
        <p className="text-sm text-muted-foreground mt-1">Create automated email campaigns based on attendee behavior</p>
      </div>

      {user && <EmailMarketingManager organizerId={user.id} />}
    </div>
  );
}