import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

/**
 * aiModerateMedia — AI-powered automatic content moderation
 * 
 * Called by entity automations when new MediaItem, ArtistPost, ArtistAlbum,
 * OrganizerMediaPost, or CommunityPost is created.
 * 
 * Uses InvokeLLM (vision + text) to analyze content and auto-approve or auto-reject.
 * Skips items already moderated (approved/rejected/blocked) or uploaded by admin.
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { entity_type, entity_id } = body;

    if (!entity_type || !entity_id) {
      return Response.json({ error: 'entity_type and entity_id are required' }, { status: 400 });
    }

    // Fetch the record
    const entityMap = {
      MediaItem: base44.asServiceRole.entities.MediaItem,
      ArtistPost: base44.asServiceRole.entities.ArtistPost,
      ArtistAlbum: base44.asServiceRole.entities.ArtistAlbum,
      OrganizerMediaPost: base44.asServiceRole.entities.OrganizerMediaPost,
      CommunityPost: base44.asServiceRole.entities.CommunityPost,
    };

    const entitySDK = entityMap[entity_type];
    if (!entitySDK) return Response.json({ error: 'Unknown entity type' }, { status: 400 });

    const records = await entitySDK.filter({ id: entity_id }, null, 1).catch(() => []);
    const record = records[0];
    if (!record) return Response.json({ error: 'Record not found' }, { status: 404 });

    // Skip if already moderated (human already reviewed) or uploaded by admin
    const currentStatus = record.approval_status || record.media_approval_status;
    if (currentStatus && currentStatus !== 'pending_review') {
      return Response.json({ skipped: true, reason: 'already_moderated', status: currentStatus });
    }
    if (record.uploaded_by_role === 'admin') {
      return Response.json({ skipped: true, reason: 'admin_upload' });
    }

    // Extract content to analyze
    const imageUrl = record.url || record.media_url || record.media_urls?.[0] || record.cover_url || null;
    const textContent = [
      record.title,
      record.caption,
      record.description,
      record.body,
      record.content,
    ].filter(Boolean).join('\n').trim();

    if (!imageUrl && !textContent) {
      return Response.json({ skipped: true, reason: 'no_content_to_analyze' });
    }

    // Build prompt
    const prompt = `You are a content moderation AI for a music events and artist platform called Reizor.
Analyze the following content and determine if it should be APPROVED or REJECTED.

REJECT if the content contains:
- Nudity or explicit sexual content
- Graphic violence or gore
- Hate speech, racism, or discrimination
- Spam, scam, or misleading information
- Harassment or threats
- Illegal content or drug promotion
- Unrelated commercial advertising

APPROVE if the content is:
- Music, events, artist promotions, concerts
- Normal social/community posts
- Artistic/creative content appropriate for all ages
- Event photos, venue images, artist media

${textContent ? `Text content:\n"${textContent.slice(0, 1000)}"` : ''}

Respond with JSON only.`;

    const file_urls = imageUrl ? [imageUrl] : undefined;

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      file_urls,
      response_json_schema: {
        type: 'object',
        properties: {
          decision: { type: 'string', enum: ['approve', 'reject'] },
          confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
          reason: { type: 'string' },
        },
        required: ['decision', 'confidence', 'reason'],
      },
    });

    const { decision, confidence, reason } = result;
    console.log(`AI moderation [${entity_type}:${entity_id}]: ${decision} (${confidence}) - ${reason}`);

    // Helper: notify all admins with duplicate protection
    const notifyAdmins = async ({ title, message, link }) => {
      const allUsers = await base44.asServiceRole.entities.User.list(null, 500).catch(() => []);
      const admins = allUsers.filter(u => u.role === 'admin');
      await Promise.all(admins.map(async (admin) => {
        // Duplicate check: same title + same entity link
        const existing = await base44.asServiceRole.entities.Notification.filter({
          user_email: admin.email,
          link,
        }, null, 50).catch(() => []);
        const isDuplicate = existing.some(n => n.title === title);
        if (isDuplicate) return;
        await base44.asServiceRole.entities.Notification.create({
          user_email: admin.email,
          title,
          message,
          type: 'general',
          link,
        }).catch(() => {});
      }));
    };

    // ── AUTO-APPROVAL FOR SAFE CONTENT ──────────────────────────────────────────
    // Content that the AI scans as safe with HIGH confidence is auto-approved
    // and published immediately — no manual admin review needed.
    // Content is sent to Pending Review ONLY when:
    //   - AI flags it (decision=reject), OR
    //   - Confidence is uncertain (medium/low), OR
    //   - AI scan fails (caught by the outer try/catch)
    // Admins are notified ONLY for items that require manual review.
    const now = new Date().toISOString();
    const advisoryNote = `AI assessment: ${decision.toUpperCase()} (${confidence} confidence). ${reason}`;

    const shouldAutoApprove = decision === 'approve' && confidence === 'high';
    const newStatus = shouldAutoApprove ? 'approved' : 'pending_review';

    if (entity_type === 'CommunityPost') {
      await entitySDK.update(entity_id, {
        media_approval_status: newStatus,
        moderation_note: advisoryNote,
        moderated_at: now,
        moderated_by: 'ai_auto_moderation',
      }).catch(() => {});
    } else {
      await entitySDK.update(entity_id, {
        approval_status: newStatus,
        moderation_note: advisoryNote,
        moderated_at: now,
        moderated_by: 'ai_auto_moderation',
      }).catch(() => {});
    }

    // Only notify admins when content genuinely requires manual review.
    // Auto-approved safe content does NOT trigger admin notifications or emails.
    if (!shouldAutoApprove) {
      const uploaderEmail = record.uploaded_by_email || record.author_email || record.artist_email || record.created_by || 'unknown';
      const uploaderRole = record.uploaded_by_role || record.author_role || 'user';
      const mediaTitle = record.title || record.caption || entity_type;
      const reviewLink = `/admin/moderation?item=${entity_id}&entity=${entity_type}`;
      const flagPrefix = decision === 'reject' ? '⚠️ ' : '';
      await notifyAdmins({
        title: `${flagPrefix}Media Review Required`,
        message: `AI assessed "${mediaTitle}" by ${uploaderEmail} [${uploaderRole}] as ${decision.toUpperCase()} (${confidence}). Reason: ${reason}. Human review needed.`,
        link: reviewLink,
      });
    }

    return Response.json({ decision, confidence, reason, action_taken: shouldAutoApprove ? 'auto_approved' : 'pending_review', entity_type, entity_id });

  } catch (error) {
    console.error('AI moderation error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});