// ============================================
// POS.JS - Point of Sale Module
// ============================================
const POS = {
  cart: [],
  products: [],
  categories: [],
  selectedCategory: null,
  searchTerm: '',
  discount: 0,

  async render() {
    try {
      this.products = await DB.getProducts();
      this.categories = await DB.getCategories();
    } catch (err) {
      console.error("Error loading POS data:", err);
      const container = document.getElementById('section-pos');
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">❌</div>
          <h3>Error al cargar el Punto de Venta</h3>
          <p class="text-muted">${err.message || JSON.stringify(err)}</p>
          <button class="btn btn-primary mt-16" onclick="POS.render()">🔄 Reintentar</button>
        </div>
      `;
      return;
    }
    const container = document.getElementById('section-pos');
    container.innerHTML = `
      <div class="pos-container">
        <!-- LEFT: Products -->
        <div class="pos-products">
          <div class="barcode-input-wrapper">
            <input type="text" id="barcode-input" placeholder="🔍 Escanear código o buscar producto..." autofocus
              oninput="POS.onSearch(this.value)" onkeydown="POS.onBarcodeKey(event)">
            <button class="btn btn-primary" onclick="POS.quickSalePrompt()">💲 Venta rápida</button>
          </div>
          <div class="tabs" id="category-tabs">
            <button class="tab ${!this.selectedCategory ? 'active' : ''}" onclick="POS.filterCategory(null)">Todos</button>
            ${this.categories.map(c => `
              <button class="tab ${this.selectedCategory === c.id ? 'active' : ''}" onclick="POS.filterCategory('${c.id}')">${c.icon} ${c.name}</button>
            `).join('')}
          </div>
          <div class="product-grid" id="product-grid">
            ${this.renderProducts()}
          </div>
        </div>
        <!-- RIGHT: Cart -->
        <div class="pos-cart" id="pos-cart">
          <div class="cart-header flex items-center justify-between">
            <h3>🛒 Carrito <span id="cart-count" class="badge badge-primary">${this.cart.length}</span></h3>
            <div class="flex gap-8">
              <button class="btn btn-ghost btn-sm" onclick="POS.clearCart()" ${this.cart.length === 0 ? 'disabled' : ''}>Limpiar</button>
              <button class="btn btn-ghost btn-sm close-cart-btn" onclick="POS.toggleCart()">✕</button>
            </div>
          </div>
          <div class="cart-items" id="cart-items">
            ${this.renderCartItems()}
          </div>
          <div class="cart-footer">
            ${this.renderCartTotals()}
          </div>
        </div>
      </div>
      <button class="btn btn-primary floating-cart-btn" onclick="POS.toggleCart()">
        🛒 Carrito (<span id="floating-cart-count">${this.cart.length}</span>)
      </button>
    `;
    document.getElementById('barcode-input')?.focus();
  },

  renderProducts() {
    let filtered = this.products;
    if (this.selectedCategory) filtered = filtered.filter(p => p.category_id === this.selectedCategory);
    if (this.searchTerm) {
      const s = this.searchTerm.toLowerCase();
      filtered = filtered.filter(p => p.name.toLowerCase().includes(s) || (p.barcode && p.barcode.includes(s)));
    }
    if (!filtered.length) return '<div class="empty-state"><div class="empty-icon">📦</div><h3>Sin productos</h3><p>No se encontraron productos</p></div>';
    return filtered.map(p => `
      <div class="product-card" onclick="POS.addToCart('${p.id}')">
        <div class="p-name" title="${p.name}">${p.name}</div>
        <div class="p-price">$${Number(p.price_sell).toFixed(2)}</div>
        <div class="p-stock ${p.stock <= p.min_stock ? 'low' : ''}">Stock: ${p.stock} ${p.unit}</div>
      </div>
    `).join('');
  },

  renderCartItems() {
    if (!this.cart.length) return '<div class="cart-empty"><div class="empty-icon">🛒</div><p>Carrito vacío</p><p style="font-size:0.8rem;margin-top:8px;">Escanea o selecciona productos</p></div>';
    return this.cart.map((item, i) => `
      <div class="cart-item">
        <div class="ci-info">
          <div class="ci-name">${item.name}</div>
          <div class="ci-price">$${Number(item.price).toFixed(2)} / ${item.unit || 'pza'}</div>
        </div>
        <div class="ci-qty">
          <button onclick="POS.updateQty(${i}, -1)">−</button>
          <span>${item.qty}</span>
          <button onclick="POS.updateQty(${i}, 1)">+</button>
        </div>
        <div class="ci-subtotal">$${(item.price * item.qty).toFixed(2)}</div>
        <button class="ci-remove" onclick="POS.removeFromCart(${i})">✕</button>
      </div>
    `).join('');
  },

  renderCartTotals() {
    const subtotal = this.cart.reduce((s, i) => s + i.price * i.qty, 0);
    const total = subtotal - this.discount;
    return `
      <div class="cart-totals">
        <div class="total-row"><span>Subtotal</span><span>$${subtotal.toFixed(2)}</span></div>
        <div class="total-row"><span>Descuento</span>
          <span style="cursor:pointer;color:var(--primary)" onclick="POS.setDiscount()">-$${this.discount.toFixed(2)} ✏️</span>
        </div>
        <div class="total-row grand"><span>TOTAL</span><span>$${total.toFixed(2)}</span></div>
      </div>
      <div class="cart-actions">
        <button class="btn btn-outline" onclick="POS.holdSale()">⏸️ Apartar</button>
        <button class="btn btn-outline" onclick="POS.showLastSales()">📋 Últimas</button>
        <button class="btn btn-success btn-pay" onclick="POS.showPayment()" ${!this.cart.length ? 'disabled' : ''}>
          💳 COBRAR $${total.toFixed(2)}
        </button>
      </div>
    `;
  },

  refreshCart() {
    const cartItems = document.getElementById('cart-items');
    const cartFooter = document.querySelector('.cart-footer');
    const cartCount = document.getElementById('cart-count');
    const floatingCartCount = document.getElementById('floating-cart-count');
    if (cartItems) cartItems.innerHTML = this.renderCartItems();
    if (cartFooter) cartFooter.innerHTML = this.renderCartTotals();
    if (cartCount) cartCount.textContent = this.cart.length;
    if (floatingCartCount) floatingCartCount.textContent = this.cart.length;
  },

  toggleCart() {
    document.getElementById('pos-cart')?.classList.toggle('open');
  },

  async addToCart(productId) {
    const existing = this.cart.findIndex(i => i.productId === productId);
    if (existing >= 0) {
      this.cart[existing].qty++;
    } else {
      const p = this.products.find(pr => pr.id === productId) || await DB.getProductById(productId);
      if (!p) return App.toast('Producto no encontrado', 'error');
      if (p.stock <= 0) return App.toast('Sin stock disponible', 'warning');
      this.cart.push({ productId: p.id, name: p.name, price: p.price_sell, qty: 1, unit: p.unit, stock: p.stock });
    }
    Sounds.play('scan');
    this.refreshCart();
  },

  removeFromCart(index) {
    this.cart.splice(index, 1);
    this.refreshCart();
  },

  updateQty(index, delta) {
    const item = this.cart[index];
    const newQty = item.qty + delta;
    if (newQty <= 0) return this.removeFromCart(index);
    if (newQty > item.stock) return App.toast('Stock insuficiente', 'warning');
    item.qty = newQty;
    this.refreshCart();
  },

  clearCart() {
    this.cart = [];
    this.discount = 0;
    this.refreshCart();
  },

  setDiscount() {
    const input = prompt('Descuento ($):', this.discount);
    if (input === null) return;
    this.discount = Math.max(0, parseFloat(input) || 0);
    this.refreshCart();
  },

  filterCategory(catId) {
    this.selectedCategory = catId;
    document.querySelectorAll('#category-tabs .tab').forEach(t => t.classList.remove('active'));
    event.target.classList.add('active');
    document.getElementById('product-grid').innerHTML = this.renderProducts();
  },

  onSearch(term) {
    this.searchTerm = term;
    document.getElementById('product-grid').innerHTML = this.renderProducts();
  },

  async onBarcodeKey(e) {
    if (e.key !== 'Enter') return;
    const input = document.getElementById('barcode-input');
    const code = input.value.trim();
    if (!code) return;
    const product = await DB.getProductByBarcode(code);
    if (product) {
      this.addToCart(product.id);
      input.value = '';
    } else {
      App.toast('Producto no encontrado: ' + code, 'error');
      Sounds.play('error');
    }
  },

  quickSalePrompt() {
    App.showModal(`
      <div class="modal-header"><h3>💲 Venta Rápida</h3><button class="modal-close" onclick="App.closeModal()">✕</button></div>
      <div class="modal-body">
        <div class="form-group"><label class="form-label">Descripción</label><input type="text" id="qs-name" class="form-input" placeholder="Producto"></div>
        <div class="form-group"><label class="form-label">Precio</label><input type="number" id="qs-price" class="form-input" step="0.01" placeholder="0.00"></div>
        <div class="form-group"><label class="form-label">Cantidad</label><input type="number" id="qs-qty" class="form-input" value="1" min="1"></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline" onclick="App.closeModal()">Cancelar</button>
        <button class="btn btn-success" onclick="POS.addQuickSale()">Agregar</button>
      </div>
    `);
  },

  addQuickSale() {
    const name = document.getElementById('qs-name').value || 'Producto';
    const price = parseFloat(document.getElementById('qs-price').value) || 0;
    const qty = parseInt(document.getElementById('qs-qty').value) || 1;
    if (price <= 0) return App.toast('Ingresa un precio válido', 'error');
    this.cart.push({ productId: null, name, price, qty, unit: 'pza', stock: 999 });
    Sounds.play('scan');
    this.refreshCart();
    App.closeModal();
  },

  showPayment() {
    if (!this.cart.length) return;
    const subtotal = this.cart.reduce((s, i) => s + i.price * i.qty, 0);
    const total = subtotal - this.discount;

    App.showModal(`
      <div class="modal-header"><h3>💳 Cobrar</h3><button class="modal-close" onclick="App.closeModal()">✕</button></div>
      <div class="modal-body">
        <div style="text-align:center;margin-bottom:20px;">
          <div style="font-size:0.9rem;color:var(--text-secondary)">Total a cobrar</div>
          <div style="font-size:2.5rem;font-weight:800;color:var(--success)">$${total.toFixed(2)}</div>
        </div>
        <div class="payment-methods">
          <div class="payment-method selected" onclick="POS.selectPayment('cash', this)"><div class="pm-icon">💵</div><div class="pm-label">Efectivo</div></div>
          <div class="payment-method" onclick="POS.selectPayment('card', this)"><div class="pm-icon">💳</div><div class="pm-label">Tarjeta</div></div>
          <div class="payment-method" onclick="POS.selectPayment('transfer', this)"><div class="pm-icon">📱</div><div class="pm-label">Transferencia</div></div>
          <div class="payment-method" onclick="POS.selectPayment('credit', this)"><div class="pm-icon">📝</div><div class="pm-label">Fiado</div></div>
        </div>
        <div id="cash-section">
          <div class="form-group"><label class="form-label">Efectivo recibido</label>
            <input type="number" id="cash-received" class="form-input cash-input" step="0.01" value="${total.toFixed(2)}" oninput="POS.calcChange(${total})">
          </div>
          <div class="change-display" id="change-display"><div class="change-label">Cambio</div><div class="change-amount" id="change-amount">$0.00</div></div>
        </div>
        <div id="credit-section" class="hidden">
          <div class="form-group"><label class="form-label">Seleccionar cliente</label>
            <select id="credit-customer" class="form-select"><option value="">Cargando...</option></select>
          </div>
          <div id="credit-info"></div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline" onclick="App.closeModal()">Cancelar</button>
        <button class="btn btn-success btn-lg" id="confirm-payment-btn" onclick="POS.confirmPayment()">✅ Confirmar Venta</button>
      </div>
    `, 'modal-lg');
    this.selectedPayment = 'cash';
    this.loadCreditCustomers();
  },

  selectedPayment: 'cash',

  selectPayment(method, el) {
    this.selectedPayment = method;
    document.querySelectorAll('.payment-method').forEach(m => m.classList.remove('selected'));
    el.classList.add('selected');
    document.getElementById('cash-section').classList.toggle('hidden', method !== 'cash');
    document.getElementById('credit-section').classList.toggle('hidden', method !== 'credit');
  },

  calcChange(total) {
    const received = parseFloat(document.getElementById('cash-received').value) || 0;
    const change = Math.max(0, received - total);
    document.getElementById('change-amount').textContent = '$' + change.toFixed(2);
    document.getElementById('change-amount').style.color = received >= total ? 'var(--success)' : 'var(--danger)';
  },

  async loadCreditCustomers() {
    const customers = await DB.getCustomers();
    const select = document.getElementById('credit-customer');
    if (!select) return;
    select.innerHTML = '<option value="">-- Seleccionar cliente --</option>' +
      customers.map(c => `<option value="${c.id}" data-balance="${c.balance}" data-limit="${c.credit_limit}" ${c.is_blocked ? 'disabled' : ''}>
        ${c.name} (Debe: $${Number(c.balance).toFixed(2)} / Límite: $${Number(c.credit_limit).toFixed(2)})${c.is_blocked ? ' [BLOQUEADO]' : ''}
      </option>`).join('');
    select.addEventListener('change', () => {
      const opt = select.selectedOptions[0];
      if (!opt || !opt.value) return;
      const balance = parseFloat(opt.dataset.balance) || 0;
      const limit = parseFloat(opt.dataset.limit) || 0;
      const total = this.cart.reduce((s, i) => s + i.price * i.qty, 0) - this.discount;
      const newBalance = balance + total;
      const info = document.getElementById('credit-info');
      if (newBalance > limit) {
        info.innerHTML = `<div class="badge badge-danger" style="padding:12px;width:100%;justify-content:center;">⚠️ Excede el límite de crédito ($${limit.toFixed(2)})</div>`;
      } else {
        info.innerHTML = `<div class="badge badge-success" style="padding:12px;width:100%;justify-content:center;">✅ Nuevo saldo: $${newBalance.toFixed(2)}</div>`;
      }
    });
  },

  async confirmPayment() {
    const btn = document.getElementById('confirm-payment-btn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span>';
    try {
      const subtotal = this.cart.reduce((s, i) => s + i.price * i.qty, 0);
      const total = subtotal - this.discount;
      const method = this.selectedPayment;
      let cashReceived = null, changeGiven = null, customerId = null, isCredit = false;

      if (method === 'cash') {
        cashReceived = parseFloat(document.getElementById('cash-received').value) || 0;
        if (cashReceived < total) { App.toast('Efectivo insuficiente', 'error'); btn.disabled = false; btn.textContent = '✅ Confirmar Venta'; return; }
        changeGiven = cashReceived - total;
      }
      if (method === 'credit') {
        customerId = document.getElementById('credit-customer').value;
        if (!customerId) { App.toast('Selecciona un cliente', 'error'); btn.disabled = false; btn.textContent = '✅ Confirmar Venta'; return; }
        isCredit = true;
      }

      const session = await DB.getCurrentSession();
      const sale = {
        subtotal, discount: this.discount, tax: 0, total,
        payment_method: method, cash_received: cashReceived, change_given: changeGiven,
        customer_id: customerId, is_credit: isCredit,
        session_id: session?.id || null
      };
      const items = this.cart.map(i => ({
        product_id: i.productId, product_name: i.name,
        quantity: i.qty, unit_price: i.price, discount: 0,
        subtotal: i.price * i.qty
      }));

      const saleData = await DB.createSale(sale, items);

      // Update session totals
      if (session) {
        const fieldMap = { cash: 'cash_sales', card: 'card_sales', transfer: 'transfer_sales', credit: 'credit_sales' };
        if (fieldMap[method]) await DB.updateSessionTotals(session.id, fieldMap[method], total);
      }

      // If credit, add to customer balance
      if (isCredit && customerId) {
        await DB.addCredit(customerId, saleData.id, total);
      }

      await DB.log('sale', { sale_id: saleData.id, total, method });
      Sounds.play('sale');
      App.toast(`Venta #${saleData.sale_number} registrada — $${total.toFixed(2)}`, 'success');

      // Show ticket
      const fullSale = await DB.getSaleWithItems(saleData.id);
      const ticketText = Tickets.generateSaleTicket(fullSale, fullSale.items);
      Tickets.showTicketModal(ticketText, `Ticket #${saleData.sale_number}`);

      this.cart = [];
      this.discount = 0;
      this.products = await DB.getProducts();
      this.refreshCart();
      document.getElementById('product-grid').innerHTML = this.renderProducts();
      
      // Close cart on mobile
      if (window.innerWidth <= 1024) {
        document.getElementById('pos-cart')?.classList.remove('open');
      }
    } catch (err) {
      App.toast('Error al procesar venta: ' + err.message, 'error');
      btn.disabled = false;
      btn.textContent = '✅ Confirmar Venta';
    }
  },

  async showLastSales() {
    const sales = await DB.getTodaySales();
    App.showModal(`
      <div class="modal-header"><h3>📋 Ventas de Hoy</h3><button class="modal-close" onclick="App.closeModal()">✕</button></div>
      <div class="modal-body">
        ${!sales.length ? '<p class="text-muted text-center">No hay ventas hoy</p>' : `
          <div class="table-container"><table>
            <thead><tr><th>#</th><th>Hora</th><th>Total</th><th>Pago</th><th></th></tr></thead>
            <tbody>${sales.map(s => `
              <tr>
                <td>${s.sale_number}</td>
                <td>${new Date(s.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</td>
                <td class="font-bold">$${Number(s.total).toFixed(2)}</td>
                <td><span class="badge badge-${s.payment_method === 'credit' ? 'danger' : 'success'}">${s.payment_method}</span></td>
                <td><button class="btn btn-ghost btn-sm" onclick="POS.reprintTicket('${s.id}')">🧾</button></td>
              </tr>
            `).join('')}</tbody>
          </table></div>
        `}
      </div>
    `, 'modal-lg');
  },

  async reprintTicket(saleId) {
    const sale = await DB.getSaleWithItems(saleId);
    const ticketText = Tickets.generateSaleTicket(sale, sale.items);
    App.closeModal();
    setTimeout(() => Tickets.showTicketModal(ticketText, `Ticket #${sale.sale_number}`), 300);
  },

  holdSale() {
    if (!this.cart.length) return;
    const held = JSON.parse(localStorage.getItem('pos_held_sales') || '[]');
    held.push({ cart: [...this.cart], discount: this.discount, date: new Date().toISOString() });
    localStorage.setItem('pos_held_sales', JSON.stringify(held));
    App.toast('Venta apartada', 'info');
    this.clearCart();
  }
};
