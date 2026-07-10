import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);

        const body = await req.json();
        const fan_email = body.fan_email || body.data?.user_email;

        if (!fan_email) {
            return Response.json({ error: 'Missing fan_email' }, { status: 400 });
        }

        // Step 1: Find the fan's name
        const fanAccounts = await base44.asServiceRole.entities.LoyaltyAccount.filter(
            { user_email: fan_email }, null, 1
        );
        const fanName = fanAccounts[0]?.user_name || fan_email;

        // Step 2: Find all organizers who have loyalty tiers
        const allTickets = await base44.asServiceRole.entities.Ticket.filter(
            { owner_email: fan_email, status: 'scanned' }, null, 2000
        );

        const eventIds = [...new Set(allTickets.map(t => t.event_id).filter(Boolean))];
        if (eventIds.length === 0) {
            return Response.json({ success: true, message: 'No events attended' });
        }

        const events = await base44.asServiceRole.entities.Event.filter(
            { id: { $in: eventIds } }, null, 200
        );

        const organizerEventIds = {};
        for (const ev of events) {
            if (!organizerEventIds[ev.organizer_id]) {
                organizerEventIds[ev.organizer_id] = new Set();
            }
            organizerEventIds[ev.organizer_id].add(ev.id);
        }

        // Step 3: For each organizer, check if fan reached any tier
        const results = [];
        for (const [organizerId, orgEventIds] of Object.entries(organizerEventIds)) {
            const attendedForOrg = orgEventIds.size;

            const tiers = await base44.asServiceRole.entities.OrganizerLoyaltyTier.filter(
                { organizer_id: organizerId }, 'tier_number', 20
            );

            if (tiers.length === 0) continue;

            const orgEmail = tiers[0].organizer_email;
            const orgName = tiers[0].organizer_name || orgEmail;

            for (const tier of tiers) {
                const required = tier.events_required || 0;
                if (required === 0) continue;
                if (attendedForOrg < required) continue;

                const dedupKey = `${fan_email}|${organizerId}|${tier.id}`;

                const existing = await base44.asServiceRole.entities.LoyaltyRewardStatus.filter(
                    { dedup_key: dedupKey }, null, 1
                );

                if (existing.length > 0) {
                    results.push({ tier: tier.tier_name, action: 'skipped', reason: 'already exists' });
                    continue;
                }

                // Build reward record — include ticket fields for free_ticket rewards
                const rewardData = {
                    fan_email,
                    fan_name: fanName,
                    organizer_id: organizerId,
                    organizer_email: orgEmail,
                    organizer_name: orgName,
                    tier_id: tier.id,
                    tier_name: tier.tier_name,
                    tier_number: tier.tier_number,
                    events_required: required,
                    reward_type: tier.reward_type || 'none',
                    reward_value: tier.reward_value || 0,
                    reward_description: tier.reward_description || '',
                    custom_reward: tier.reward_type === 'custom' ? (tier.custom_reward || '') : '',
                    reached_at: new Date().toISOString(),
                    reward_status: 'pending',
                    dedup_key: dedupKey,
                };

                // Copy ticket configuration for free_ticket rewards
                if (tier.reward_type === 'free_ticket') {
                    rewardData.ticket_event_id = tier.ticket_event_id || '';
                    rewardData.ticket_event_title = tier.ticket_event_title || '';
                    rewardData.ticket_type_id = tier.ticket_type_id || '';
                    rewardData.ticket_type_name = tier.ticket_type_name || '';
                    rewardData.ticket_count = tier.ticket_count || 1;
                    rewardData.auto_generate_ticket = !!tier.auto_generate_ticket;
                    rewardData.ticket_expiry_date = tier.ticket_expiry_date || '';
                    rewardData.reward_message = tier.reward_message || '';
                }

                const rewardRecord = await base44.asServiceRole.entities.LoyaltyRewardStatus.create(rewardData);

                // Auto-generate tickets if configured
                let generatedTickets = [];
                if (tier.reward_type === 'free_ticket' && tier.auto_generate_ticket && tier.ticket_event_id && tier.ticket_type_id) {
                    try {
                        generatedTickets = await generateTickets(base44, rewardRecord, tier, fan_email, fanName);
                        if (generatedTickets.length > 0) {
                            await base44.asServiceRole.entities.LoyaltyRewardStatus.update(rewardRecord.id, {
                                reward_status: 'given',
                                given_at: new Date().toISOString(),
                                given_by: 'system_auto',
                                given_by_name: 'Auto-generated',
                                generated_ticket_ids: generatedTickets,
                                fan_notified: true,
                            });
                        }
                    } catch (e) {
                        console.error('Auto-generate tickets failed:', e.message);
                        // Reward stays pending — organizer can manually send
                    }
                }

                // Notify the organizer
                const rewardLabel = getRewardLabel(tier);
                const ticketInfo = tier.reward_type === 'free_ticket'
                    ? `\n\n🎫 Event: ${tier.ticket_event_title || 'N/A'}\n🎟 Type: ${tier.ticket_type_name || 'N/A'} ×${tier.ticket_count || 1}`
                    : '';
                await base44.asServiceRole.entities.Notification.create({
                    user_email: orgEmail,
                    title: `🎉 ${fanName} reached ${tier.tier_name}!`,
                    message: `${fanName} has attended ${attendedForOrg} of your events and unlocked the "${tier.tier_name}" tier reward: ${rewardLabel}.${ticketInfo}${tier.auto_generate_ticket ? '\n\n✅ Tickets were auto-generated and sent to the fan.' : '\n\nGo to your Loyalty Program to send the tickets.'}`,
                    type: 'general',
                });

                // Notify the fan
                const fanMsg = tier.auto_generate_ticket
                    ? `Congratulations! You've attended ${attendedForOrg} events by ${orgName} and unlocked the "${tier.tier_name}" tier reward: ${rewardLabel}. Your ticket${(tier.ticket_count || 1) > 1 ? 's have' : ' has'} been added to My Tickets!`
                    : `Congratulations! You've attended ${attendedForOrg} events by ${orgName} and unlocked the "${tier.tier_name}" tier reward: ${rewardLabel}. The organizer will send you your ticket soon.`;
                await base44.asServiceRole.entities.Notification.create({
                    user_email: fan_email,
                    title: `🏆 You reached ${tier.tier_name}!`,
                    message: fanMsg,
                    type: 'general',
                });

                results.push({
                    tier: tier.tier_name,
                    action: 'created',
                    reward_status: tier.auto_generate_ticket ? 'given' : 'pending',
                    tickets_generated: generatedTickets.length,
                });
            }
        }

        return Response.json({ success: true, results });

    } catch (error) {
        return Response.json({ error: error.message }, { status: 500 });
    }
});

