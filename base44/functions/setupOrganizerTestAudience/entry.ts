import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Find the organizer by email
    const allUsers = await base44.entities.User.list(null, 1000);
    const organizer = allUsers.find(u => u.email === 'puneet@netfrux.com');

    if (!organizer) {
      return Response.json({ error: 'Organizer not found' }, { status: 404 });
    }

    // Get organizer's events and find Diwali event
    const allEvents = await base44.entities.Event.filter({ organizer_id: organizer.id }, null, 50);

    if (allEvents.length === 0) {
      return Response.json({ error: 'Organizer has no events' }, { status: 400 });
    }

    // Look for Diwali event (case-insensitive)
    const diwaliEvent = allEvents.find(e => e.title && e.title.toLowerCase().includes('diwali'));
    const eventId = diwaliEvent ? diwaliEvent.id : allEvents[0].id;
    const eventTitle = diwaliEvent ? diwaliEvent.title : allEvents[0].title;

    // Create test users with diverse demographics
    const baseTimestamp = Date.now();
    const testUsers = [
      {
        full_name: 'Alice Johnson',
        email: `test_alice_${baseTimestamp}@test.com`,
        gender: 'female',
        date_of_birth: '1990-05-15',
        preferred_genres: ['electronic', 'house'],
      },
      {
        full_name: 'Bob Smith',
        email: `test_bob_${baseTimestamp}@test.com`,
        gender: 'male',
        date_of_birth: '1988-03-22',
        preferred_genres: ['rock', 'alternative'],
      },
      {
        full_name: 'Charlie Lee',
        email: `test_charlie_${baseTimestamp}@test.com`,
        gender: 'male',
        date_of_birth: '2005-11-10',
        preferred_genres: ['hip_hop', 'rap'],
      },
      {
        full_name: 'Diana Brown',
        email: `test_diana_${baseTimestamp}@test.com`,
        gender: 'female',
        date_of_birth: '1995-07-30',
        preferred_genres: ['pop', 'rnb'],
      },
      {
        full_name: 'Eve Wilson',
        email: `test_eve_${baseTimestamp}@test.com`,
        gender: 'female',
        date_of_birth: '2000-02-14',
        preferred_genres: ['indie', 'pop'],
      },
      {
        full_name: 'Frank Miller',
        email: `test_frank_${baseTimestamp}@test.com`,
        gender: 'male',
        date_of_birth: '1982-09-05',
        preferred_genres: ['jazz', 'blues'],
      },
      {
        full_name: 'Grace Chen',
        email: `test_grace_${baseTimestamp}@test.com`,
        gender: 'female',
        date_of_birth: '1992-12-20',
        preferred_genres: ['electronic', 'ambient'],
      },
      {
        full_name: 'Henry Davis',
        email: `test_henry_${baseTimestamp}@test.com`,
        gender: 'male',
        date_of_birth: '1998-06-18',
        preferred_genres: ['rock', 'metal'],
      },
    ];

    // Create users one at a time to ensure they're properly saved with all fields
    const createdUsers = [];
    for (const userData of testUsers) {
      const created = await base44.asServiceRole.entities.User.create(userData);
      createdUsers.push(created);
    }

    // Create orders for these users (as buyers)
    const orders = createdUsers.map((u, idx) => ({
      order_number: `TEST-${Date.now()}-${idx}`,
      customer_email: u.email,
      customer_name: u.full_name,
      event_id: eventId,
      organizer_id: organizer.id,
      organizer_name: organizer.full_name,
      organizer_email: organizer.email,
      subtotal: Math.floor(Math.random() * 40) + 10,
      service_fee: 0,
      tax: 0,
      total: Math.floor(Math.random() * 50) + 20,
      status: 'completed',
      paid_at: new Date().toISOString(),
    }));

    await base44.asServiceRole.entities.Order.bulkCreate(orders);

    return Response.json({
      success: true,
      message: `Created ${createdUsers.length} test users and ${orders.length} orders for event "${eventTitle}" (${organizer.email})`,
      event_id: eventId,
      event_title: eventTitle,
      user_count: createdUsers.length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});