function wrapper(hotelName, bodyHtml) {
  return `
  <div style="font-family: Arial, Helvetica, sans-serif; background:#FAF7F0; padding:24px;">
    <div style="max-width:520px; margin:0 auto; background:#ffffff; border-radius:8px; overflow:hidden; border:1px solid #eee;">
      <div style="background:#0F1B1A; padding:20px 24px;">
        <span style="color:#F3EEE1; font-size:20px; font-weight:600;">${hotelName || 'HotelPro 5.0'}</span>
      </div>
      <div style="padding:24px; color:#1E332F; font-size:14px; line-height:1.6;">
        ${bodyHtml}
      </div>
      <div style="padding:16px 24px; background:#F3EEE1; color:#3A5C52; font-size:12px;">
        This is an automated message from ${hotelName || 'HotelPro 5.0'}. Please do not reply directly to this email.
      </div>
    </div>
  </div>`;
}

function row(label, value) {
  return `<tr>
    <td style="padding:4px 0; color:#3A5C52;">${label}</td>
    <td style="padding:4px 0; text-align:right; font-weight:600;">${value}</td>
  </tr>`;
}

function bookingConfirmationEmail({ hotelName, guestName, confirmationCode, roomTypeName, checkInDate, checkOutDate, ratePerNight, nights, formatMoney }) {
  const body = `
    <p>Dear ${guestName},</p>
    <p>Thank you for your reservation. Here are your booking details:</p>
    <table style="width:100%; border-collapse:collapse; margin:16px 0;">
      ${row('Confirmation Code', `<span style="font-family:monospace;">${confirmationCode}</span>`)}
      ${row('Room Type', roomTypeName)}
      ${row('Check-in', checkInDate)}
      ${row('Check-out', checkOutDate)}
      ${row('Nights', nights)}
      ${row('Rate per Night', formatMoney(ratePerNight))}
      ${row('Estimated Total', formatMoney(ratePerNight * nights))}
    </table>
    <p>We look forward to welcoming you. If you have any special requests or need to make changes, just get in touch with our front desk.</p>
  `;
  return { subject: `Booking Confirmation — ${confirmationCode}`, html: wrapper(hotelName, body) };
}

function invoiceReceiptEmail({ hotelName, guestName, invoiceNumber, totalAmount, amountPaid, balanceDue, method, formatMoney }) {
  const status = balanceDue > 0.01 ? 'Partial Payment Received' : 'Payment Received — Paid in Full';
  const body = `
    <p>Dear ${guestName},</p>
    <p>${status}. Here is your receipt:</p>
    <table style="width:100%; border-collapse:collapse; margin:16px 0;">
      ${row('Invoice Number', `<span style="font-family:monospace;">${invoiceNumber}</span>`)}
      ${row('Payment Method', method.replace('_', ' '))}
      ${row('Invoice Total', formatMoney(totalAmount))}
      ${row('Amount Paid', formatMoney(amountPaid))}
      ${row('Balance Due', formatMoney(balanceDue))}
    </table>
    <p>Thank you for staying with us.</p>
  `;
  return { subject: `Receipt — Invoice ${invoiceNumber}`, html: wrapper(hotelName, body) };
}

function lowStockDigestEmail({ hotelName, items, formatMoney, totalInventoryValue }) {
  const rows = items.map((i) =>
    `<tr>
      <td style="padding:6px 0; border-bottom:1px solid #eee;">${i.name}</td>
      <td style="padding:6px 0; border-bottom:1px solid #eee; text-align:right; color:#A5762E;">${i.quantity_on_hand} / ${i.reorder_level} ${i.unit}</td>
    </tr>`
  ).join('');
  const body = `
    <p>Good morning,</p>
    <p>The following ${items.length} item${items.length === 1 ? ' is' : 's are'} at or below its reorder level:</p>
    <table style="width:100%; border-collapse:collapse; margin:16px 0;">
      <tr><th style="text-align:left; padding-bottom:6px; border-bottom:2px solid #0F1B1A;">Item</th><th style="text-align:right; padding-bottom:6px; border-bottom:2px solid #0F1B1A;">On hand / Reorder level</th></tr>
      ${rows}
    </table>
    ${totalInventoryValue !== undefined ? `<p style="color:#3A5C52;">Total inventory value: ${formatMoney(totalInventoryValue)}</p>` : ''}
    <p>Consider raising a purchase order for these items in Inventory → Purchase Orders.</p>
  `;
  return { subject: `Low Stock Alert — ${items.length} item${items.length === 1 ? '' : 's'} need reordering`, html: wrapper(hotelName, body) };
}

module.exports = { bookingConfirmationEmail, invoiceReceiptEmail, lowStockDigestEmail };
