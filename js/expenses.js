// ============================================
// EXPENSES.JS - Expense Management
// ============================================
const Expenses = {
  expenses: [],
  categories: ['Renta', 'Luz', 'Agua', 'Internet', 'Proveedores', 'Personal', 'Transporte', 'Limpieza', 'Mantenimiento', 'Otros'],
  dateFrom: '',
  dateTo: '',

  async render() {
    const today = new Date().toISOString().split('T')[0];
    if (!this.dateFrom) this.dateFrom = today;
    if (!this.dateTo) this.dateTo = today;
    try {
      this.expenses = await DB.getExpenses(this.dateFrom + 'T00:00:00', this.dateTo + 'T23:59:59');
    } catch (err) {
      console.error("Error loading expenses:", err);
      document.getElementById('section-expenses').innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">❌</div>
          <h3>Error al cargar los gastos</h3>
          <p class="text-muted">${err.message || JSON.stringify(err)}</p>
          <button class="btn btn-primary mt-16" onclick="Expenses.render()">🔄 Reintentar</button>
        </div>
      `;
      return;
    }
    const total = this.expenses.reduce((s, e) => s + e.amount, 0);
    const byCategory = {};
    this.expenses.forEach(e => { byCategory[e.category] = (byCategory[e.category] || 0) + e.amount; });

    document.getElementById('section-expenses').innerHTML = `
      <div class="kpi-grid">
        <div class="kpi-card danger"><div class="kpi-label">Total Gastos</div><div class="kpi-value">$${total.toFixed(2)}</div><div class="kpi-sub">${this.expenses.length} gastos registrados</div></div>
        ${Object.entries(byCategory).slice(0, 3).map(([cat, amt]) => `
          <div class="kpi-card warning"><div class="kpi-label">${cat}</div><div class="kpi-value">$${amt.toFixed(2)}</div></div>
        `).join('')}
      </div>
      <div class="inv-toolbar">
        <div class="flex gap-8 items-center">
          <input type="date" class="form-input" value="${this.dateFrom}" onchange="Expenses.dateFrom=this.value;Expenses.render()" style="width:160px">
          <span class="text-muted">a</span>
          <input type="date" class="form-input" value="${this.dateTo}" onchange="Expenses.dateTo=this.value;Expenses.render()" style="width:160px">
        </div>
        <button class="btn btn-primary" onclick="Expenses.showForm()">➕ Registrar Gasto</button>
      </div>
      <div class="table-container">
        <table>
          <thead><tr><th>Fecha</th><th>Categoría</th><th>Descripción</th><th>Monto</th><th></th></tr></thead>
          <tbody>${!this.expenses.length ? '<tr><td colspan="5" class="text-center text-muted" style="padding:40px">Sin gastos en este período</td></tr>' :
            this.expenses.map(e => `
              <tr>
                <td>${new Date(e.created_at).toLocaleDateString('es-MX')}</td>
                <td><span class="badge badge-warning">${e.category}</span></td>
                <td>${e.description || '-'}</td>
                <td class="font-bold text-danger">$${Number(e.amount).toFixed(2)}</td>
                <td><button class="btn btn-ghost btn-sm" onclick="Expenses.deleteExpense('${e.id}')">🗑️</button></td>
              </tr>
            `).join('')
          }</tbody>
        </table>
      </div>
    `;
  },

  showForm() {
    App.showModal(`
      <div class="modal-header"><h3>➕ Registrar Gasto</h3><button class="modal-close" onclick="App.closeModal()">✕</button></div>
      <div class="modal-body">
        <div class="form-group"><label class="form-label">Categoría</label>
          <select id="exp-cat" class="form-select">
            ${this.categories.map(c => `<option>${c}</option>`).join('')}
          </select>
        </div>
        <div class="form-group"><label class="form-label">Monto *</label>
          <input type="number" id="exp-amount" class="form-input" step="0.01" placeholder="0.00">
        </div>
        <div class="form-group"><label class="form-label">Descripción</label>
          <input type="text" id="exp-desc" class="form-input" placeholder="Detalle del gasto">
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline" onclick="App.closeModal()">Cancelar</button>
        <button class="btn btn-primary" onclick="Expenses.save()">💾 Guardar</button>
      </div>
    `);
  },

  async save() {
    const amount = parseFloat(document.getElementById('exp-amount').value) || 0;
    if (amount <= 0) return App.toast('Monto inválido', 'error');
    try {
      await DB.saveExpense({
        category: document.getElementById('exp-cat').value,
        amount,
        description: document.getElementById('exp-desc').value
      });
      App.toast('Gasto registrado', 'success');
      App.closeModal();
      this.render();
    } catch (e) { App.toast('Error: ' + e.message, 'error'); }
  },

  async deleteExpense(id) {
    if (!confirm('¿Eliminar este gasto?')) return;
    await DB.deleteExpense(id);
    App.toast('Gasto eliminado', 'success');
    this.render();
  }
};
