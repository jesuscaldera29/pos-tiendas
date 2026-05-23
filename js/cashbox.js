// ============================================
// CASHBOX.JS - Cash Register Management
// ============================================
const Cashbox = {
  session: null,

  async render() {
    this.session = await DB.getCurrentSession();
    const container = document.getElementById('section-cashbox');

    if (!this.session) {
      container.innerHTML = `
        <div class="empty-state" style="max-width:500px;margin:40px auto;">
          <div class="empty-icon">💰</div>
          <h3>Caja Cerrada</h3>
          <p class="text-muted mb-24">Abre la caja para comenzar a registrar ventas</p>
          <div class="form-group"><label class="form-label">Monto inicial en caja ($)</label>
            <input type="number" id="open-amount" class="form-input cash-input" value="0" step="0.01">
          </div>
          <button class="btn btn-success btn-lg w-full" onclick="Cashbox.open()">🔓 Abrir Caja</button>
          <div class="mt-24"><h4 class="mb-16">📋 Historial de Cortes</h4><div id="session-history"></div></div>
        </div>
      `;
      this.loadHistory();
      return;
    }

    const elapsed = this.getElapsed(this.session.opened_at);
    const expected = (this.session.opening_amount || 0) + (this.session.cash_sales || 0) +
      (this.session.payments_received || 0) + (this.session.total_deposits || 0) -
      (this.session.total_withdrawals || 0) - (this.session.total_expenses || 0);

    container.innerHTML = `
      <div class="kpi-grid">
        <div class="kpi-card success"><div class="kpi-label">Fondo Inicial</div><div class="kpi-value">$${Number(this.session.opening_amount).toFixed(2)}</div></div>
        <div class="kpi-card primary"><div class="kpi-label">Ventas Efectivo</div><div class="kpi-value">$${Number(this.session.cash_sales).toFixed(2)}</div></div>
        <div class="kpi-card warning"><div class="kpi-label">Ventas Tarjeta</div><div class="kpi-value">$${Number(this.session.card_sales).toFixed(2)}</div></div>
        <div class="kpi-card danger"><div class="kpi-label">Ventas Fiado</div><div class="kpi-value">$${Number(this.session.credit_sales).toFixed(2)}</div></div>
      </div>
      <div class="grid-2">
        <div class="card">
          <div class="card-header"><h3 class="card-title">📊 Resumen de Caja</h3><span class="badge badge-success">Abierta · ${elapsed}</span></div>
          <div class="total-row flex justify-between" style="padding:8px 0"><span>Fondo inicial</span><span>$${Number(this.session.opening_amount).toFixed(2)}</span></div>
          <div class="total-row flex justify-between" style="padding:8px 0"><span>+ Ventas efectivo</span><span class="text-success">$${Number(this.session.cash_sales).toFixed(2)}</span></div>
          <div class="total-row flex justify-between" style="padding:8px 0"><span>+ Abonos recibidos</span><span class="text-success">$${Number(this.session.payments_received).toFixed(2)}</span></div>
          <div class="total-row flex justify-between" style="padding:8px 0"><span>+ Depósitos</span><span class="text-success">$${Number(this.session.total_deposits).toFixed(2)}</span></div>
          <div class="total-row flex justify-between" style="padding:8px 0"><span>- Retiros</span><span class="text-danger">$${Number(this.session.total_withdrawals).toFixed(2)}</span></div>
          <div class="total-row flex justify-between" style="padding:8px 0"><span>- Gastos</span><span class="text-danger">$${Number(this.session.total_expenses).toFixed(2)}</span></div>
          <div class="total-row flex justify-between font-bold" style="padding:12px 0;border-top:2px solid var(--border);margin-top:8px;font-size:1.2rem">
            <span>Efectivo Esperado</span><span>$${expected.toFixed(2)}</span>
          </div>
        </div>
        <div class="card">
          <div class="card-header"><h3 class="card-title">Acciones</h3></div>
          <div class="flex flex-col gap-12">
            <button class="btn btn-success w-full" onclick="Cashbox.addMovement('deposit')">➕ Depositar Efectivo</button>
            <button class="btn btn-warning w-full" onclick="Cashbox.addMovement('withdrawal')">➖ Retirar Efectivo</button>
            <button class="btn btn-danger w-full btn-lg" onclick="Cashbox.showClose(${expected})">🔒 Cerrar Caja (Corte)</button>
          </div>
          <div class="mt-24"><h4 class="mb-16">Movimientos del día</h4><div id="movements-list"></div></div>
        </div>
      </div>
    `;
    this.loadMovements();
  },

  async open() {
    const amount = parseFloat(document.getElementById('open-amount').value) || 0;
    try {
      await DB.openSession(amount);
      Sounds.play('cash');
      App.toast('Caja abierta con $' + amount.toFixed(2), 'success');
      this.render();
    } catch (e) { App.toast('Error: ' + e.message, 'error'); }
  },

  showClose(expected) {
    App.showModal(`
      <div class="modal-header"><h3>🔒 Cerrar Caja - Corte</h3><button class="modal-close" onclick="App.closeModal()">✕</button></div>
      <div class="modal-body">
        <p class="mb-16">Efectivo esperado: <strong>$${expected.toFixed(2)}</strong></p>
        <div class="form-group"><label class="form-label">Efectivo contado en caja</label>
          <input type="number" id="close-amount" class="form-input cash-input" step="0.01" oninput="Cashbox.calcDiff(${expected})">
        </div>
        <div id="close-diff" class="change-display"><div class="change-label">Diferencia</div><div class="change-amount">$0.00</div></div>
        <div class="form-group mt-16"><label class="form-label">Notas</label><textarea id="close-notes" class="form-textarea" placeholder="Observaciones..."></textarea></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline" onclick="App.closeModal()">Cancelar</button>
        <button class="btn btn-danger" onclick="Cashbox.confirmClose(${expected})">🔒 Confirmar Cierre</button>
      </div>
    `);
  },

  calcDiff(expected) {
    const counted = parseFloat(document.getElementById('close-amount').value) || 0;
    const diff = counted - expected;
    const el = document.getElementById('close-diff');
    el.innerHTML = `<div class="change-label">Diferencia</div>
      <div class="change-amount" style="color:${diff >= 0 ? 'var(--success)' : 'var(--danger)'}">
        $${diff.toFixed(2)} ${diff > 0 ? '(Sobrante)' : diff < 0 ? '(Faltante)' : ''}
      </div>`;
  },

  async confirmClose(expected) {
    const closing = parseFloat(document.getElementById('close-amount').value) || 0;
    const notes = document.getElementById('close-notes').value;
    const diff = closing - expected;
    try {
      const session = await DB.closeSession(this.session.id, {
        closing_amount: closing, expected_amount: expected, difference: diff, notes
      });
      Sounds.play('cash');
      App.toast('Caja cerrada correctamente', 'success');
      // Generate and show cash report ticket
      const movements = await DB.getSessionMovements(this.session.id);
      const ticketText = Tickets.generateCashReport({ ...this.session, closing_amount: closing, expected_amount: expected, closed_at: new Date() }, movements);
      App.closeModal();
      setTimeout(() => Tickets.showTicketModal(ticketText, 'Corte de Caja'), 300);
      this.render();
    } catch (e) { App.toast('Error: ' + e.message, 'error'); }
  },

  addMovement(type) {
    const label = type === 'deposit' ? 'Depósito' : 'Retiro';
    App.showModal(`
      <div class="modal-header"><h3>${type === 'deposit' ? '➕' : '➖'} ${label} de Efectivo</h3><button class="modal-close" onclick="App.closeModal()">✕</button></div>
      <div class="modal-body">
        <div class="form-group"><label class="form-label">Monto</label><input type="number" id="mov-amount" class="form-input" step="0.01"></div>
        <div class="form-group"><label class="form-label">Razón</label><input type="text" id="mov-reason" class="form-input" placeholder="Motivo del ${label.toLowerCase()}"></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline" onclick="App.closeModal()">Cancelar</button>
        <button class="btn btn-primary" onclick="Cashbox.confirmMovement('${type}')">Confirmar</button>
      </div>
    `);
  },

  async confirmMovement(type) {
    const amount = parseFloat(document.getElementById('mov-amount').value) || 0;
    const reason = document.getElementById('mov-reason').value;
    if (amount <= 0) return App.toast('Monto inválido', 'error');
    await DB.addCashMovement(this.session.id, type, amount, reason);
    App.toast(`${type === 'deposit' ? 'Depósito' : 'Retiro'} registrado`, 'success');
    App.closeModal();
    this.render();
  },

  async loadMovements() {
    if (!this.session) return;
    const movements = await DB.getSessionMovements(this.session.id);
    const el = document.getElementById('movements-list');
    if (!el) return;
    if (!movements.length) { el.innerHTML = '<p class="text-muted">Sin movimientos</p>'; return; }
    el.innerHTML = movements.map(m => `
      <div class="flex items-center justify-between" style="padding:8px 0;border-bottom:1px solid var(--border);">
        <div><span class="badge ${m.type === 'deposit' ? 'badge-success' : 'badge-warning'}">${m.type === 'deposit' ? 'Depósito' : 'Retiro'}</span>
        <span class="text-muted" style="margin-left:8px;font-size:0.8rem">${m.reason || ''}</span></div>
        <span class="font-bold ${m.type === 'deposit' ? 'text-success' : 'text-warning'}">$${Number(m.amount).toFixed(2)}</span>
      </div>
    `).join('');
  },

  async loadHistory() {
    const sessions = await DB.getSessionHistory();
    const el = document.getElementById('session-history');
    if (!el) return;
    if (!sessions.length) { el.innerHTML = '<p class="text-muted">Sin historial</p>'; return; }
    el.innerHTML = `<div class="table-container"><table>
      <thead><tr><th>Fecha</th><th>Apertura</th><th>Cierre</th><th>Diferencia</th></tr></thead>
      <tbody>${sessions.filter(s => s.status === 'closed').slice(0, 10).map(s => {
        const diff = s.difference || 0;
        return `<tr>
          <td>${new Date(s.opened_at).toLocaleDateString('es-MX')}</td>
          <td>$${Number(s.opening_amount).toFixed(2)}</td>
          <td>$${Number(s.closing_amount).toFixed(2)}</td>
          <td class="${diff >= 0 ? 'text-success' : 'text-danger'} font-bold">$${diff.toFixed(2)}</td>
        </tr>`;
      }).join('')}</tbody>
    </table></div>`;
  },

  getElapsed(start) {
    const ms = Date.now() - new Date(start).getTime();
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return `${h}h ${m}m`;
  }
};
