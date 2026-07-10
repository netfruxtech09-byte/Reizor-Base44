import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const appUrl = Deno.env.get("BASE44_APP_URL") || "https://reizor.com";

        // Fetch all public content
        const [events, profiles, mediaItems] = await Promise.all([
            base44.asServiceRole.entities.Event.filter({ status: "published" }, "-date", 500).catch(() => []),
            base44.asServiceRole.entities.OrganizerProfile.list(null, 500).catch(() => []),
            base44.asServiceRole.entities.MediaItem.filter({ status: "active", approval_status: "approved" }, "-created_date", 100).catch(() => []),
        ]);

        // Build organizer IDs set
        const organizerIds = new Set();
        profiles.forEach(p => organizerIds.add(p.organizer_id));
        events.forEach(e => { if (e.organizer_id) organizerIds.add(e.organizer_id); });

        // Static pages
        const staticPages = [
            { path: "/", priority: "1.0", changefreq: "daily" },
            { path: "/search", priority: "0.8", changefreq: "daily" },
            { path: "/discover", priority: "0.9", changefreq: "daily" },
            { path: "/calendar", priority: "0.8", changefreq: "daily" },
            { path: "/gallery", priority: "0.7", changefreq: "weekly" },
            { path: "/organizers", priority: "0.8", changefreq: "daily" },
            { path: "/artists", priority: "0.8", changefreq: "daily" },
            { path: "/community", priority: "0.6", changefreq: "daily" },
            { path: "/resale", priority: "0.7", changefreq: "daily" },
            { path: "/faq", priority: "0.5", changefreq: "monthly" },
            { path: "/recommend", priority: "0.5", changefreq: "monthly" },
            { path: "/partner-events", priority: "0.6", changefreq: "daily" },
            { path: "/affiliate-program", priority: "0.4", changefreq: "monthly" },
            { path: "/terms", priority: "0.3", changefreq: "monthly" },
            { path: "/privacy-policy", priority: "0.3", changefreq: "monthly" },
        ];

        const urls = [];

        // Static pages
        for (const page of staticPages) {
            urls.push(`  <url>
    <loc>${appUrl}${page.path}</loc>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`);
        }

        // Event pages
        for (const event of events) {
            const lastmod = event.updated_date
                ? new Date(event.updated_date).toISOString().split("T")[0]
                : new Date(event.created_date).toISOString().split("T")[0];
            urls.push(`  <url>
    <loc>${appUrl}/events/${event.id}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>`);
        }

        // Organizer pages
        for (const oid of organizerIds) {
            urls.push(`  <url>
    <loc>${appUrl}/organizers/${oid}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`);
        }

        // Artist pages — fetch separately for efficiency
        const artists = await base44.asServiceRole.entities.Artist.filter({ status: "active", approval_status: "approved" }, "-follower_count", 200).catch(() => []);
        for (const artist of artists) {
            urls.push(`  <url>
    <loc>${appUrl}/artists/${artist.id}</loc>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`);
        }

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join("\n")}
</urlset>`;

        return new Response(xml, {
            status: 200,
            headers: {
                "Content-Type": "application/xml; charset=utf-8",
                "Cache-Control": "public, max-age=3600",
            },
        });
    } catch (error) {
        return new Response(`<?xml version="1.0" encoding="UTF-8"?><error>${error.message}</error>`, {
            status: 500,
            headers: { "Content-Type": "application/xml" },
        });
    }
});