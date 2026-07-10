import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { giveaway_id, proof_image_url, proof_link, proof_note } = await req.json();
    if (!giveaway_id) return Response.json({ error: 'giveaway_id is required' }, { status: 400 });

    const giveaway = await base44.asServiceRole.entities.Giveaway.get(giveaway_id).catch(() => null);
    if (!giveaway) return Response.json({ error: 'Giveaway not found' }, { status: 404 });

    if (giveaway.status !== 'active') {
      return Response.json({ error: 'This giveaway is not currently active.' }, { status: 400 });
    }
    if (giveaway.end_date && new Date(giveaway.end_date) < new Date()) {
      return Response.json({ error: 'This giveaway has ended.' }, { status: 400 });
    }

    // Prevent duplicate entries
    const existing = await base44.asServiceRole.entities.GiveawayEntry.filter(
      { giveaway_id, user_email: user.email }, null, 1
    );
    if (existing.length > 0) {
      return Response.json({ error: 'You have already entered this giveaway.' }, { status: 400 });
    }

    const rules = giveaway.eligibility_rules || ['open_to_all'];

    // ── Enforce "Who Can Participate?" eligibility server-side ──
    if (rules.includes('ticket_holders') && giveaway.linked_event_id) {
      const tickets = await base44.asServiceRole.entities.Ticket.filter(
        { event_id: giveaway.linked_event_id, owner_email: user.email }, null, 50
      );
      const hasValidTicket = tickets.some(t => t.status === 'active' || t.status === 'scanned');
      if (!hasValidTicket) {
        return Response.json({ error: 'Only ticket holders for the linked event can enter this giveaway.' }, { status: 403 });
      }
    }

    if (rules.includes('followers') && giveaway.owner_email) {
      let isFollowing = false;
      if (giveaway.owner_type === 'artist') {
        const follows = await base44.asServiceRole.entities.ArtistFollow.filter(
          { follower_email: user.email, artist_id: giveaway.owner_id }, null, 1
        );
        isFollowing = follows.length > 0;
      } else {
        const follows = await base44.asServiceRole.entities.OrganizerFollow.filter(
          { follower_email: user.email, organizer_id: giveaway.owner_id }, null, 1
        );
        isFollowing = follows.length > 0;
      }
      if (!isFollowing) {
        return Response.json({ error: `Only followers of ${giveaway.owner_name || 'the creator'} can enter this giveaway.` }, { status: 403 });
      }
    }

    if (rules.includes('paid_members') && giveaway.owner_id) {
      const subs = await base44.asServiceRole.entities.FanSubscription.filter(
        { fan_email: user.email, artist_id: giveaway.owner_id, status: 'active' }, null, 1
      );
      if (subs.length === 0) {
        return Response.json({ error: `Only paid members of ${giveaway.owner_name || 'the creator'} can enter this giveaway.` }, { status: 403 });
      }
    }

    const requiresProof = giveaway.requires_proof || rules.includes('social_action');
    if (requiresProof && !proof_image_url && !proof_link && !proof_note) {
      return Response.json({ error: 'Please submit proof to enter this giveaway.' }, { status: 400 });
    }

    const needsManualApproval = rules.includes('manual_approval');
    const status = (requiresProof || needsManualApproval) ? 'under_review' : 'submitted';

    const entry = await base44.asServiceRole.entities.GiveawayEntry.create({
      giveaway_id,
      giveaway_title: giveaway.title,
      user_id: user.id,
      user_email: user.email,
      user_name: user.full_name || user.email,
      status,
      proof_image_url: proof_image_url || null,
      proof_link: proof_link || null,
      proof_note: proof_note || null,
    });

    await base44.asServiceRole.entities.Giveaway.update(giveaway_id, {
      total_entries: (giveaway.total_entries || 0) + 1,
      pending_proof_reviews: status === 'under_review' ? (giveaway.pending_proof_reviews || 0) + 1 : (giveaway.pending_proof_reviews || 0),
    });

    return Response.json({ success: true, entry, requiresProof });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});