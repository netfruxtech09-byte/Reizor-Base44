import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

// Editable artist profile fields managed by this flow.
const EDITABLE_FIELDS = [
  "display_name", "bio", "genre", "profile_image",
  "city", "state", "country", "location",
  "contact_email", "website", "instagram", "twitter",
  "soundcloud", "spotify", "tiktok",
];

const FIELD_LABELS = {
  display_name: "Artist Name",
  bio: "Bio",
  genre: "Genres",
  profile_image: "Profile Image",
  city: "City",
  state: "State / Region",
  country: "Country",
  location: "Location",
  contact_email: "Contact Email",
  website: "Website",
  instagram: "Instagram",
  twitter: "Twitter / X",
  soundcloud: "SoundCloud",
  spotify: "Spotify",
  tiktok: "TikTok",
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { artist_id, pending_data } = body || {};
    if (!artist_id || !pending_data || typeof pending_data !== 'object') {
      return Response.json({ error: 'Invalid request' }, { status: 400 });
    }

    // Load the artist (service role so RLS does not block the read)
    let artist;
    try {
      const artists = await base44.asServiceRole.entities.Artist.filter({ id: artist_id }, null, 1);
      artist = artists?.[0];
    } catch (_e) {
      return Response.json({ error: 'Artist not found' }, { status: 404 });
    }
    if (!artist) return Response.json({ error: 'Artist not found' }, { status: 404 });

    // Ownership: only the artist's own account (or an admin) may submit edits.
    if (artist.user_email !== user.email && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Snapshot the current live approved values for before/after comparison.
    const original_data = {};
    for (const f of EDITABLE_FIELDS) original_data[f] = artist[f] ?? "";

    // Keep only editable fields in the pending payload.
    const cleanPending = {};
    for (const f of EDITABLE_FIELDS) cleanPending[f] = pending_data[f] ?? original_data[f];

    // Compute which fields actually changed (string compare).
    const changed_fields = EDITABLE_FIELDS.filter((f) => {
      const a = String(original_data[f] ?? "");
      const b = String(cleanPending[f] ?? "");
      return a !== b;
    });

    const record = {
      artist_id,
      artist_email: artist.user_email,
      artist_name: cleanPending.display_name || artist.display_name || "",
      submitted_by_name: user.full_name || user.email,
      pending_data: cleanPending,
      original_data,
      changed_fields,
      status: "pending_review",
      rejection_reason: "",
    };

    // Deduplicate: if a pending request already exists for this artist, update it
    // (this lets the artist edit/resubmit without creating duplicate requests).
    const existing = await base44.asServiceRole.entities.ArtistProfileEdit
      .filter({ artist_id, status: "pending_review" }, "-created_date", 1).catch(() => []);

    let saved;
    let isResubmit = false;
    if (existing && existing[0]) {
      isResubmit = true;
      saved = await base44.asServiceRole.entities.ArtistProfileEdit.update(existing[0].id, record);
    } else {
      saved = await base44.asServiceRole.entities.ArtistProfileEdit.create(record);
    }

    // ── Notify admins (in-app + email) ──────────────────────────────────────
    // Fire-and-forget: never block the profile-edit submission on notification
    // failures. Errors are logged but swallowed.
    try {
      const editId = saved?.id;
      const artistName = record.artist_name || artist.display_name || "Artist";
      const submittedAt = new Date().toLocaleString("en-US", {
        weekday: "short", year: "numeric", month: "short", day: "numeric",
        hour: "numeric", minute: "2-digit",
      });
      const reviewLink = `/admin/artists?section=profile_edits&edit=${editId}`;
      const reviewUrl = `${Deno.env.get("BASE44_APP_URL") || "https://onyx-ticket-pulse.base44.app"}${reviewLink}`;
      const changedSummary = changed_fields.length
        ? changed_fields.map((f) => FIELD_LABELS[f] || f).join(", ")
        : "No field changes detected";

      const allUsers = await base44.asServiceRole.entities.User.list(null, 500).catch(() => []);
      const admins = allUsers.filter((u) => u.role === "admin");

      await Promise.all(admins.map(async (admin) => {
        // In-app notification — dedup per admin per pending request via the
        // stable review link. On resubmit, refresh the existing notification
        // instead of creating a duplicate.
        const existingNotifs = await base44.asServiceRole.entities.Notification.filter({
          user_email: admin.email,
          link: reviewLink,
        }, null, 20).catch(() => []);

        const prior = existingNotifs.find((n) => n.title === "Artist Profile Update Pending Review");
        const notifMsg = `${artistName} submitted profile changes for approval. Review the update to approve or reject the changes.`;
        if (prior) {
          await base44.asServiceRole.entities.Notification.update(prior.id, {
            message: notifMsg,
            is_read: false,
          }).catch(() => {});
        } else {
          await base44.asServiceRole.entities.Notification.create({
            user_email: admin.email,
            title: "Artist Profile Update Pending Review",
            message: notifMsg,
            type: "general",
            link: reviewLink,
          }).catch(() => {});
        }

        // Email only on first submission — avoid duplicate emails on resubmit.
        if (!isResubmit) {
          await base44.asServiceRole.integrations.Core.SendEmail({
            to: admin.email,
            subject: `Artist Profile Update Awaiting Review – ${artistName}`,
            body: `
              <div style="font-family:Arial,sans-serif;background:#0a0d1a;padding:32px;color:#c8d0e8;">
                <h2 style="color:#ff1b8d;margin:0 0 16px;">Artist Profile Update Awaiting Review</h2>
                <p>Hi Admin,</p>
                <p><strong style="color:#fff;">${artistName}</strong> has submitted changes to their artist profile for approval.</p>
                <p>Please review the requested updates before they are published publicly.</p>
                <table style="width:100%;background:#0f1529;border-radius:8px;padding:16px;margin:16px 0;border:1px solid #1e2a45;">
                  <tr><td style="padding:6px 0;color:#6b7db3;font-size:12px;text-transform:uppercase;">Artist</td><td style="color:#fff;font-weight:bold;">${artistName}</td></tr>
                  <tr><td style="padding:6px 0;color:#6b7db3;font-size:12px;text-transform:uppercase;">Submitted</td><td style="color:#c8d0e8;">${submittedAt}</td></tr>
                  <tr><td style="padding:6px 0;color:#6b7db3;font-size:12px;text-transform:uppercase;">Changed Fields</td><td style="color:#c8d0e8;">${changedSummary}</td></tr>
                  <tr><td style="padding:6px 0;color:#6b7db3;font-size:12px;text-transform:uppercase;">Status</td><td style="color:#ffcf3f;font-weight:bold;">Pending Review</td></tr>
                </table>
                <a href="${reviewUrl}" style="display:inline-block;background:#ff1b8d;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">Review Profile Changes →</a>
                <p style="margin-top:16px;font-size:12px;color:#6b7db3;">Reizor · Artist Profile Review</p>
              </div>
            `,
          }).catch((e) => {
            console.error(`[submitArtistProfileEdit] email to ${admin.email} failed:`, e?.message || e);
          });
        }
      }));
    } catch (notifErr) {
      console.error("[submitArtistProfileEdit] notification error:", notifErr?.message || notifErr);
    }

    return Response.json({ success: true, id: saved?.id, changed_fields });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});