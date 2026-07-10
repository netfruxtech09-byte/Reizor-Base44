import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
    const appUrl = Deno.env.get("BASE44_APP_URL") || "https://reizor.com";

    const robots = `User-agent: *
Allow: /
Allow: /events/
Allow: /organizers/
Allow: /artists/
Allow: /gallery
Allow: /search
Allow: /discover
Allow: /calendar
Allow: /community
Allow: /resale
Allow: /faq
Allow: /terms
Allow: /privacy-policy

Disallow: /admin
Disallow: /organizer/
Disallow: /artist/
Disallow: /checkout/
Disallow: /profile
Disallow: /my-tickets
Disallow: /scanner
Disallow: /api/

Sitemap: ${appUrl}/functions/generateSitemap

Crawl-delay: 5`;

    return new Response(robots, {
        status: 200,
        headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "public, max-age=86400",
        },
    });
});