function getRewardLabel(tier) {
    const labels = {
        free_ticket: 'Event Entry Ticket',
        discount: `Discount (${tier.reward_value || 0}%)`,
        backstage_access: 'Backstage Access',
        credit: `Credit ($${tier.reward_value || 0})`,
        custom: tier.custom_reward || 'Custom Reward',
        none: 'Recognition',
    };
    return labels[tier.reward_type] || tier.reward_type || 'Reward';
}

async function generateTickets(base44, rewardRecord, tier, fanEmail, fanName) {
    const ticketIds = [];
    const count = tier.ticket_count || 1;

    for (let i = 0; i < count; i++) {
        const ticketCode = `LOYALTY-${tier.id?.slice(-6) || '000'}-${fanEmail.slice(0, 3).toUpperCase()}-${i + 1}`;
        const qrData = JSON.stringify({
            ticket_code: ticketCode,
            event_id: tier.ticket_event_id,
            event_title: tier.ticket_event_title,
            ticket_type: tier.ticket_type_name,
            owner: fanEmail,
            source: 'loyalty_reward',
            reward_id: rewardRecord.id,
        });

        const ticket = await base44.asServiceRole.entities.Ticket.create({
            ticket_code: ticketCode,
            event_id: tier.ticket_event_id,
            ticket_type_id: tier.ticket_type_id,
            order_id: `loyalty_${rewardRecord.id}`,
            owner_email: fanEmail,
            owner_name: fanName,
            status: 'active',
            event_title: tier.ticket_event_title,
            ticket_type_name: tier.ticket_type_name,
            price_paid: 0,
            qr_data: qrData,
            purchased_with_loyalty: true,
        });

        ticketIds.push(ticket.id);
    }

    // Update TicketType quantity_sold
    if (ticketIds.length > 0) {
        const ticketTypes = await base44.asServiceRole.entities.TicketType.filter(
            { id: tier.ticket_type_id }, null, 1
        ).catch(() => []);
        const tt = ticketTypes[0];
        if (tt) {
            await base44.asServiceRole.entities.TicketType.update(tt.id, {
                quantity_sold: (tt.quantity_sold || 0) + ticketIds.length,
            }).catch(() => {});
        }
    }

    return ticketIds;
}