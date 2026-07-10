import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    // Allow both scheduled (service role) and authenticated admin calls
    const isScheduled = req.headers.get("x-scheduled-trigger") === "1";
    if (!isScheduled) {
      const user = await base44.auth.me();
      if (!user || user.role !== "admin") {
        return Response.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const now = new Date().toISOString();
    let raffleActivated = 0, raffleEnded = 0, pollActivated = 0, pollEnded = 0;

    // --- Raffles ---
    // upcoming → active: start_datetime has passed, end_datetime hasn't
    const upcomingRaffles = await base44.asServiceRole.entities.EventRaffle.filter({ status: "upcoming" });
    for (const r of upcomingRaffles) {
      if (r.start_datetime && r.start_datetime <= now && r.end_datetime && r.end_datetime > now) {
        await base44.asServiceRole.entities.EventRaffle.update(r.id, { status: "active" });
        raffleActivated++;
      }
    }

    // active → ended: end_datetime has passed
    const activeRaffles = await base44.asServiceRole.entities.EventRaffle.filter({ status: "active" });
    for (const r of activeRaffles) {
      if (r.end_datetime && r.end_datetime <= now) {
        await base44.asServiceRole.entities.EventRaffle.update(r.id, { status: "ended" });
        raffleEnded++;
      }
    }

    // --- Polls ---
    const upcomingPolls = await base44.asServiceRole.entities.EventPoll.filter({ status: "upcoming" });
    for (const p of upcomingPolls) {
      if (p.start_datetime && p.start_datetime <= now && p.end_datetime && p.end_datetime > now) {
        await base44.asServiceRole.entities.EventPoll.update(p.id, { status: "active" });
        pollActivated++;
      }
    }

    const activePolls = await base44.asServiceRole.entities.EventPoll.filter({ status: "active" });
    for (const p of activePolls) {
      if (p.end_datetime && p.end_datetime <= now) {
        await base44.asServiceRole.entities.EventPoll.update(p.id, { status: "ended" });
        pollEnded++;
      }
    }

    return Response.json({
      ok: true,
      raffleActivated, raffleEnded,
      pollActivated, pollEnded,
      checkedAt: now,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});