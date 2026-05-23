// ============================================
// CUSTOMERS.JS - Customers & Credit (Fiado)
// ============================================
const Customers = {
  customers: [],
  searchTerm: '',

  async render() {
    this.customers = await DB.getCustomers();
    const totalDebt = this.customers.reduce((s, c) => s + (c.balance || 0), 0);
    const debtors = this.customers.filter(c => c.balance > 0);

    document.getElementById('section-customers').innerHTML = `
      <div class="kpi-grid">
        <div class="kpi-card primary"><div class="kpi-label">Total Clientes</div><div class="kpi-value">${this.customers.length}</div></div>
        <div class="kpi-card danger"><div class="kpi-label">Total por Cobrar</div><div class="kpi-value">$${totalDebt.toFixed(2)}</div></div>
        <div class="kpi-card warning"><div class="kpi-label">Clientes con Deuda</div><div class="kpi-value">${debtors.length}</div></div>
      </div>
      <div class="inv-toolbar">
        <div class="search-box" style="flex:1"><span class="search-icon">🔍</span>
          <input class="form-input" style="padding-left:36px" placeholder="Buscar cliente..." oninput="Customers.search(this.value)">
        </div>
        <button class="btn btn-primary" onclick="Customers.showForm()">➕ Nuevo Cliente</button>
      </div>
      <div class="customer-grid" id="customer-grid">${this.renderCustomers()}</div>
    `;
  },

  renderCustomers() {
    let filtered = this.customers;
    if (this.searchTerm) {
      const s = this.searchTerm.toLowerCase();
      filtered = filtered.filter(c => c.name.toLowerCase().includes(s) || (c.phone || '').includes(s));
    }
    if (!filtered.length) return '<div class="empty-state"><div class="empty-icon">👥</div><h3>Sin clientes</h3></div>';
    return filtered.map(c => `
      <div class="customer-card">
        <div class="cc-header">
          <div>
            <div class="cc-name">${c.name} ${c.is_blocked ? '<span class="badge badge-danger">Bloqueado</span>' : ''}</div>
            <div class="cc-info">${c.phone || 'Sin teléfono'} · ${c.address || 'Sin dirección'}</div>
          </div>
          <div class="cc-balance ${c.balance > 0 ? 'has-debt' : ''}">$${Number(c.balance).toFixed(2)}</div>
        </div>
        <div style="font-size:0.8rem;color:var(--text-muted)">Límite: $${Number(c.credit_limit).toFixed(2)} · Disponible: $${Math.max(0, c.credit_limit - c.balance).toFixed(2)}</div>
        <div class="cc-actions">
          <button class="btn btn-success btn-sm" onclick="Customers.showPaymentForm('${c.id}')">💵 Abono</button>
          <button class="btn btn-outline btn-sm" onclick="Customers.showHistory('${c.id}')">📋 Historial</button>
          <button class="btn btn-ghost btn-sm" onclick="Customers.showForm('${c.id}')">✏️</button>
          <button class="btn btn-ghost btn-sm" onclick="Customers.deleteCustomer('${c.id}')">🗑️</button>
        </div>
      </div>
    `).join('');
  },

  search(term) {
    this.searchTerm = term;
    document.getElementById('customer-grid').innerHTML = this.renderCustomers();
  },

  showForm(customerId) {
    let c = { name: '', phone: '', address: '', credit_limit: 500 };
    if (customerId) c = this.customers.find(cu => cu.id === customerId) || c;
    App.showModal(`
      <div class="modal-header"><h3>${customerId ? '✏️ Editar' : '➕ Nuevo'} Cliente</h3><button class="modal-close" onclick="App.closeModal()">✕</button></div>
      <div class="modal-body">
        <div class="form-group"><label class="form-label">Nombre *</label><input type="text" id="cf-name" class="form-input" value="${c.name}"></div>
        <div class="grid-2">
          <div class="form-group"><label class="form-label">Teléfono</label><input type="tel" id="cf-phone" class="form-input" value="${c.phone || ''}"></div>
          <div class="form-group"><label class="form-label">Límite de Crédito</label><input type="number" id="cf-limit" class="form-input" value="${c.credit_limit}"></div>
        </div>
        <div class="form-group"><label class="form-label">Dirección</label><input type="text" id="cf-address" class="form-input" value="${c.address || ''}"></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline" onclick="App.closeModal()">Cancelar</button>
        <button class="btn btn-primary" onclick="Customers.saveCustomer('${customerId || ''}')">💾 Guardar</button>
      </div>
    `);
  },

  async saveCustomer(id) {
    const data = {
      name: document.getElementById('cf-name').value,
      phone: document.getElementById('cf-phone').value,
      address: document.getElementById('cf-address').value,
      credit_limit: parseFloat(document.getElementById('cf-limit').value) || 500,
    };
    if (!data.name) return App.toast('El nombre es requerido', 'error');
    if (id) data.id = id;
    try {
      await DB.saveCustomer(data);
      App.toast(id ? 'Cliente actualizado' : 'Cliente registrado', 'success');
      App.closeModal();
      this.render();
    } catch (e) { App.toast('Error: ' + e.message, 'error'); }
  },

  async deleteCustomer(id) {
    const c = this.customers.find(cu => cu.id === id);
    if (c && c.balance > 0) return App.toast('No se puede eliminar un cliente con deuda', 'error');
    if (!confirm('¿Eliminar este cliente?')) return;
    await DB.deleteCustomer(id);
    App.toast('Cliente eliminado', 'success');
    this.render();
  },

  showPaymentForm(customerId) {
    const c = this.customers.find(cu => cu.id === customerId);
    if (!c) return;
    App.showModal(`
      <div class="modal-header"><h3>💵 Registrar Abono</h3><button class="modal-close" onclick="App.closeModal()">✕</button></div>
      <div class="modal-body">
        <p><strong>${c.name}</strong></p>
        <p>Saldo actual: <strong class="text-danger">$${Number(c.balance).toFixed(2)}</strong></p>
        <div class="form-group mt-16"><label class="form-label">Monto del abono</label>
          <input type="number" id="pay-amount" class="form-input cash-input" step="0.01" value="${c.balance.toFixed(2)}">
        </div>
        <div class="form-group"><label class="form-label">Notas</label><input type="text" id="pay-notes" class="form-input" placeholder="Opcional"></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline" onclick="App.closeModal()">Cancelar</button>
        <button class="btn btn-success" onclick="Customers.confirmPayment('${customerId}')">✅ Registrar Abono</button>
      </div>
    `);
  },

  async confirmPayment(customerId) {
    const amount = parseFloat(document.getElementById('pay-amount').value) || 0;
    const notes = document.getElementById('pay-notes').value;
    if (amount <= 0) return App.toast('Monto inválido', 'error');
    const customer = await DB.getCustomerById(customerId);
    const newBalance = await DB.addPayment(customerId, amount, notes);
    // Update cash session
    const session = await DB.getCurrentSession();
    if (session) await DB.updateSessionTotals(session.id, 'payments_received', amount);
    Sounds.play('cash');
    App.toast(`Abono de $${amount.toFixed(2)} registrado`, 'success');
    const ticketText = Tickets.generatePaymentTicket(customer, amount, newBalance);
    App.closeModal();
    setTimeout(() => Tickets.showTicketModal(ticketText, 'Comprobante de Abono'), 300);
    this.render();
  },

  async showHistory(customerId) {
    const customer = this.customers.find(c => c.id === customerId);
    const history = await DB.getCreditHistory(customerId);
    App.showModal(`
      <div class="modal-header"><h3>📋 Historial: ${customer?.name}</h3><button class="modal-close" onclick="App.closeModal()">✕</button></div>
      <div class="modal-body">
        <p>Saldo actual: <strong class="${customer.balance > 0 ? 'text-danger' : 'text-success'}">$${Number(customer.balance).toFixed(2)}</strong></p>
        <div class="table-container mt-16"><table>
          <thead><tr><th>Fecha</th><th>Tipo</th><th>Monto</th><th>Saldo</th><th>Notas</th></tr></thead>
          <tbody>${history.map(h => `
            <tr>
              <td>${new Date(h.created_at).toLocaleDateString('es-MX')}</td>
              <td><span class="badge ${h.type === 'credit' ? 'badge-danger' : 'badge-success'}">${h.type === 'credit' ? 'Fiado' : 'Abono'}</span></td>
              <td class="font-bold ${h.type === 'credit' ? 'text-danger' : 'text-success'}">${h.type === 'credit' ? '+' : '-'}$${Number(h.amount).toFixed(2)}</td>
              <td>$${Number(h.balance_after).toFixed(2)}</td>
              <td class="text-muted">${h.notes || '-'}</td>
            </tr>
          `).join('')}</tbody>
        </table></div>
      </div>
    `, 'modal-lg');
  }
};
