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
            <button class="btn btn-outline" style="padding:0 12px;" onclick="App.startCameraScanner(code => POS.handleBarcodeScan(code))">📷</button>
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
    if (this.selectedCategory) {
      filtered = filtered.filter(p => p.category_id === this.selectedCategory);
      if (this.searchTerm) {
        const s = this.searchTerm.toLowerCase();
        filtered = filtered.filter(p => p.name.toLowerCase().includes(s) || (p.barcode && p.barcode.includes(s)));
      }
      if (!filtered.length) return '<div class="empty-state"><div class="empty-icon">📦</div><h3>Sin productos</h3><p>No se encontraron productos</p></div>';
      return `<div class="product-grid-sub">${filtered.map(p => this.renderProductCard(p)).join('')}</div>`;
    }

    if (this.searchTerm) {
      const s = this.searchTerm.toLowerCase();
      filtered = filtered.filter(p => p.name.toLowerCase().includes(s) || (p.barcode && p.barcode.includes(s)));
      if (!filtered.length) return '<div class="empty-state"><div class="empty-icon">📦</div><h3>Sin productos</h3><p>No se encontraron productos</p></div>';
      return `<div class="product-grid-sub">${filtered.map(p => this.renderProductCard(p)).join('')}</div>`;
    }

    // Group by category when "Todos" is selected
    const categoriesMap = {};
    this.categories.forEach(c => {
      categoriesMap[c.id] = { category: c, products: [] };
    });
    categoriesMap['none'] = { category: { id: null, name: 'Sin categoría', icon: '📦' }, products: [] };

    filtered.forEach(p => {
      const catId = p.category_id || 'none';
      if (categoriesMap[catId]) {
        categoriesMap[catId].products.push(p);
      }
    });

    let html = '';
    this.categories.forEach(c => {
      const group = categoriesMap[c.id];
      if (group && group.products.length > 0) {
        html += `
          <div class="category-section mb-24">
            <h3 class="category-section-title">${c.icon} ${c.name}</h3>
            <div class="product-grid-sub">
              ${group.products.map(p => this.renderProductCard(p)).join('')}
            </div>
          </div>
        `;
      }
    });

    const noneGroup = categoriesMap['none'];
    if (noneGroup && noneGroup.products.length > 0) {
      html += `
        <div class="category-section mb-24">
          <h3 class="category-section-title">📦 Sin categoría</h3>
          <div class="product-grid-sub">
            ${noneGroup.products.map(p => this.renderProductCard(p)).join('')}
          </div>
        </div>
      `;
    }

    if (!html) {
      return '<div class="empty-state"><div class="empty-icon">📦</div><h3>Sin productos</h3><p>No se encontraron productos</p></div>';
    }

    return html;
  },

  renderProductCard(p) {
    return `
      <div class="product-card" onclick="POS.addToCart('${p.id}')">
        <div class="p-name" title="${p.name}">${p.name}</div>
        <div class="p-price">$${Number(p.price_sell).toFixed(2)}</div>
        <div class="p-stock ${p.stock <= p.min_stock ? 'low' : ''}">Stock: ${p.stock} ${p.unit}</div>
      </div>
    `;
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

  weightMode: 'kg',

  showWeightModal(p) {
    this.weightMode = 'kg';
    App.showModal(`
      <div class="modal-header"><h3>⚖️ Venta por Peso: ${p.name}</h3><button class="modal-close" onclick="App.closeModal()">✕</button></div>
      <div class="modal-body">
        <p class="text-muted mb-16">Precio por kg: <strong>$${Number(p.price_sell).toFixed(2)}</strong></p>
        <div class="tabs mb-16" id="weight-input-tabs">
          <button class="tab active" onclick="POS.setWeightInputMode('kg')">⚖️ Kilogramos (kg)</button>
          <button class="tab" onclick="POS.setWeightInputMode('money')">💲 Monto en Dinero ($)</button>
        </div>
        <div class="form-group" id="weight-val-group">
          <label class="form-label" id="weight-input-label">Cantidad en kg</label>
          <input type="number" id="weight-input-value" class="form-input" placeholder="0.000" step="0.001" oninput="POS.calculateWeightPreview(${p.price_sell})">
        </div>
        <div class="mt-16 text-center" style="font-size:1.2rem;">
          Total: <strong style="color:var(--success)" id="weight-preview-total">$0.00</strong>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline" onclick="App.closeModal()">Cancelar</button>
        <button class="btn btn-primary" onclick="POS.confirmWeightAddToCart('${p.id}', ${p.price_sell})">Agregar</button>
      </div>
    `);
    setTimeout(() => document.getElementById('weight-input-value')?.focus(), 200);
  },

  setWeightInputMode(mode) {
    this.weightMode = mode;
    document.querySelectorAll('#weight-input-tabs .tab').forEach(t => t.classList.remove('active'));
    event.target.classList.add('active');

    const label = document.getElementById('weight-input-label');
    const input = document.getElementById('weight-input-value');
    if (mode === 'kg') {
      if (label) label.textContent = 'Cantidad en kg';
      if (input) input.placeholder = '0.000';
    } else {
      if (label) label.textContent = 'Monto en Dinero ($)';
      if (input) input.placeholder = '0.00';
    }
    if (input) {
      input.value = '';
      input.focus();
    }
    const preview = document.getElementById('weight-preview-total');
    if (preview) preview.textContent = '$0.00';
  },

  calculateWeightPreview(price) {
    const val = parseFloat(document.getElementById('weight-input-value').value) || 0;
    const preview = document.getElementById('weight-preview-total');
    if (!preview) return;

    if (this.weightMode === 'kg') {
      preview.textContent = `$${(val * price).toFixed(2)}`;
    } else {
      preview.textContent = `Equivale a: ${(val / price).toFixed(3)} kg`;
    }
  },

  async confirmWeightAddToCart(productId, price) {
    const val = parseFloat(document.getElementById('weight-input-value').value) || 0;
    if (val <= 0) return App.toast('Ingrese una cantidad válida', 'error');

    let qty = 0;
    if (this.weightMode === 'kg') {
      qty = val;
    } else {
      qty = val / price;
    }

    const p = this.products.find(pr => pr.id === productId) || await DB.getProductById(productId);
    if (!p) return App.toast('Producto no encontrado', 'error');
    if (p.stock < qty) return App.toast('Stock insuficiente', 'warning');

    const existing = this.cart.findIndex(i => i.cartItemId === productId);
    if (existing >= 0) {
      this.cart[existing].qty = parseFloat((this.cart[existing].qty + qty).toFixed(3));
    } else {
      this.cart.push({
        cartItemId: productId,
        productId: p.id,
        name: p.name,
        price: Number(p.price_sell),
        qty: parseFloat(qty.toFixed(3)),
        unit: 'kg',
        stock: p.stock
      });
    }

    Sounds.play('scan');
    this.refreshCart();
    App.closeModal();
  },

  showWholesaleChoiceModal(p) {
    App.showModal(`
      <div class="modal-header"><h3>📦 Formato de Venta: ${p.name}</h3><button class="modal-close" onclick="App.closeModal()">✕</button></div>
      <div class="modal-body text-center">
        <p class="text-muted mb-24">Selecciona el formato de venta de este producto.</p>
        <div class="grid-2">
          <button class="btn btn-outline" style="flex-direction:column;padding:24px;gap:12px;height:auto;width:100%;align-items:center;" onclick="POS.confirmAddWholesale('${p.id}', false)">
            <span style="font-size:24px"> pieza </span>
            <strong>Menudeo (1 Unidad)</strong>
            <span style="color:var(--success);font-weight:700;font-size:1.2rem;">$${Number(p.price_sell).toFixed(2)}</span>
          </button>
          <button class="btn btn-primary" style="flex-direction:column;padding:24px;gap:12px;height:auto;width:100%;align-items:center;" onclick="POS.confirmAddWholesale('${p.id}', true)">
            <span style="font-size:24px">📦</span>
            <strong>Mayoreo (${p.wholesale_name} de ${p.wholesale_units})</strong>
            <span style="color:#000;font-weight:700;font-size:1.2rem;">$${Number(p.wholesale_price).toFixed(2)}</span>
          </button>
        </div>
      </div>
    `);
  },

  confirmAddWholesale(productId, isWholesale) {
    App.closeModal();
    POS.addToCart(productId, isWholesale);
  },

  async addToCart(productId, forceWholesale = null) {
    const p = this.products.find(pr => pr.id === productId) || await DB.getProductById(productId);
    if (!p) return App.toast('Producto no encontrado', 'error');

    // Weight/Fractional product
    if (p.unit === 'kg' && forceWholesale !== true) {
      POS.showWeightModal(p);
      return;
    }

    // Wholesale choice product
    if (p.has_wholesale && forceWholesale === null) {
      POS.showWholesaleChoiceModal(p);
      return;
    }

    const isWS = forceWholesale === true;
    const name = isWS ? `${p.name} (${p.wholesale_name})` : p.name;
    const price = isWS ? p.wholesale_price : p.price_sell;
    const unit = isWS ? p.wholesale_name : p.unit;
    const stockUnitsNeeded = isWS ? p.wholesale_units : 1;
    const cartItemId = isWS ? `${productId}_ws` : productId;

    const existing = this.cart.findIndex(i => i.cartItemId === cartItemId);
    const currentQtyInCart = existing >= 0 ? this.cart[existing].qty : 0;
    const stockNeeded = (currentQtyInCart + 1) * stockUnitsNeeded;

    if (p.stock < stockNeeded) return App.toast('Stock insuficiente', 'warning');

    if (existing >= 0) {
      this.cart[existing].qty++;
    } else {
      this.cart.push({
        cartItemId,
        productId: p.id,
        name,
        price: Number(price),
        qty: 1,
        unit,
        stock: p.stock,
        is_wholesale: isWS,
        wholesale_units: p.wholesale_units
      });
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
    const stockUnitsNeeded = item.is_wholesale ? item.wholesale_units : 1;
    if (item.stock < newQty * stockUnitsNeeded) return App.toast('Stock insuficiente', 'warning');
    item.qty = parseFloat(newQty.toFixed(3));
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
    await this.handleBarcodeScan(code);
  },

  async handleBarcodeScan(code) {
    if (!code) return;
    const product = await DB.getProductByBarcode(code);
    if (product) {
      this.addToCart(product.id);
      const input = document.getElementById('barcode-input');
      if (input) input.value = '';
    } else {
      Sounds.play('error');
      this.showNewProductFromBarcode(code);
    }
  },

  async showNewProductFromBarcode(barcode) {
    // Load categories for the select
    const categories = await DB.getCategories();
    App.showModal(`
      <div class="modal-header">
        <h3>📦 Nuevo Producto Detectado</h3>
        <button class="modal-close" onclick="App.closeModal()">✕</button>
      </div>
      <div class="modal-body">
        <div style="background: linear-gradient(135deg, rgba(99,102,241,0.1), rgba(139,92,246,0.1)); border: 1px solid rgba(99,102,241,0.3); border-radius: var(--radius-sm); padding: 16px; margin-bottom: 20px; display: flex; align-items: center; gap: 12px;">
          <span style="font-size: 28px;">🔍</span>
          <div>
            <div style="font-weight: 700; color: var(--text-primary);">Código no registrado</div>
            <div style="font-family: monospace; font-size: 1.1rem; color: var(--primary); font-weight: 600; letter-spacing: 1px;">${barcode}</div>
            <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 4px;">Completa los datos para registrar este producto y agregarlo al carrito.</div>
          </div>
        </div>
        <div class="grid-2">
          <div class="form-group">
            <label class="form-label">Nombre del producto *</label>
            <input type="text" id="np-name" class="form-input" placeholder="Ej: Coca-Cola 600ml" autofocus>
          </div>
          <div class="form-group">
            <label class="form-label">Código de barras</label>
            <input type="text" id="np-barcode" class="form-input" value="${barcode}" readonly style="opacity: 0.7; cursor: not-allowed;">
          </div>
          <div class="form-group">
            <label class="form-label">Precio de Compra</label>
            <input type="number" id="np-buy" class="form-input" step="0.01" placeholder="0.00">
          </div>
          <div class="form-group">
            <label class="form-label">Precio de Venta *</label>
            <input type="number" id="np-sell" class="form-input" step="0.01" placeholder="0.00">
          </div>
          <div class="form-group">
            <label class="form-label">Stock inicial</label>
            <input type="number" id="np-stock" class="form-input" step="0.001" value="1" placeholder="0">
          </div>
          <div class="form-group">
            <label class="form-label">Stock mínimo</label>
            <input type="number" id="np-minstock" class="form-input" value="5">
          </div>
          <div class="form-group">
            <label class="form-label">Categoría</label>
            <div class="flex gap-8">
              <select id="np-cat" class="form-select" style="flex:1">
                <option value="">Sin categoría</option>
                ${categories.map(c => `<option value="${c.id}">${c.icon} ${c.name}</option>`).join('')}
              </select>
              <button class="btn btn-outline" style="padding: 0 12px;" onclick="POS.quickAddCategoryInModal()" type="button">➕</button>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Unidad de venta</label>
            <select id="np-unit" class="form-select">
              ${['pieza', 'kg', 'litro', 'paquete', 'caja', 'metro'].map(u => `<option>${u}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Fecha caducidad</label>
            <input type="date" id="np-expiry" class="form-input">
          </div>
          <div class="form-group" style="grid-column: 1 / -1; margin-top: 8px;">
            <label class="flex items-center gap-8" style="cursor:pointer">
              <input type="checkbox" id="np-has-wholesale" onchange="document.getElementById('np-wholesale-fields').style.display = this.checked ? 'grid' : 'none'" style="width:20px;height:20px;">
              <strong>📦 Habilitar venta por Caja / Bulto / Paca (Mayoreo)</strong>
            </label>
          </div>
          <div class="grid-2" id="np-wholesale-fields" style="grid-column: 1 / -1; display: none; gap: 16px; background: var(--bg-surface); padding: 16px; border-radius: var(--radius-sm); border: 1px dashed var(--border);">
            <div class="form-group"><label class="form-label">Nombre del empaque</label><input type="text" id="np-ws-name" class="form-input" value="Caja" placeholder="Caja, Paca, Bulto..."></div>
            <div class="form-group"><label class="form-label">Unidades por empaque</label><input type="number" id="np-ws-units" class="form-input" value="1"></div>
            <div class="form-group"><label class="form-label">Precio por empaque</label><input type="number" id="np-ws-price" class="form-input" step="0.01" value="0"></div>
            <div class="form-group"><label class="form-label">Código de barras empaque</label>
              <div class="flex gap-8">
                <input type="text" id="np-ws-barcode" class="form-input" style="flex:1" placeholder="Opcional">
                <button class="btn btn-outline" style="padding: 0 12px;" onclick="App.startCameraScanner(code => document.getElementById('np-ws-barcode').value = code)" type="button">📷</button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline" onclick="App.closeModal()">Cancelar</button>
        <button class="btn btn-success" id="np-save-btn" onclick="POS.saveNewProductFromBarcode('${barcode}')">
          💾 Guardar y Agregar al Carrito
        </button>
      </div>
    `, 'modal-lg');
    // Focus the name input after modal renders
    setTimeout(() => document.getElementById('np-name')?.focus(), 200);
  },

  async quickAddCategoryInModal() {
    const name = prompt('Nombre de la nueva categoría:');
    if (!name) return;
    const icon = prompt('Icono / Emoji (opcional, ej: 🥤):', '📦') || '📦';
    try {
      const newCat = await DB.saveCategory({ name, icon });
      App.toast('Categoría creada', 'success');
      const categories = await DB.getCategories();
      const catSelect = document.getElementById('np-cat');
      if (catSelect) {
        catSelect.innerHTML = `<option value="">Sin categoría</option>` +
          categories.map(c => `<option value="${c.id}" ${newCat.id === c.id ? 'selected' : ''}>${c.icon} ${c.name}</option>`).join('');
      }
    } catch (e) {
      App.toast('Error al crear categoría: ' + e.message, 'error');
    }
  },

  async saveNewProductFromBarcode(barcode) {
    const btn = document.getElementById('np-save-btn');
    const name = document.getElementById('np-name').value.trim();
    const priceSell = parseFloat(document.getElementById('np-sell').value) || 0;

    if (!name) return App.toast('El nombre del producto es requerido', 'error');
    if (priceSell <= 0) return App.toast('El precio de venta es requerido', 'error');

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Guardando...';

    try {
      const data = {
        name,
        barcode: barcode || null,
        price_buy: parseFloat(document.getElementById('np-buy').value) || 0,
        price_sell: priceSell,
        stock: parseFloat(document.getElementById('np-stock').value) || 0,
        min_stock: parseFloat(document.getElementById('np-minstock').value) || 5,
        category_id: document.getElementById('np-cat').value || null,
        unit: document.getElementById('np-unit').value,
        expiry_date: document.getElementById('np-expiry').value || null,
        has_wholesale: document.getElementById('np-has-wholesale').checked,
        wholesale_name: document.getElementById('np-ws-name')?.value || 'Caja',
        wholesale_units: parseFloat(document.getElementById('np-ws-units')?.value) || 1,
        wholesale_price: parseFloat(document.getElementById('np-ws-price')?.value) || 0,
        wholesale_barcode: document.getElementById('np-ws-barcode')?.value || null,
      };

      const savedProduct = await DB.saveProduct(data);
      App.toast(`✅ Producto "${name}" registrado exitosamente`, 'success');
      Sounds.play('scan');
      App.closeModal();

      // Refresh products list and add the new product to cart
      this.products = await DB.getProducts();
      this.addToCart(savedProduct.id);

      // Refresh product grid
      document.getElementById('product-grid').innerHTML = this.renderProducts();

      // Clear barcode input
      const input = document.getElementById('barcode-input');
      if (input) input.value = '';
    } catch (err) {
      App.toast('Error al guardar: ' + err.message, 'error');
      btn.disabled = false;
      btn.innerHTML = '💾 Guardar y Agregar al Carrito';
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
        subtotal: i.price * i.qty,
        is_wholesale: i.is_wholesale || false,
        wholesale_units: i.wholesale_units || 1
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
