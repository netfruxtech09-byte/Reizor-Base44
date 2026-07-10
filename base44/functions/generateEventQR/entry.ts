import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event_id, ticket_url } = await req.json();

    if (!event_id || !ticket_url) {
      return Response.json({ error: "Missing event_id or ticket_url" }, { status: 400 });
    }

    // Generate QR code using QR code API (free service)
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(ticket_url)}`;

    return Response.json({
      success: true,
      qr_code_url: qrUrl,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});