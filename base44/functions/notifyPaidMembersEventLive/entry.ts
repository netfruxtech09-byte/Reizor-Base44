import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event_id, event_title, artist_names } = await req.json();

    if (!event_id || !event_title) {
      return Response.json({ error: "Missing event_id or event_title" }, { status: 400 });
    }

    const artists = artist_names || [];
    
    // Find all fans following these artists
    const allFollows = await base44.asServiceRole.entities.ArtistFollow.filter({}, null, 5000).catch(() => []);
    const relevantFollows = allFollows.filter(f => artists.includes(f.artist_name));
    
    if (relevantFollows.length === 0) {
      return Response.json({ success: true, notified: 0 });
    }

    // Get unique fan emails
    const fanEmails = [...new Set(relevantFollows.map(f => f.follower_email))];

    // Check which fans are paid members
    const paidFans = [];
    for (const email of fanEmails) {
      const loyaltyAccounts = await base44.asServiceRole.entities.LoyaltyAccount.filter(
        { user_email: email },
        null,
        1
      ).catch(() => []);
      
      if (loyaltyAccounts.length > 0 && loyaltyAccounts[0].membership_status === "active") {
        paidFans.push(email);
      }
    }

    // Send notifications to paid members only
    const notificationPromises = paidFans.map(email =>
      base44.asServiceRole.entities.Notification.create({
        user_email: email,
        title: `🎫 Early Access: ${event_title} is live!`,
        message: `As a premium member, you get early access to purchase tickets to ${event_title}! Grab yours before they sell out.`,
        type: "general",
        event_id,
        event_title,
      }).catch(() => {})
    );

    await Promise.all(notificationPromises);

    return Response.json({
      success: true,
      notified: paidFans.length,
      message: `Notified ${paidFans.length} paid members`,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});