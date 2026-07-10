import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Find events published approximately 3 days ago (within a 24h window)
    const now = new Date();
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    const fourDaysAgo = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000);

    const allEvents = await base44.asServiceRole.entities.Event.filter(
      { status: "published" },
      "-published_at",
      500
    ).catch(() => []);

    // Filter events published between 3 and 4 days ago
    const targetEvents = allEvents.filter(e => {
      const pub = new Date(e.published_at || e.created_date);
      return pub >= fourDaysAgo && pub <= threeDaysAgo;
    });

    if (targetEvents.length === 0) {
      return Response.json({ success: true, notified: 0, message: "No events published ~3 days ago" });
    }

    let totalNotified = 0;

    for (const event of targetEvents) {
      const artists = event.artists || [];

      // Find all follows for artists on this event
      const allFollows = artists.length > 0
        ? await base44.asServiceRole.entities.ArtistFollow.filter({}, null, 5000).catch(() => [])
        : [];
      const relevantFollows = allFollows.filter(f => artists.includes(f.artist_name));

      // Collect unique fan emails from follows
      const fanEmailsFromFollows = new Set(relevantFollows.map(f => f.follower_email));

      // Also get all users — notify any free fan (not just followers)
      // so that any user who hasn't been notified can discover the event
      const allUsers = await base44.asServiceRole.entities.User.list(null, 2000).catch(() => []);
      const fanUsers = allUsers.filter(u => !u.role || u.role === "user");

      // Determine which are free members
      const freeFanEmails = [];
      for (const u of fanUsers) {
        const email = u.email;
        const loyaltyAccounts = await base44.asServiceRole.entities.LoyaltyAccount.filter(
          { user_email: email }, null, 1
        ).catch(() => []);

        const isFree = loyaltyAccounts.length === 0 || loyaltyAccounts[0].membership_status !== "active";
        if (isFree) {
          freeFanEmails.push(email);
        }
      }

      // Send notifications
      const notificationPromises = freeFanEmails.map(email =>
        base44.asServiceRole.entities.Notification.create({
          user_email: email,
          title: `🎉 ${event.title} — tickets available!`,
          message: `Don't miss out! "${event.title}" at ${event.venue_name}, ${event.city} is on sale now. Upgrade your membership for early access to future events!`,
          type: "general",
          event_id: event.id,
          event_title: event.title,
        }).catch(() => {})
      );

      await Promise.all(notificationPromises);
      totalNotified += freeFanEmails.length;
    }

    return Response.json({
      success: true,
      events_processed: targetEvents.length,
      notified: totalNotified,
      message: `Processed ${targetEvents.length} event(s), notified ${totalNotified} free members`,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});