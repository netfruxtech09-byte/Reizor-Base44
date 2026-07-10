// CSV export utilities for analytics data
import { safeExportCSV } from "@/lib/mobileShare";

/**
 * Build CSV string and export via safeExportCSV.
 * - Desktop: anchor download
 * - iOS / Android: native share sheet (save to Files, email, etc.)
 */
export const exportToCSV = async (data, filename = 'analytics.csv') => {
  if (!data || data.length === 0) return;

  const headers = Object.keys(data[0]);
  const csv = [
    headers.join(','),
    ...data.map(row =>
      headers.map(header => {
        const value = row[header];
        if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value ?? '';
      }).join(',')
    )
  ].join('\n');

  return safeExportCSV(csv, filename);
};

// Format analytics data for CSV export
export const formatOrdersForExport = (orders) => {
  return orders.map(o => ({
    'Order ID': o.id,
    'Date': new Date(o.created_date).toLocaleDateString(),
    'Event': o.event_title || '—',
    'Total': `$${(o.total || 0).toFixed(2)}`,
    'Tickets': o.ticket_count || 0,
    'Status': o.status,
    'Customer Email': o.user_email || '—',
  }));
};

export const formatRevenueForExport = (events, orders) => {
  return events.map(e => {
    const eventOrders = orders.filter(o => o.event_id === e.id && o.status === 'completed');
    const grossRevenue = eventOrders.reduce((s, o) => s + (o.total || 0), 0);
    const ticketRevenue = eventOrders.reduce((s, o) => s + (o.subtotal || 0), 0);
    const fees = grossRevenue - ticketRevenue;

    return {
      'Event': e.title,
      'Date': new Date(e.date).toLocaleDateString(),
      'Tickets Sold': eventOrders.length,
      'Ticket Revenue': `$${ticketRevenue.toFixed(2)}`,
      'Platform Fees': `$${(fees * 0.5).toFixed(2)}`,
      'CC Fees': `$${(fees * 0.5).toFixed(2)}`,
      'Gross Revenue': `$${grossRevenue.toFixed(2)}`,
      'Net Revenue': `$${(grossRevenue - fees).toFixed(2)}`,
    };
  });
};

export const formatAttendeesForExport = (orders) => {
  const attendees = [];
  orders.forEach(o => {
    if (o.guest_names && Array.isArray(o.guest_names)) {
      o.guest_names.forEach((name) => {
        attendees.push({
          'Order ID': o.id,
          'Event': o.event_title || '—',
          'Guest Name': name,
          'Email': o.user_email || '—',
          'Ticket Type': o.ticket_type || '—',
          'Check-in Status': o.scanned_at ? 'Checked In' : 'Not Checked In',
        });
      });
    }
  });
  return attendees;
};