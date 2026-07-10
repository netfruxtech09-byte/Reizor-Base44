import React, { useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";

/**
 * Runs once on mount after login.
 * Generates smart notifications for the current user based on:
 * - Upcoming events for genres they've attended
 * - Ticket tiers with < 10% remaining (last-minute availability)
 * - Events they've bought tickets to that changed status
 */
// Small helper to avoid hammering the API sequentially
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

export function useNotificationEngine() {
  const { user } = useAuth();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    if (!user) return; // guest — skip entirely, no auth check needed
    ran.current = true;

    (async () => {
      // Delay 8-15s so initial page render completes before any API calls
      await sleep(8000 + Math.random() * 7000);

      // Sequential fetches to avoid parallel rate-limit spikes
      const myTickets = await base44.entities.Ticket.filter({ owner_email: user.email }, "-created_date", 50).catch(() => []);
      await sleep(300);
      const allEvents = await base44.entities.Event.filter({ status: "published" }, "-created_date", 50).catch(() => []);
      await sleep(300);
      const ticketTypes = await base44.entities.TicketType.list("sort_order", 100).catch(() => []);
      await sleep(300);

      await sleep(500);
      const existingNotifs = await base44.entities.Notification.filter(
        { user_email: user.email }, "-created_date", 100
      ).catch(() => []);

      const alreadySent = new Set(existingNotifs.map((n) => n.title + "|" + n.message));

      const send = async (notif) => {
        const key = notif.title + "|" + notif.message;
        if (alreadySent.has(key)) return;
        alreadySent.add(key);
        await sleep(200); // throttle each write
        await base44.entities.Notification.create({ ...notif, user_email: user.email }).catch(() => {});
      };

      // Skip notification generation for brand-new accounts (created within the last 5 minutes)
      // to avoid noise on first signup before any preferences/tickets exist.
      const accountAge = user.created_date
        ? Date.now() - new Date(user.created_date).getTime()
        : Infinity;
      const isNewAccount = accountAge < 5 * 60 * 1000; // 5 minutes
      if (isNewAccount) return;

      // 1. Last-minute ticket availability — tiers < 10% remaining
      const urgentTiers = ticketTypes.filter((tt) => {
        if (tt.status !== "active" || !tt.quantity_total) return false;
        const remaining = tt.quantity_total - (tt.quantity_sold || 0);
        const pct = remaining / tt.quantity_total;
        return pct > 0 && pct <= 0.1 && remaining <= 20;
      });

      for (const tier of urgentTiers.slice(0, 3)) {
        const event = allEvents.find((e) => e.id === tier.event_id);
        if (!event) continue;
        const remaining = tier.quantity_total - (tier.quantity_sold || 0);
        await send({
          type: "ticket_available",
          title: `Almost sold out: ${event.title}`,
          message: `Only ${remaining} ${tier.name} ticket${remaining === 1 ? "" : "s"} left. Grab yours before they're gone!`,
          event_id: event.id,
          event_title: event.title,
          link: `/events/${event.id}`,
        });
      }

      // 2. Genre preference-based recommendations + location matching
      const attendedEventIds = new Set(myTickets.map((t) => t.event_id));

      // Use explicitly saved genre preferences first, fall back to attendance history
      // Don't infer genres for users with no tickets — they have no real history yet
      let targetGenres = user.preferred_genres || [];
      if (targetGenres.length === 0 && myTickets.length === 0) {
        // New user with no preferences and no tickets — skip recommendations entirely
      } else if (targetGenres.length === 0) {
        const attendedEvents = allEvents.filter((e) => attendedEventIds.has(e.id));
        const genreCounts = {};
        attendedEvents.forEach((e) => {
          if (e.genre) genreCounts[e.genre] = (genreCounts[e.genre] || 0) + 1;
        });
        targetGenres = Object.entries(genreCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([g]) => g);
      }

      const userCity = (user.city || "").toLowerCase().trim();

      if (targetGenres.length > 0) {
        const recommended = allEvents
          .filter((e) => targetGenres.includes(e.genre) && !attendedEventIds.has(e.id))
          .sort((a, b) => {
            // Prioritise city matches
            const aMatch = userCity && (e => e.city?.toLowerCase().includes(userCity))(a);
            const bMatch = userCity && (e => e.city?.toLowerCase().includes(userCity))(b);
            if (aMatch && !bMatch) return -1;
            if (!aMatch && bMatch) return 1;
            return 0;
          })
          .slice(0, 3);

        for (const event of recommended) {
          const genreLabel = event.genre.replace(/_/g, " ").toUpperCase();
          const isNearby = userCity && event.city?.toLowerCase().includes(userCity);
          await send({
            type: "recommendation",
            title: isNearby
              ? `${genreLabel} event near you: ${event.title}`
              : `Upcoming ${genreLabel}: ${event.title}`,
            message: isNearby
              ? `A ${genreLabel} event is coming to ${event.city} — ${event.venue_name}. Don't miss it!`
              : `Based on your taste — ${event.venue_name}, ${event.city}.`,
            event_id: event.id,
            event_title: event.title,
            link: `/events/${event.id}`,
          });
        }
      }

      // 3. Event updates — events user has tickets to that are cancelled/sold_out
      const myEventIds = [...attendedEventIds];
      const updatedEvents = allEvents.filter(
        (e) => myEventIds.includes(e.id) && ["cancelled", "sold_out"].includes(e.status)
      );

      for (const event of updatedEvents) {
        await send({
          type: "event_update",
          title: `Update: ${event.title}`,
          message: event.status === "cancelled"
            ? `This event has been cancelled. Contact the organizer for refund details.`
            : `${event.title} is now sold out. Your existing tickets are still valid.`,
          event_id: event.id,
          event_title: event.title,
          link: `/events/${event.id}`,
        });
      }

      // 4. 24-hour reminder emails for upcoming events
      const now = new Date();
      const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);

      const upcomingTickets = myTickets.filter((t) => t.status === "active");
      const upcomingEventIds = [...new Set(upcomingTickets.map((t) => t.event_id))];

      for (const eventId of upcomingEventIds) {
        const event = allEvents.find((e) => e.id === eventId);
        if (!event || !event.date) continue;
        const eventDate = new Date(event.date);
        if (eventDate < in24h || eventDate > in48h) continue; // only the 24-48h window

        const eventTickets = upcomingTickets.filter((t) => t.event_id === eventId);
        const ticketList = eventTickets.map((t) =>
          `• ${t.ticket_type_name} — Code: ${t.ticket_code}`
        ).join("\n");

        const reminderKey = `24h-reminder-${eventId}-${user.email}`;
        const alreadyReminded = existingNotifs.some((n) => n.message?.includes(reminderKey));
        if (alreadyReminded) continue;

        await base44.integrations.Core.SendEmail({
          to: user.email,
          subject: `⏰ Tomorrow: ${event.title}`,
          body: `Hi ${user.full_name || "there"},\n\nThis is your 24-hour reminder that ${event.title} is tomorrow!\n\n📍 ${event.venue_name}${event.venue_address ? ", " + event.venue_address : ""}\n🏙️ ${event.city}\n🕐 Doors: ${event.doors_open || "Check event page"}\n\nYour tickets:\n${ticketList}\n\nSee you there! 🎉\n\n[ref:${reminderKey}]`,
        });

        await send({
          type: "event_update",
          title: `Tomorrow: ${event.title}`,
          message: `Your event is tomorrow at ${event.venue_name}. Check your email for ticket details. [ref:${reminderKey}]`,
          event_id: event.id,
          event_title: event.title,
          link: `/events/${event.id}`,
        });
      }

      // 5. Saved event reminders — events coming up in the next 7 days
      const savedEntries = await base44.entities.SavedEvent.filter({ user_email: user.email }, null, 50).catch(() => []);
      const in7days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      for (const saved of savedEntries) {
        const event = allEvents.find((e) => e.id === saved.event_id);
        if (!event || !event.date) continue;
        const eventDate = new Date(event.date);
        if (eventDate < now || eventDate > in7days) continue;
        if (attendedEventIds.has(event.id)) continue;

        const daysAway = Math.ceil((eventDate - now) / (1000 * 60 * 60 * 24));
        const savedKey = `saved-reminder-${event.id}-${user.email}`;
        const alreadyReminded = existingNotifs.some((n) => n.message?.includes(savedKey));
        if (alreadyReminded) continue;

        await base44.integrations.Core.SendEmail({
          to: user.email,
          subject: `📌 Saved event coming up: ${event.title}`,
          body: `Hi ${user.full_name || "there"},\n\nA saved event is coming up in ${daysAway} day${daysAway === 1 ? "" : "s"}!\n\n🎉 ${event.title}\n📍 ${event.venue_name}, ${event.city}\n📅 ${eventDate.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}\n🕐 Doors: ${event.doors_open || "Check event page"}\n\nDon't forget to grab your tickets before they sell out!\n\nView event: ${window.location.origin}/events/${event.id}\n\n[ref:${savedKey}]`,
        });

        await send({
          type: "recommendation",
          title: `Saved event in ${daysAway}d: ${event.title}`,
          message: `${event.venue_name}, ${event.city} — Don't forget to grab tickets! [ref:${savedKey}]`,
          event_id: event.id,
          event_title: event.title,
          link: `/events/${event.id}`,
        });
      }

      // 6. New events in user's city matching their genre preferences
      const userLiveCity = (() => {
        try {
          const stored = sessionStorage.getItem("reizor_live_city");
          return stored || userCity;
        } catch { return userCity; }
      })();

      // Only send nearby event alerts if the user has explicitly set genre preferences
      if (targetGenres.length > 0 && userLiveCity) {
        const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
        const newNearbyEvents = allEvents.filter((e) => {
          const isNew = e.created_date && new Date(e.created_date) >= twoDaysAgo;
          const isNearby = e.city?.toLowerCase().includes(userLiveCity.toLowerCase());
          const matchesGenre = targetGenres.includes(e.genre);
          const notAttended = !attendedEventIds.has(e.id);
          return isNew && isNearby && matchesGenre && notAttended;
        });

        for (const event of newNearbyEvents.slice(0, 3)) {
          const genreLabel = event.genre?.replace(/_/g, " ").toUpperCase() || "EVENT";
          const newEventKey = `new-local-event-${event.id}-${user.email}`;
          const alreadyNotified = existingNotifs.some((n) => n.message?.includes(newEventKey));
          if (alreadyNotified) continue;

          await send({
            type: "recommendation",
            title: `🔥 New ${genreLabel} event near you!`,
            message: `${event.title} just dropped in ${event.city} — ${event.venue_name}. Grab your tickets early! [ref:${newEventKey}]`,
            event_id: event.id,
            event_title: event.title,
            link: `/events/${event.id}`,
          });
          await base44.integrations.Core.SendEmail({
            to: user.email,
            subject: `🔥 New ${genreLabel} event in ${event.city}: ${event.title}`,
            body: `Hi ${user.full_name || "there"},\n\nA brand new event just dropped near you that matches your taste!\n\n🎉 ${event.title}\n🎵 Genre: ${genreLabel}\n📍 ${event.venue_name}, ${event.city}\n📅 ${event.date ? new Date(event.date).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" }) : "TBA"}\n${event.min_price != null ? `🎟️ From $${event.min_price}` : ""}\n\nDon't miss out — tickets could sell fast!\n\nView & buy tickets: ${window.location.origin}/events/${event.id}\n\n[ref:${newEventKey}]`,
          }).catch(() => {});
        }
      }
    })();
  }, [user?.email]); // re-evaluate when user becomes available

  // Detect live location and cache city — only ask once, check permission state first
  useEffect(() => {
    if (sessionStorage.getItem("reizor_live_city")) return;
    if (!navigator.geolocation) return;

    const doGeoLookup = () => {
      navigator.geolocation.getCurrentPosition(async (pos) => {
        const { latitude, longitude } = pos.coords;
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`).catch(() => null);
        if (!res) return;
        const data = await res.json();
        const city = data.address?.city || data.address?.town || data.address?.village || "";
        if (city) sessionStorage.setItem("reizor_live_city", city);
      }, () => {});
    };

    // Use Permissions API if available to avoid triggering popup when already denied/not-needed
    if (navigator.permissions) {
      navigator.permissions.query({ name: "geolocation" }).then((result) => {
        if (result.state === "granted") {
          // Already granted — silently get location, no popup
          doGeoLookup();
        } else if (result.state === "prompt") {
          // Only ask once — check if we've asked before
          if (!localStorage.getItem("reizor_geo_asked")) {
            localStorage.setItem("reizor_geo_asked", "1");
            doGeoLookup();
          }
        }
        // If "denied" — do nothing, don't ask again
      }).catch(() => {
        // Permissions API not supported, fall back to asking once
        if (!localStorage.getItem("reizor_geo_asked")) {
          localStorage.setItem("reizor_geo_asked", "1");
          doGeoLookup();
        }
      });
    } else {
      // No Permissions API — ask once only
      if (!localStorage.getItem("reizor_geo_asked")) {
        localStorage.setItem("reizor_geo_asked", "1");
        doGeoLookup();
      }
    }
  }, []);
}