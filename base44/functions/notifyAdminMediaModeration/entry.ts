import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * notifyAdminMediaModeration — Entity automation handler
 *
 * Fires on creation of any content that enters the Admin Media Moderation queue:
 *   MediaItem, ArtistPost, ArtistAlbum, OrganizerMediaPost, CommunityPost
 *
 * Sends a branded email + in-app notification to all active Admin users.
 * - Dedup per admin per item (no duplicates on refresh/retry/refetch).
 * - Skips private drafts and already-moderated-out items.
 * - Logs email failures to AppErrorLog without blocking the upload.
 * - Auto-approved items (by AI) do NOT trigger admin emails — only pending items do.
 */

const SUPPORTED_ENTITIES = ['MediaItem', 'ArtistPost', 'ArtistAlbum', 'OrganizerMediaPost', 'CommunityPost'];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { event, data, payload_too_large } = body;

    if (!event || event.type !== 'create') {
      return Response.json({ skipped: true, reason: 'not_a_create_event' });
    }

    const entityName = event.entity_name;
    const entityId = event.entity_id;

    if (!SUPPORTED_ENTITIES.includes(entityName)) {
      return Response.json({ skipped: true, reason: 'unsupported_entity' });
    }

    // Fetch full record if payload was too large or missing
    let item = data;
    if (payload_too_large || !item) {
      try {
        item = await base44.asServiceRole.entities[entityName].get(entityId);
      } catch {
        return Response.json({ skipped: true, reason: 'could_not_fetch_data' });
      }
    }
    if (!item) return Response.json({ skipped: true, reason: 'no_data' });

    // Wait for the AI scan to complete before sending the "Awaiting Review" email.
    // If AI auto-approves the content (safe + high confidence), no admin email is
    // needed — this eliminates unnecessary moderation emails for normal uploads.
    await new Promise(resolve => setTimeout(resolve, 12000));

    // Re-fetch the item to check if AI has already processed it
    try {
      const refreshed = await base44.asServiceRole.entities[entityName].get(entityId);
      if (refreshed) item = refreshed;
    } catch {}

    const details = extractDetails(entityName, item);
    const approvalStatus = item.approval_status || item.media_approval_status || 'pending_review';

    // Skip if AI has already auto-approved this item — no admin email needed
    if (item.moderated_by === 'ai_auto_moderation' && approvalStatus === 'approved') {
      return Response.json({ skipped: true, reason: 'ai_auto_approved' });
    }

    // Skip private drafts (hidden with no approval status)
    if (item.status === 'hidden' && !item.approval_status && !item.media_approval_status) {
      return Response.json({ skipped: true, reason: 'private_draft' });
    }
    // Skip items already rejected/blocked at creation time
    if (approvalStatus === 'rejected' || approvalStatus === 'blocked') {
      return Response.json({ skipped: true, reason: 'already_moderated_out' });
    }

    // Get all active admin users
    const allUsers = await base44.asServiceRole.entities.User.list(null, 500);
    const admins = allUsers.filter(u => u.role === 'admin');
    if (admins.length === 0) return Response.json({ skipped: true, reason: 'no_admins' });

    const isAutoApproved = approvalStatus === 'approved';
    const statusLabel = isAutoApproved ? 'Auto-Approved' : 'Pending Review';
    const subject = isAutoApproved
      ? `New ${details.contentTypeLabel} Auto-Approved — Reizor`
      : `New ${details.contentTypeLabel} Awaiting Review — Reizor`;

    const appUrl = Deno.env.get('BASE44_APP_URL') || 'https://reizor.com';
    const ctaUrl = `${appUrl}/admin/moderation?item=${entityId}&entity=${entityName}`;

    const submissionDate = new Date(item.created_date || Date.now()).toLocaleString('en-US', {
      weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

    const html = buildModerationEmail({
      title: isAutoApproved ? 'New Content Auto-Approved' : 'New Content Awaiting Review',
      message: isAutoApproved
        ? `New ${details.contentTypeLabel.toLowerCase()} was submitted and automatically approved by the moderation system. You can review it in the Admin panel.`
        : `New ${details.contentTypeLabel.toLowerCase()} has been submitted and is awaiting your review before it appears publicly.`,
      infoBox: {
        highlight: !isAutoApproved,
        rows: [
          { label: 'Content Type', value: details.contentTypeLabel },
          { label: 'Media Format', value: details.mediaFormat },
          { label: 'Uploaded By', value: details.uploaderName },
          { label: 'Uploader Role', value: details.uploaderRole },
          ...(details.contextName ? [{ label: 'Related To', value: details.contextName }] : []),
          { label: 'Submitted', value: submissionDate },
          { label: 'Status', value: statusLabel },
        ],
      },
      ctaText: 'Review in Admin Panel',
      ctaUrl,
      thumbnailUrl: details.thumbnailUrl || null,
    });

    // Dedup key — the notification link uniquely identifies this moderation item
    const dedupLink = `/admin/moderation?item=${entityId}&entity=${entityName}`;

    let notified = 0;
    let failed = 0;

    await Promise.all(admins.map(async (admin) => {
      try {
        // Dedup: skip if this admin already has a media_moderation notification for this exact item
        const existing = await base44.asServiceRole.entities.Notification.filter({
          user_email: admin.email,
          type: 'media_moderation',
        }, null, 50).catch(() => []);
        const alreadyNotified = existing.some(n => n.link === dedupLink);
        if (alreadyNotified) return;

        // In-app notification (keep existing behavior + add this)
        await base44.asServiceRole.entities.Notification.create({
          user_email: admin.email,
          title: `${details.contentTypeLabel} ${statusLabel}`,
          message: `${details.uploaderName} (${details.uploaderRole}) submitted ${details.contentTypeLabel.toLowerCase()}${details.contextName ? ` — ${details.contextName}` : ''}. Status: ${statusLabel}.`,
          type: 'media_moderation',
          link: dedupLink,
        }).catch(() => {});

        // Branded email
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: admin.email,
          subject,
          body: html,
        });
        notified++;
      } catch (emailErr) {
        failed++;
        // Log failure for admin debugging — never block the upload/moderation record
        await base44.asServiceRole.entities.AppErrorLog.create({
          error_message: `Media moderation email failed for ${admin.email}: ${emailErr.message}`,
          error_type: 'api_error',
          route_url: dedupLink,
          user_email: admin.email,
          extra_context: JSON.stringify({ entityId, entityName, contentType: details.contentTypeLabel }),
        }).catch(() => {});
      }
    }));

    return Response.json({ success: true, notified, failed });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function extractDetails(entityName, item) {
  switch (entityName) {
    case 'OrganizerMediaPost':
      return {
        contentTypeLabel: item.is_360 ? '360° Video' : (item.media_type === 'video' ? 'Organizer Video' : 'Organizer Image'),
        mediaFormat: item.media_type === 'video' ? 'Video' : 'Image',
        uploaderName: item.organizer_name || item.uploaded_by_email || 'Organizer',
        uploaderRole: 'Organizer',
        contextName: [item.venue_name, item.city, item.event_title].filter(Boolean).join(' · ') || null,
        thumbnailUrl: item.thumbnail_url || (item.media_type !== 'video' ? item.media_url : null),
      };
    case 'ArtistPost':
      return {
        contentTypeLabel: item.media_type === 'video' ? 'Artist Video' : 'Artist Post',
        mediaFormat: item.media_type === 'video' ? 'Video' : (item.media_urls?.length ? 'Image' : 'Text'),
        uploaderName: item.artist_name || item.author_name || 'Artist',
        uploaderRole: 'Artist',
        contextName: item.event_title || item.artist_name || null,
        thumbnailUrl: item.media_urls?.[0] || item.media_url || null,
      };
    case 'ArtistAlbum':
      return {
        contentTypeLabel: 'Artist Album',
        mediaFormat: 'Image Collection',
        uploaderName: item.artist_name || 'Artist',
        uploaderRole: 'Artist',
        contextName: item.title || item.artist_name || null,
        thumbnailUrl: item.cover_url || null,
      };
    case 'CommunityPost':
      return {
        contentTypeLabel: 'Community Post',
        mediaFormat: item.media_urls?.length ? (item.media_urls.length > 1 ? 'Media Collection' : 'Media') : 'Text',
        uploaderName: item.author_name || item.author_email || 'User',
        uploaderRole: item.author_role || 'User',
        contextName: 'Community Feed',
        thumbnailUrl: item.media_urls?.[0] || null,
      };
    case 'MediaItem':
    default:
      return {
        contentTypeLabel: item.media_type === 'video' ? 'Media Video' : 'Media Image',
        mediaFormat: item.media_type === 'video' ? 'Video' : 'Image',
        uploaderName: item.uploaded_by_name || item.uploaded_by_email || item.organizer_name || item.artist_name || 'User',
        uploaderRole: item.uploaded_by_role || (item.organizer_name ? 'Organizer' : item.artist_name ? 'Artist' : 'User'),
        contextName: item.event_title || item.organizer_name || item.artist_name || null,
        thumbnailUrl: item.thumbnail_url || (item.media_type !== 'video' ? item.url : null),
      };
  }
}

