// ============================================
// REPORTS.JS - Reports & Analytics Dashboard
// ============================================
const Reports = {
  charts: {},
  dateFrom: '',
  dateTo: '',

  async render() {
    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
    if (!this.dateFrom) this.dateFrom = weekAgo;
    if (!this.dateTo) this.dateTo = today;

    let report, topProducts, lowStock, totalCredit, expenses, totalExpenses, profit;
    try {
      report = await DB.getSalesReport(this.dateFrom + 'T00:00:00', this.dateTo + 'T23:59:59');
      topProducts = await DB.getTopProducts(this.dateFrom + 'T00:00:00', this.dateTo + 'T23:59:59');
      lowStock = await DB.getLowStockProducts();
      totalCredit = await DB.getTotalCredit();
      expenses = await DB.getExpenses(this.dateFrom + 'T00:00:00', this.dateTo + 'T23:59:59');
      totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
      profit = report.totalSales - totalExpenses;
    } catch (err) {
      console.error("Error loading reports data:", err);
      document.getElementById('section-reports').innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">❌</div>
          <h3>Error al cargar los reportes</h3>
          <p class="text-muted">${err.message || JSON.stringify(err)}</p>
          <button class="btn btn-primary mt-16" onclick="Reports.render()">🔄 Reintentar</button>
        </div>
      `;
      return;
    }

    document.getElementById('section-reports').innerHTML = `
      <div class="inv-toolbar mb-24">
        <div class="flex gap-8 items-center">
          <input type="date" class="form-input" value="${this.dateFrom}" onchange="Reports.dateFrom=this.value;Reports.render()" style="width:160px">
          <span class="text-muted">a</span>
          <input type="date" class="form-input" value="${this.dateTo}" onchange="Reports.dateTo=this.value;Reports.render()" style="width:160px">
          <button class="btn btn-outline btn-sm" onclick="Reports.setRange('today')">Hoy</button>
          <button class="btn btn-outline btn-sm" onclick="Reports.setRange('week')">Semana</button>
          <button class="btn btn-outline btn-sm" onclick="Reports.setRange('month')">Mes</button>
        </div>
        <button class="btn btn-outline" onclick="Reports.exportReport()">📥 Exportar Excel</button>
      </div>
      <div class="kpi-grid">
        <div class="kpi-card success"><div class="kpi-label">Ventas Totales</div><div class="kpi-value">$${report.totalSales.toFixed(2)}</div><div class="kpi-sub">${report.count} ventas</div></div>
        <div class="kpi-card primary"><div class="kpi-label">Utilidad Bruta</div><div class="kpi-value">$${profit.toFixed(2)}</div><div class="kpi-sub">Ventas - Gastos</div></div>
        <div class="kpi-card danger"><div class="kpi-label">Cuentas por Cobrar</div><div class="kpi-value">$${totalCredit.toFixed(2)}</div></div>
        <div class="kpi-card warning"><div class="kpi-label">Stock Bajo</div><div class="kpi-value">${lowStock.length}</div><div class="kpi-sub">productos</div></div>
      </div>
      <div class="reports-grid">
        <div class="chart-container"><h4 class="mb-16">📊 Ventas por Día</h4><canvas id="chart-daily"></canvas></div>
        <div class="chart-container"><h4 class="mb-16">🏆 Top Productos</h4><canvas id="chart-top"></canvas></div>
        <div class="chart-container"><h4 class="mb-16">💳 Formas de Pago</h4><canvas id="chart-payment"></canvas></div>
        <div class="chart-container"><h4 class="mb-16">💸 Gastos por Categoría</h4><canvas id="chart-expenses"></canvas></div>
      </div>
      ${lowStock.length ? `
        <div class="card mt-24"><div class="card-header"><h3 class="card-title">⚠️ Productos con Stock Bajo</h3></div>
          <div class="table-container"><table><thead><tr><th>Producto</th><th>Stock</th><th>Mínimo</th></tr></thead>
          <tbody>${lowStock.map(p => `<tr><td>${p.name}</td><td class="text-danger font-bold">${p.stock} ${p.unit}</td><td>${p.min_stock}</td></tr>`).join('')}</tbody></table></div>
        </div>` : ''}
    `;

    this.renderCharts(report, topProducts, expenses);
  },

  renderCharts(report, topProducts, expenses) {
    Object.values(this.charts).forEach(c => c.destroy());
    this.charts = {};
    const chartColors = ['#6C63FF','#00D9A6','#FF6B6B','#FFB347','#4ECDC4','#E8E8F0','#8B83FF','#00B88A','#FF8C8C','#FFD180'];
    const defaultOpts = { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#8b8ba7' } } }, scales: { x: { ticks: { color: '#8b8ba7' }, grid: { color: '#2d3154' } }, y: { ticks: { color: '#8b8ba7' }, grid: { color: '#2d3154' } } } };

    // Daily sales chart
    const dailyMap = {};
    report.sales.forEach(s => {
      const day = new Date(s.created_at).toLocaleDateString('es-MX', { month: 'short', day: 'numeric' });
      dailyMap[day] = (dailyMap[day] || 0) + s.total;
    });
    const ctx1 = document.getElementById('chart-daily');
    if (ctx1) {
      this.charts.daily = new Chart(ctx1, {
        type: 'bar', data: { labels: Object.keys(dailyMap), datasets: [{ label: 'Ventas $', data: Object.values(dailyMap), backgroundColor: '#6C63FF88', borderColor: '#6C63FF', borderWidth: 1, borderRadius: 6 }] },
        options: { ...defaultOpts }
      });
    }

    // Top products
    const ctx2 = document.getElementById('chart-top');
    if (ctx2 && topProducts.length) {
      this.charts.top = new Chart(ctx2, {
        type: 'bar', data: { labels: topProducts.map(p => p.name.substring(0, 15)), datasets: [{ label: 'Cantidad', data: topProducts.map(p => p.qty), backgroundColor: chartColors }] },
        options: { ...defaultOpts, indexAxis: 'y' }
      });
    }

    // Payment methods
    const ctx3 = document.getElementById('chart-payment');
    if (ctx3) {
      this.charts.payment = new Chart(ctx3, {
        type: 'doughnut', data: { labels: ['Efectivo', 'Tarjeta', 'Transferencia', 'Fiado'], datasets: [{ data: [report.cashSales, report.cardSales, report.totalSales - report.cashSales - report.cardSales - report.creditSales, report.creditSales], backgroundColor: ['#00D9A6', '#6C63FF', '#FFB347', '#FF6B6B'] }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#8b8ba7' } } } }
      });
    }

    // Expenses by category
    const expByCat = {};
    expenses.forEach(e => { expByCat[e.category] = (expByCat[e.category] || 0) + e.amount; });
    const ctx4 = document.getElementById('chart-expenses');
    if (ctx4 && Object.keys(expByCat).length) {
      this.charts.expenses = new Chart(ctx4, {
        type: 'pie', data: { labels: Object.keys(expByCat), datasets: [{ data: Object.values(expByCat), backgroundColor: chartColors }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#8b8ba7' } } } }
      });
    }
  },

  setRange(range) {
    const today = new Date();
    if (range === 'today') { this.dateFrom = this.dateTo = today.toISOString().split('T')[0]; }
    else if (range === 'week') { this.dateFrom = new Date(today - 7 * 86400000).toISOString().split('T')[0]; this.dateTo = today.toISOString().split('T')[0]; }
    else if (range === 'month') { this.dateFrom = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0]; this.dateTo = today.toISOString().split('T')[0]; }
    this.render();
  },

  async exportReport() {
    const report = await DB.getSalesReport(this.dateFrom + 'T00:00:00', this.dateTo + 'T23:59:59');
    const data = report.sales.map(s => ({
      Ticket: s.sale_number, Fecha: new Date(s.created_at).toLocaleString('es-MX'),
      Total: s.total, Pago: s.payment_method, Descuento: s.discount, Fiado: s.is_credit ? 'Sí' : 'No'
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Ventas');
    XLSX.writeFile(wb, `reporte_ventas_${this.dateFrom}_${this.dateTo}.xlsx`);
    App.toast('Reporte exportado', 'success');
  }
};
