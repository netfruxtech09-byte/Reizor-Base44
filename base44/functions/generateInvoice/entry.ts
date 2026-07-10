import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import { jsPDF } from 'npm:jspdf@4.0.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { contractId } = await req.json();
    if (!contractId) return Response.json({ error: 'Missing contractId' }, { status: 400 });

    const contracts = await base44.entities.BookingContract.filter({ id: contractId }, null, 1);
    const contract = contracts[0];
    if (!contract) return Response.json({ error: 'Contract not found' }, { status: 404 });

    // Auth check: only parties or admin
    const allowed = [contract.artist_email, contract.booker_email].includes(user.email) || user.role === 'admin';
    if (!allowed) return Response.json({ error: 'Forbidden' }, { status: 403 });

    const doc = new jsPDF();
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 20;
    const contentW = pageW - margin * 2;
    let y = 20;

    const addPageIfNeeded = (needed = 20) => {
      if (y + needed > 270) { doc.addPage(); y = 20; }
    };

    // ── HEADER ──
    doc.setFillColor(15, 15, 25);
    doc.rect(0, 0, pageW, 45, 'F');
    doc.setTextColor(255, 27, 141);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('INVOICE', margin, 25);
    doc.setFontSize(9);
    doc.setTextColor(180, 180, 200);
    doc.text('REIZOR BOOKING PLATFORM', margin, 33);

    // Invoice number & date
    const invNum = `INV-${contract.id?.slice(-8)?.toUpperCase() || Date.now().toString(36).toUpperCase()}`;
    const invDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    doc.setFontSize(9);
    doc.setTextColor(180, 180, 200);
    doc.text(`Invoice #: ${invNum}`, pageW - margin, 20, { align: 'right' });
    doc.text(`Date: ${invDate}`, pageW - margin, 27, { align: 'right' });
    const statusText = contract.locked ? 'FULLY EXECUTED' : contract.contract_status?.toUpperCase()?.replace(/_/g, ' ') || 'DRAFT';
    doc.text(`Status: ${statusText}`, pageW - margin, 34, { align: 'right' });

    y = 55;

    // ── PARTIES ──
    doc.setTextColor(60, 60, 80);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('FROM (ORGANIZER)', margin, y);
    doc.text('TO (ARTIST)', pageW / 2 + 10, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(30, 30, 50);
    doc.text(contract.booker_name || 'N/A', margin, y);
    doc.text(contract.artist_name || 'N/A', pageW / 2 + 10, y);
    y += 5;
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 120);
    doc.text(contract.booker_email || '', margin, y);
    doc.text(contract.artist_email || '', pageW / 2 + 10, y);
    if (contract.booker_phone) {
      y += 5;
      doc.text(contract.booker_phone, margin, y);
    }

    y += 12;

    // ── DIVIDER ──
    doc.setDrawColor(220, 220, 230);
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageW - margin, y);
    y += 10;

    // ── EVENT DETAILS ──
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 30, 50);
    doc.text('EVENT DETAILS', margin, y);
    y += 8;

    const details = [
      ['Event Name', contract.event_name || 'N/A'],
      ['Venue', [contract.venue, contract.city, contract.country].filter(Boolean).join(', ') || 'TBD'],
      ['Show Date', contract.show_date ? new Date(contract.show_date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'TBD'],
      ['Soundcheck', contract.soundcheck_time || 'TBD'],
      ['Performance', contract.performance_time || 'TBD'],
    ];

    doc.setFontSize(9);
    for (const [label, value] of details) {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 100, 120);
      doc.text(label, margin, y);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(30, 30, 50);
      doc.text(String(value), margin + 45, y);
      y += 6;
    }

    y += 8;

    // ── FINANCIAL SUMMARY ──
    doc.setDrawColor(220, 220, 230);
    doc.line(margin, y, pageW - margin, y);
    y += 10;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 30, 50);
    doc.text('FINANCIAL SUMMARY', margin, y);
    y += 8;

    const fee = contract.fee || 0;
    const platformFee = contract.platform_fee || 0;
    const ccFee = contract.cc_fee || 0;
    const artistPayout = contract.artist_payout || (fee - platformFee - ccFee);

    // Table header
    doc.setFillColor(245, 245, 250);
    doc.rect(margin, y - 4, contentW, 8, 'F');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(80, 80, 100);
    doc.text('Description', margin + 3, y);
    doc.text('Amount', pageW - margin - 3, y, { align: 'right' });
    y += 10;

    const finRows = [
      ['Performance Fee', `$${fee.toLocaleString('en-US', { minimumFractionDigits: 2 })}`],
    ];
    if (platformFee > 0) finRows.push(['Platform Fee', `-$${platformFee.toFixed(2)}`]);
    if (ccFee > 0) finRows.push(['Processing Fee', `-$${ccFee.toFixed(2)}`]);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(30, 30, 50);
    for (const [desc, amt] of finRows) {
      doc.text(desc, margin + 3, y);
      doc.text(amt, pageW - margin - 3, y, { align: 'right' });
      y += 7;
    }

    // Total line
    doc.setDrawColor(30, 30, 50);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageW - margin, y);
    y += 7;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Artist Payout', margin + 3, y);
    doc.setTextColor(255, 27, 141);
    doc.text(`$${artistPayout.toLocaleString('en-US', { minimumFractionDigits: 2 })}`, pageW - margin - 3, y, { align: 'right' });

    y += 15;
    addPageIfNeeded(80);

    // ── PAYMENT SCHEDULE ──
    const payments = contract.payment_structure || [];
    if (payments.length > 0) {
      doc.setDrawColor(220, 220, 230);
      doc.setLineWidth(0.3);
      doc.line(margin, y, pageW - margin, y);
      y += 10;
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 30, 50);
      doc.text('PAYMENT SCHEDULE', margin, y);
      y += 8;

      // Table header
      doc.setFillColor(245, 245, 250);
      doc.rect(margin, y - 4, contentW, 8, 'F');
      doc.setFontSize(8);
      doc.setTextColor(80, 80, 100);
      doc.text('#', margin + 3, y);
      doc.text('Milestone', margin + 12, y);
      doc.text('Due', margin + 90, y);
      doc.text('Amount', pageW - margin - 30, y);
      doc.text('Status', pageW - margin - 3, y, { align: 'right' });
      y += 10;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(30, 30, 50);

      payments.forEach((p, i) => {
        addPageIfNeeded(10);
        doc.text(String(i + 1), margin + 3, y);
        doc.text(p.label || `Payment ${i + 1}`, margin + 12, y);
        doc.text(p.due_date || p.due_when || 'TBD', margin + 90, y);
        doc.text(`$${(p.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`, pageW - margin - 30, y);
        const st = (p.status || 'pending').toUpperCase();
        if (st === 'PAID') doc.setTextColor(34, 197, 94);
        else doc.setTextColor(234, 179, 8);
        doc.text(st, pageW - margin - 3, y, { align: 'right' });
        doc.setTextColor(30, 30, 50);
        y += 8;
      });

      y += 5;
    }

    // ── SIGNATURES ──
    if (contract.artist_signed || contract.organizer_signed) {
      addPageIfNeeded(50);
      doc.setDrawColor(220, 220, 230);
      doc.setLineWidth(0.3);
      doc.line(margin, y, pageW - margin, y);
      y += 10;
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 30, 50);
      doc.text('SIGNATURES', margin, y);
      y += 10;

      // Artist sig
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 100, 120);
      doc.text('ARTIST', margin, y);
      doc.text('ORGANIZER', pageW / 2 + 10, y);
      y += 6;
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bolditalic');
      doc.setTextColor(30, 30, 50);
      doc.text(contract.artist_signed ? (contract.artist_signature || 'Signed') : '________________', margin, y);
      doc.text(contract.organizer_signed ? (contract.organizer_signature || 'Signed') : '________________', pageW / 2 + 10, y);
      y += 6;
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(150, 150, 170);
      doc.text(
        contract.artist_signed && contract.artist_signed_at
          ? `Signed: ${new Date(contract.artist_signed_at).toLocaleString()}`
          : 'Not yet signed',
        margin, y
      );
      doc.text(
        contract.organizer_signed && contract.organizer_signed_at
          ? `Signed: ${new Date(contract.organizer_signed_at).toLocaleString()}`
          : 'Not yet signed',
        pageW / 2 + 10, y
      );
      y += 10;
    }

    // ── FOOTER ──
    addPageIfNeeded(20);
    doc.setDrawColor(220, 220, 230);
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageW - margin, y);
    y += 8;
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 170);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generated by REIZOR · ${invDate} · ${invNum}`, pageW / 2, y, { align: 'center' });
    doc.text('This invoice is auto-generated from the agreed booking contract.', pageW / 2, y + 4, { align: 'center' });

    const pdfBase64 = doc.output('datauristring');

    return Response.json({ pdf_base64: pdfBase64, filename: `Invoice_${invNum}.pdf` });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});