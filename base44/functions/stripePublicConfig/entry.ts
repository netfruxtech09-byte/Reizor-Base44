import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  // Publishable key is safe to expose — it's intentionally public
  const publishableKey = Deno.env.get('STRIPE_PUBLISHABLE_KEY') || '';
  return Response.json({ publishableKey });
});