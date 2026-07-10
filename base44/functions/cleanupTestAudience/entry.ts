import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    let deletedUsersCount = 0;
    let deletedOrdersCount = 0;

    // Delete all orders with test customer emails and broken/incomplete geographic data
    let skip = 0;
    let hasMore = true;
    while (hasMore) {
      const orders = await base44.asServiceRole.entities.Order.list(null, 100, skip);
      let foundAny = false;
      
      for (const order of orders) {
        const isTestEmail = order.customer_email && order.customer_email.match(/^test_.*@test\.com$/);
        const isBrokenGeo = !order.city || order.city === 'Ny' || order.country === 'Country not available';
        
        if (isTestEmail || (isBrokenGeo && order.customer_email && order.customer_email.includes('test'))) {
          await base44.asServiceRole.entities.Order.delete(order.id);
          deletedOrdersCount++;
          foundAny = true;
        }
      }
      
      if (!foundAny) {
        hasMore = false;
      } else {
        skip += 100;
      }
    }

    // Delete all test users (paginate through all users)
    skip = 0;
    hasMore = true;
    while (hasMore) {
      const users = await base44.asServiceRole.entities.User.list(null, 100, skip);
      const testUsers = users.filter(u => u.email && u.email.match(/^test_.*@test\.com$/));
      
      if (testUsers.length === 0) {
        hasMore = false;
      } else {
        for (const testUser of testUsers) {
          await base44.asServiceRole.entities.User.delete(testUser.id);
          deletedUsersCount++;
        }
        skip += 100;
      }
    }

    return Response.json({
      success: true,
      message: `Cleanup complete: deleted ${deletedUsersCount} test users and ${deletedOrdersCount} test orders`,
      test_users_deleted: deletedUsersCount,
      test_orders_deleted: deletedOrdersCount,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});