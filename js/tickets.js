// ============================================
// TICKETS.JS - Receipt generation & printing
// ============================================
const Tickets = {
  businessData: null,

  init(businessData) {
    this.businessData = businessData;
  },

  formatMoney(n) {
    return '$' + (Number(n) || 0).toFixed(2);
  },

  formatDate(d) {
    return new Date(d).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' });
  },

  generateSaleTicket(sale, items) {
    const b = this.businessData || {};
    const width = b.ticket_width || 80;
    const sep = '─'.repeat(width === 58 ? 32 : 42);

    let ticket = '';
    ticket += this.center(b.name || 'Mi Tienda', width) + '\n';
    if (b.address) ticket += this.center(b.address, width) + '\n';
    if (b.phone) ticket += this.center('Tel: ' + b.phone, width) + '\n';
    if (b.rfc) ticket += this.center('RFC: ' + b.rfc, width) + '\n';
    ticket += sep + '\n';
    ticket += `Ticket #${sale.sale_number || ''}\n`;
    ticket += `Fecha: ${this.formatDate(sale.created_at)}\n`;
    if (sale.is_credit && sale.customers?.name) {
      ticket += `Cliente: ${sale.customers.name}\n`;
    }
    ticket += sep + '\n';

    items.forEach(item => {
      const name = item.product_name.substring(0, 20);
      const qty = Number(item.quantity);
      const price = Number(item.unit_price);
      const sub = Number(item.subtotal);
      ticket += `${name}\n`;
      ticket += `  ${qty} x ${this.formatMoney(price)}`;
      ticket += `  = ${this.formatMoney(sub)}\n`;
    });

    ticket += sep + '\n';
    if (sale.discount > 0) {
      ticket += `Descuento: -${this.formatMoney(sale.discount)}\n`;
    }
    ticket += `TOTAL: ${this.formatMoney(sale.total)}\n`;

    const methods = { cash: 'Efectivo', card: 'Tarjeta', transfer: 'Transferencia', credit: 'Fiado', mixed: 'Mixto' };
    ticket += `Pago: ${methods[sale.payment_method] || sale.payment_method}\n`;

    if (sale.payment_method === 'cash' && sale.cash_received) {
      ticket += `Recibido: ${this.formatMoney(sale.cash_received)}\n`;
      ticket += `Cambio: ${this.formatMoney(sale.change_given)}\n`;
    }

    ticket += sep + '\n';
    ticket += this.center(b.ticket_footer || '¡Gracias por su compra!', width) + '\n';
    return ticket;
  },

  generateCreditTicket(customer, sale, items) {
    const b = this.businessData || {};
    const sep = '─'.repeat(42);
    let ticket = '';
    ticket += this.center(b.name || 'Mi Tienda') + '\n';
    ticket += this.center('COMPROBANTE DE CRÉDITO') + '\n';
    ticket += sep + '\n';
    ticket += `Cliente: ${customer.name}\n`;
    ticket += `Fecha: ${this.formatDate(sale.created_at)}\n`;
    ticket += sep + '\n';
    items.forEach(item => {
      ticket += `${item.product_name}\n  ${item.quantity} x ${this.formatMoney(item.unit_price)} = ${this.formatMoney(item.subtotal)}\n`;
    });
    ticket += sep + '\n';
    ticket += `Total Fiado: ${this.formatMoney(sale.total)}\n`;
    ticket += `Saldo Anterior: ${this.formatMoney(customer.balance - sale.total)}\n`;
    ticket += `Saldo Actual: ${this.formatMoney(customer.balance)}\n`;
    ticket += sep + '\n';
    return ticket;
  },

  generatePaymentTicket(customer, amount, newBalance) {
    const b = this.businessData || {};
    const sep = '─'.repeat(42);
    let ticket = '';
    ticket += this.center(b.name || 'Mi Tienda') + '\n';
    ticket += this.center('COMPROBANTE DE ABONO') + '\n';
    ticket += sep + '\n';
    ticket += `Cliente: ${customer.name}\n`;
    ticket += `Fecha: ${this.formatDate(new Date())}\n`;
    ticket += sep + '\n';
    ticket += `Abono: ${this.formatMoney(amount)}\n`;
    ticket += `Saldo Restante: ${this.formatMoney(newBalance)}\n`;
    ticket += sep + '\n';
    return ticket;
  },

  generateCashReport(session, movements) {
    const b = this.businessData || {};
    const sep = '─'.repeat(42);
    let ticket = '';
    ticket += this.center(b.name || 'Mi Tienda') + '\n';
    ticket += this.center('CORTE DE CAJA') + '\n';
    ticket += sep + '\n';
    ticket += `Apertura: ${this.formatDate(session.opened_at)}\n`;
    ticket += `Cierre: ${this.formatDate(session.closed_at || new Date())}\n`;
    ticket += sep + '\n';
    ticket += `Fondo Inicial:   ${this.formatMoney(session.opening_amount)}\n`;
    ticket += `Ventas Efectivo: ${this.formatMoney(session.cash_sales)}\n`;
    ticket += `Ventas Tarjeta:  ${this.formatMoney(session.card_sales)}\n`;
    ticket += `Ventas Transfer: ${this.formatMoney(session.transfer_sales)}\n`;
    ticket += `Ventas Fiado:    ${this.formatMoney(session.credit_sales)}\n`;
    ticket += `Abonos Recibidos:${this.formatMoney(session.payments_received)}\n`;
    ticket += `Depósitos:       ${this.formatMoney(session.total_deposits)}\n`;
    ticket += `Retiros:        -${this.formatMoney(session.total_withdrawals)}\n`;
    ticket += `Gastos:         -${this.formatMoney(session.total_expenses)}\n`;
    ticket += sep + '\n';
    ticket += `Esperado:   ${this.formatMoney(session.expected_amount)}\n`;
    ticket += `Contado:    ${this.formatMoney(session.closing_amount)}\n`;
    const diff = (session.closing_amount || 0) - (session.expected_amount || 0);
    ticket += `Diferencia: ${this.formatMoney(diff)} ${diff >= 0 ? '(Sobrante)' : '(Faltante)'}\n`;
    ticket += sep + '\n';
    return ticket;
  },

  center(text, width = 42) {
    const pad = Math.max(0, Math.floor((width - text.length) / 2));
    return ' '.repeat(pad) + text;
  },

  print(ticketText) {
    const printArea = document.getElementById('ticket-print');
    if (!printArea) return;
    printArea.innerHTML = `<pre style="font-family:monospace;font-size:12px;white-space:pre-wrap;margin:0;padding:8px;">${ticketText}</pre>`;
    printArea.classList.remove('hidden');
    window.print();
    setTimeout(() => printArea.classList.add('hidden'), 500);
  },

  showTicketModal(ticketText, title = 'Ticket') {
    App.showModal(`
      <div class="modal-header">
        <h3>${title}</h3>
        <button class="modal-close" onclick="App.closeModal()">✕</button>
      </div>
      <div class="modal-body">
        <pre style="font-family:monospace;font-size:13px;background:var(--bg-surface);padding:16px;border-radius:8px;overflow-x:auto;white-space:pre-wrap;">${ticketText}</pre>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline" onclick="App.closeModal()">Cerrar</button>
        <button class="btn btn-primary" onclick="Tickets.print(\`${ticketText.replace(/`/g, '\\`')}\`)">🖨️ Imprimir</button>
      </div>
    `);
  }
};
