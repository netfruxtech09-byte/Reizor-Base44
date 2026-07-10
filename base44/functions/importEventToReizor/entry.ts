import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const ADMIN_WORKSPACE_EMAIL = "admin-workspace@reizor.internal";
const ADMIN_WORKSPACE_NAME = "Reizor Admin Events";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== "admin") {
      return Response.json({ error: "Admin access required" }, { status: 403 });
    }

    const { external_event_id } = await req.json();
    if (!external_event_id) {
      return Response.json({ error: "external_event_id is required" }, { status: 400 });
    }

    // Load the ExternalEvent
    let extEvent = null;
    try {
      extEvent = await base44.asServiceRole.entities.ExternalEvent.get(external_event_id);
    } catch {
      return Response.json({ error: "External event not found" }, { status: 404 });
    }
    if (!extEvent) {
      return Response.json({ error: "External event not found" }, { status: 404 });
    }

    // Prevent duplicate conversion
    if (extEvent.managed_mode === "reizor" && extEvent.linked_event_id) {
      return Response.json({
        success: true,
        already_converted: true,
        linked_event_id: extEvent.linked_event_id,
        message: "Event already converted to a Reizor-managed event",
      });
    }

    // Ensure Admin organizer workspace exists
    let adminWorkspace = null;
    const existingWorkspaces = await base44.asServiceRole.entities.OrganizerProfile.filter(
      { organizer_email: ADMIN_WORKSPACE_EMAIL },
      null, 1
    );
    if (existingWorkspaces.length > 0) {
      adminWorkspace = existingWorkspaces[0];
    } else {
      adminWorkspace = await base44.asServiceRole.entities.OrganizerProfile.create({
        organizer_id: user.id,
        organizer_email: ADMIN_WORKSPACE_EMAIL,
        business_name: ADMIN_WORKSPACE_NAME,
        full_name: ADMIN_WORKSPACE_NAME,
        is_admin_workspace: true,
      });
    }

    // Map genre — normalize to Event enum values
    const GENRE_MAP = {
      "techno": "techno", "house": "house", "drum_and_bass": "drum_and_bass",
      "dnb": "drum_and_bass", "trance": "trance", "hip_hop": "hip_hop",
      "hip-hop": "hip_hop", "rnb": "rnb", "r&b": "rnb", "pop": "pop",
      "rock": "rock", "jazz": "jazz", "electronic": "electronic",
      "latin": "latin", "reggaeton": "reggaeton", "afrobeats": "afrobeats",
    };
    const rawGenre = (extEvent.genre || "").toLowerCase().replace(/\s/g, "_");
    const mappedGenre = GENRE_MAP[rawGenre] || "other";

    // Create the native Reizor Event as Draft
    const nativeEvent = await base44.asServiceRole.entities.Event.create({
      title: extEvent.title,
      description: extEvent.description || "",
      date: extEvent.date,
      end_date: extEvent.end_date || null,
      venue_name: extEvent.venue_name || "",
      venue_address: extEvent.venue_address || "",
      city: extEvent.city || "",
      country: extEvent.country || "",
      genre: mappedGenre,
      cover_image: extEvent.cover_image || "",
      artists: extEvent.artists || [],
      status: "draft",
      organizer_id: user.id, // Admin's user ID as organizer
      organizer_name: ADMIN_WORKSPACE_NAME,
      event_type: "ticketed",
      is_featured: false,
    });

    // Link the ExternalEvent back to the native Event
    await base44.asServiceRole.entities.ExternalEvent.update(external_event_id, {
      managed_mode: "reizor",
      linked_event_id: nativeEvent.id,
      imported_by_email: user.email,
      imported_at: new Date().toISOString(),
      provider_event_url: extEvent.affiliate_url || "",
    });

    return Response.json({
      success: true,
      linked_event_id: nativeEvent.id,
      message: "Event imported and created as a Draft Reizor event",
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});