function buildModerationEmail({ title, message, infoBox, ctaText, ctaUrl, thumbnailUrl }) {
  const infoBoxHtml = infoBox && infoBox.rows && infoBox.rows.length > 0
    ? `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:${infoBox.highlight ? 'rgba(255,27,141,0.08)' : '#131929'};border:1px solid ${infoBox.highlight ? 'rgba(255,27,141,0.25)' : '#232b4a'};border-radius:10px;margin:20px 0;">
        ${infoBox.rows.map(({ label, value }) => `
          <tr>
            <td style="padding:9px 16px;color:#8893b0;font-size:12px;font-family:monospace;border-bottom:1px solid rgba(255,255,255,0.04);white-space:nowrap;width:40%;">${label}</td>
            <td style="padding:9px 16px;color:#eef0fa;font-size:13px;font-weight:600;border-bottom:1px solid rgba(255,255,255,0.04);">${value}</td>
          </tr>`).join('')}
      </table>`
    : '';

  const thumbHtml = thumbnailUrl
    ? `<div style="text-align:center;margin:20px 0;">
        <img src="${thumbnailUrl}" alt="Preview" style="max-width:100%;max-height:240px;border-radius:10px;border:1px solid #232b4a;object-fit:cover;" />
      </div>`
    : '';

  const ctaHtml = ctaText && ctaUrl
    ? `<div style="text-align:center;margin:28px 0 8px;">
        <a href="${ctaUrl}" style="display:inline-block;background:linear-gradient(135deg,#ff1b8d,#d4006e);color:#ffffff;font-size:15px;font-weight:800;font-family:'Helvetica Neue',Arial,sans-serif;text-decoration:none;padding:14px 36px;border-radius:8px;letter-spacing:0.4px;">${ctaText}</a>
      </div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#07091a;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#07091a;min-height:100vh;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#0d1024;border-radius:14px;border:1px solid #1e2545;overflow:hidden;">
          <tr>
            <td style="padding:24px 32px 18px;border-bottom:1px solid #1a2040;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <span style="font-size:20px;font-weight:900;letter-spacing:-0.5px;color:#ffffff;font-family:'Helvetica Neue',Arial,sans-serif;">REIZOR</span>
                    <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#ff1b8d;margin-left:3px;vertical-align:middle;"></span>
                  </td>
                  <td align="right">
                    <span style="font-size:10px;color:#5a647a;font-family:monospace;text-transform:uppercase;letter-spacing:2px;">Moderation</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 32px 24px;">
              <h1 style="margin:0 0 16px 0;font-size:22px;font-weight:900;color:#ffffff;line-height:1.2;">${title}</h1>
              <p style="margin:0 0 4px 0;font-size:14px;color:#b0b8d4;line-height:1.7;">${message}</p>
              ${thumbHtml}
              ${infoBoxHtml}
              ${ctaHtml}
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px;border-top:1px solid #1a2040;background:#09102a;">
              <p style="margin:0;font-size:11px;color:#4a5470;text-align:center;line-height:1.6;">
                Questions? Visit <a href="https://reizor.com" style="color:#ff1b8d;text-decoration:none;">reizor.com</a><br/>
                You received this because you are a Reizor Admin.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:14px 32px;border-top:1px solid #131929;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td><span style="font-size:10px;color:#2e3650;font-family:monospace;">© ${new Date().getFullYear()} Reizor · All rights reserved</span></td>
                  <td align="right"><span style="font-size:10px;color:#2e3650;font-family:monospace;">reizor.com</span></td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}