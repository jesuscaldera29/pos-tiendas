// ============================================
// INVENTORY.JS - Product & Stock Management
// ============================================
const Inventory = {
  products: [],
  categories: [],
  searchTerm: '',
  selectedCategory: null,

  async render() {
    try {
      this.products = await DB.getProducts();
      this.categories = await DB.getCategories();
    } catch (err) {
      console.error("Error loading inventory:", err);
      document.getElementById('section-inventory').innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">❌</div>
          <h3>Error al cargar el inventario</h3>
          <p class="text-muted">${err.message || JSON.stringify(err)}</p>
          <button class="btn btn-primary mt-16" onclick="Inventory.render()">🔄 Reintentar</button>
        </div>
      `;
      return;
    }
    const lowStock = this.products.filter(p => p.stock <= p.min_stock);

    document.getElementById('section-inventory').innerHTML = `
      ${lowStock.length ? `<div class="card mb-24" style="border-color:var(--warning);background:rgba(255,179,71,0.05);">
        <div class="flex items-center gap-8"><span style="font-size:24px">⚠️</span><div><strong>${lowStock.length} productos con stock bajo</strong><br>
        <span class="text-muted">${lowStock.map(p => p.name).slice(0,5).join(', ')}${lowStock.length > 5 ? '...' : ''}</span></div></div>
      </div>` : ''}
      <div class="inv-toolbar">
        <div class="search-box" style="flex:1"><span class="search-icon">🔍</span>
          <input class="form-input" style="padding-left:36px" placeholder="Buscar producto..." oninput="Inventory.search(this.value)" value="${this.searchTerm}">
        </div>
        <button class="btn btn-primary" onclick="Inventory.showProductForm()">➕ Nuevo Producto</button>
        <button class="btn btn-outline" onclick="Inventory.showCategoryManager()">🏷️ Categorías</button>
        <button class="btn btn-outline" onclick="Inventory.showBarcodeLabels()">🖨️ Etiquetas</button>
        <button class="btn btn-outline" onclick="Inventory.exportExcel()">📥 Exportar</button>
        <button class="btn btn-outline" onclick="Inventory.importExcel()">📤 Importar</button>
        <button class="btn btn-outline" onclick="Inventory.downloadBaseCatalog()">📦 Catálogo Base</button>
      </div>
      <div class="tabs">
        <button class="tab ${!this.selectedCategory ? 'active' : ''}" onclick="Inventory.filterCat(null)">Todos (${this.products.length})</button>
        ${this.categories.map(c => {
          const count = this.products.filter(p => p.category_id === c.id).length;
          return `<button class="tab ${this.selectedCategory === c.id ? 'active' : ''}" onclick="Inventory.filterCat('${c.id}')">${c.icon} ${c.name} (${count})</button>`;
        }).join('')}
      </div>
      <div class="table-container"><table>
        <thead><tr><th>Producto</th><th>Código</th><th>Categoría</th><th>P. Compra</th><th>P. Venta</th><th>Margen</th><th>Stock</th><th>Acciones</th></tr></thead>
        <tbody id="inv-table-body">${this.renderTable()}</tbody>
      </table></div>
    `;
  },

  renderTable() {
    let filtered = this.products;
    if (this.selectedCategory) filtered = filtered.filter(p => p.category_id === this.selectedCategory);
    if (this.searchTerm) {
      const s = this.searchTerm.toLowerCase();
      filtered = filtered.filter(p => p.name.toLowerCase().includes(s) || (p.barcode || '').includes(s));
    }
    if (!filtered.length) return '<tr><td colspan="8" class="text-center text-muted" style="padding:40px">No hay productos</td></tr>';
    return filtered.map(p => {
      const margin = p.price_buy > 0 ? (((p.price_sell - p.price_buy) / p.price_buy) * 100).toFixed(0) : '-';
      const catName = p.categories ? `${p.categories.icon} ${p.categories.name}` : '-';
      const stockClass = p.stock <= p.min_stock ? 'text-danger font-bold' : '';
      return `<tr>
        <td><strong>${p.name}</strong></td>
        <td><code style="font-size:0.8rem">${p.barcode || '-'}</code></td>
        <td>${catName}</td>
        <td>$${Number(p.price_buy).toFixed(2)}</td>
        <td class="font-bold">$${Number(p.price_sell).toFixed(2)}</td>
        <td><span class="badge badge-success">${margin}%</span></td>
        <td class="${stockClass}">${p.stock} ${p.unit}</td>
        <td>
          <button class="btn btn-ghost btn-sm" onclick="Inventory.showProductForm('${p.id}')">✏️</button>
          <button class="btn btn-ghost btn-sm" onclick="Inventory.adjustStock('${p.id}')">📦</button>
          <button class="btn btn-ghost btn-sm" onclick="Inventory.deleteProduct('${p.id}')">🗑️</button>
        </td>
      </tr>`;
    }).join('');
  },

  search(term) {
    this.searchTerm = term;
    document.getElementById('inv-table-body').innerHTML = this.renderTable();
  },

  filterCat(catId) {
    this.selectedCategory = catId;
    document.querySelectorAll('.tabs .tab').forEach(t => t.classList.remove('active'));
    event.target.classList.add('active');
    document.getElementById('inv-table-body').innerHTML = this.renderTable();
  },

  async showProductForm(productId) {
    let product = { name: '', barcode: '', price_buy: 0, price_sell: 0, stock: 0, min_stock: 5, category_id: '', unit: 'pieza', expiry_date: '' };
    if (productId) {
      product = this.products.find(p => p.id === productId) || product;
    }
    App.showModal(`
      <div class="modal-header"><h3>${productId ? '✏️ Editar' : '➕ Nuevo'} Producto</h3><button class="modal-close" onclick="App.closeModal()">✕</button></div>
      <div class="modal-body">
        <div class="grid-2">
          <div class="form-group"><label class="form-label">Nombre *</label><input type="text" id="pf-name" class="form-input" value="${product.name}"></div>
          <div class="form-group"><label class="form-label">Código de barras</label><input type="text" id="pf-barcode" class="form-input" value="${product.barcode || ''}" placeholder="Escanear o escribir"></div>
          <div class="form-group"><label class="form-label">Precio Compra</label><input type="number" id="pf-buy" class="form-input" step="0.01" value="${product.price_buy}"></div>
          <div class="form-group"><label class="form-label">Precio Venta *</label><input type="number" id="pf-sell" class="form-input" step="0.01" value="${product.price_sell}"></div>
          <div class="form-group"><label class="form-label">Stock actual</label><input type="number" id="pf-stock" class="form-input" step="0.001" value="${product.stock}"></div>
          <div class="form-group"><label class="form-label">Stock mínimo</label><input type="number" id="pf-minstock" class="form-input" value="${product.min_stock}"></div>
          <div class="form-group"><label class="form-label">Categoría</label>
            <select id="pf-cat" class="form-select"><option value="">Sin categoría</option>
            ${this.categories.map(c => `<option value="${c.id}" ${product.category_id === c.id ? 'selected' : ''}>${c.icon} ${c.name}</option>`).join('')}</select>
          </div>
          <div class="form-group"><label class="form-label">Unidad</label>
            <select id="pf-unit" class="form-select">
              ${['pieza','kg','litro','paquete','caja','metro'].map(u => `<option ${product.unit === u ? 'selected' : ''}>${u}</option>`).join('')}
            </select>
          </div>
          <div class="form-group"><label class="form-label">Fecha caducidad</label><input type="date" id="pf-expiry" class="form-input" value="${product.expiry_date || ''}"></div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline" onclick="App.closeModal()">Cancelar</button>
        <button class="btn btn-primary" onclick="Inventory.saveProduct('${productId || ''}')">💾 Guardar</button>
      </div>
    `, 'modal-lg');
  },

  async saveProduct(id) {
    const data = {
      name: document.getElementById('pf-name').value,
      barcode: document.getElementById('pf-barcode').value || null,
      price_buy: parseFloat(document.getElementById('pf-buy').value) || 0,
      price_sell: parseFloat(document.getElementById('pf-sell').value) || 0,
      stock: parseFloat(document.getElementById('pf-stock').value) || 0,
      min_stock: parseFloat(document.getElementById('pf-minstock').value) || 5,
      category_id: document.getElementById('pf-cat').value || null,
      unit: document.getElementById('pf-unit').value,
      expiry_date: document.getElementById('pf-expiry').value || null,
    };
    if (!data.name || !data.price_sell) return App.toast('Nombre y precio de venta son requeridos', 'error');
    if (id) data.id = id;
    try {
      await DB.saveProduct(data);
      App.toast(id ? 'Producto actualizado' : 'Producto creado', 'success');
      App.closeModal();
      this.render();
    } catch (e) { App.toast('Error: ' + e.message, 'error'); }
  },

  async deleteProduct(id) {
    if (!confirm('¿Eliminar este producto?')) return;
    await DB.deleteProduct(id);
    App.toast('Producto eliminado', 'success');
    this.render();
  },

  async adjustStock(id) {
    const p = this.products.find(pr => pr.id === id);
    if (!p) return;
    App.showModal(`
      <div class="modal-header"><h3>📦 Ajustar Stock: ${p.name}</h3><button class="modal-close" onclick="App.closeModal()">✕</button></div>
      <div class="modal-body">
        <p>Stock actual: <strong>${p.stock} ${p.unit}</strong></p>
        <div class="form-group"><label class="form-label">Nuevo stock</label><input type="number" id="adj-stock" class="form-input" step="0.001" value="${p.stock}"></div>
        <div class="form-group"><label class="form-label">Razón</label>
          <select id="adj-reason" class="form-select"><option>Compra/Resurtido</option><option>Ajuste de inventario</option><option>Merma</option><option>Caducidad</option><option>Devolución</option></select>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline" onclick="App.closeModal()">Cancelar</button>
        <button class="btn btn-primary" onclick="Inventory.confirmAdjust('${id}', ${p.stock})">Guardar</button>
      </div>
    `);
  },

  async confirmAdjust(id, currentStock) {
    const newStock = parseFloat(document.getElementById('adj-stock').value);
    const reason = document.getElementById('adj-reason').value;
    const diff = newStock - currentStock;
    await supabase.from('products').update({ stock: newStock }).eq('id', id);
    await supabase.from('stock_movements').insert({
      business_id: DB.businessId, product_id: id,
      type: 'adjustment', quantity: Math.abs(diff),
      stock_before: currentStock, stock_after: newStock, reason
    });
    App.toast('Stock actualizado', 'success');
    App.closeModal();
    this.render();
  },

  showCategoryManager() {
    App.showModal(`
      <div class="modal-header"><h3>🏷️ Categorías</h3><button class="modal-close" onclick="App.closeModal()">✕</button></div>
      <div class="modal-body">
        <div class="flex gap-8 mb-16">
          <input type="text" id="new-cat-name" class="form-input" placeholder="Nombre de categoría" style="flex:1">
          <input type="text" id="new-cat-icon" class="form-input" placeholder="📦" style="width:60px">
          <button class="btn btn-primary" onclick="Inventory.addCategory()">Agregar</button>
        </div>
        <div id="cat-list">${this.categories.map(c => `
          <div class="flex items-center justify-between" style="padding:8px 0;border-bottom:1px solid var(--border);">
            <span>${c.icon} ${c.name}</span>
            <button class="btn btn-ghost btn-sm" onclick="Inventory.deleteCat('${c.id}')">🗑️</button>
          </div>
        `).join('')}</div>
      </div>
    `);
  },

  async addCategory() {
    const name = document.getElementById('new-cat-name').value;
    const icon = document.getElementById('new-cat-icon').value || '📦';
    if (!name) return;
    await DB.saveCategory({ name, icon });
    App.toast('Categoría creada', 'success');
    this.categories = await DB.getCategories();
    App.closeModal();
    this.showCategoryManager();
  },

  async deleteCat(id) {
    await DB.deleteCategory(id);
    this.categories = await DB.getCategories();
    App.closeModal();
    this.showCategoryManager();
  },

  exportExcel() {
    const data = this.products.map(p => ({
      Nombre: p.name, Código: p.barcode, PrecioCompra: p.price_buy,
      PrecioVenta: p.price_sell, Stock: p.stock, StockMin: p.min_stock,
      Unidad: p.unit, Categoría: p.categories?.name || ''
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Productos');
    XLSX.writeFile(wb, `productos_${new Date().toISOString().split('T')[0]}.xlsx`);
    App.toast('Exportado a Excel', 'success');
  },

  importExcel() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx,.csv';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws);
      const products = rows.map(r => ({
        name: r.Nombre || r.name || '',
        barcode: r.Código || r.barcode || null,
        price_buy: parseFloat(r.PrecioCompra || r.price_buy) || 0,
        price_sell: parseFloat(r.PrecioVenta || r.price_sell) || 0,
        stock: parseFloat(r.Stock || r.stock) || 0,
        min_stock: parseFloat(r.StockMin || r.min_stock) || 5,
        unit: r.Unidad || r.unit || 'pieza'
      })).filter(p => p.name && p.price_sell);
      if (!products.length) return App.toast('No se encontraron productos válidos', 'error');
      await DB.importProducts(products);
      App.toast(`${products.length} productos importados`, 'success');
      this.render();
    };
    input.click();
  },

  showBarcodeLabels() {
    const productsWithBarcode = this.products.filter(p => p.barcode);
    if (!productsWithBarcode.length) return App.toast('No hay productos con código de barras', 'warning');
    
    App.showModal(`
      <div class="modal-header"><h3>🖨️ Imprimir Etiquetas (Térmica)</h3><button class="modal-close" onclick="App.closeModal()">✕</button></div>
      <div class="modal-body" style="max-height:60vh;overflow-y:auto;">
        <p class="text-muted mb-16">Selecciona cuántas etiquetas quieres de cada producto para imprimir en tu ticketera POS.</p>
        <div id="labels-list">
          ${productsWithBarcode.map(p => `
            <div class="flex items-center justify-between mb-8" style="padding:8px; background:var(--bg-surface); border-radius:var(--radius-sm)">
              <div style="flex:1"><strong>${p.name}</strong><br><small class="text-muted">${p.barcode}</small></div>
              <input type="number" class="form-input label-qty" data-id="${p.id}" value="0" min="0" style="width:70px">
            </div>
          `).join('')}
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline" onclick="App.closeModal()">Cancelar</button>
        <button class="btn btn-primary" onclick="Inventory.printLabels()">🖨️ Imprimir</button>
      </div>
    `, 'modal-md');
  },

  printLabels() {
    const inputs = document.querySelectorAll('.label-qty');
    const toPrint = [];
    inputs.forEach(inp => {
      const qty = parseInt(inp.value) || 0;
      if (qty > 0) {
        const p = this.products.find(pr => pr.id === inp.dataset.id);
        for(let i=0; i<qty; i++) toPrint.push(p);
      }
    });

    if(!toPrint.length) return App.toast('Selecciona al menos 1 etiqueta', 'warning');

    const businessName = App.business?.name || 'Mi Tienda';
    const width = (App.business?.ticket_width || 80) + 'mm';
    
    // Create print window
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
      <head>
        <title>Etiquetas</title>
        <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
        <style>
          @page { margin: 0; size: ${width} auto; }
          body { font-family: 'Courier New', Courier, monospace; width: ${width}; margin: 0; padding: 0; background: #fff; color: #000; }
          .label { page-break-after: always; padding: 10px 5px; text-align: center; border-bottom: 1px dashed #ccc; }
          .b-name { font-weight: bold; font-size: 14px; margin-bottom: 5px; }
          .p-name { font-size: 12px; margin-bottom: 5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
          .price { font-weight: bold; font-size: 16px; margin-top: 5px; }
          svg { width: 100%; max-height: 50px; }
        </style>
      </head>
      <body>
        ${toPrint.map((p, i) => `
          <div class="label">
            <div class="b-name">${businessName}</div>
            <div class="p-name">${p.name}</div>
            <svg id="barcode-${i}"></svg>
            <div class="price">$${Number(p.price_sell).toFixed(2)}</div>
          </div>
        `).join('')}
        <script>
          window.onload = function() {
            ${toPrint.map((p, i) => `
              JsBarcode("#barcode-${i}", "${p.barcode}", {
                format: "CODE128", width: 1.5, height: 40, displayValue: true, fontSize: 12, margin: 0
              });
            `).join('')}
            setTimeout(() => { window.print(); window.close(); }, 500);
          };
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
    App.closeModal();
  },

  downloadBaseCatalog() {
    const baseProducts = [
      { Nombre: 'Coca-Cola Regular 600ml', Código: '7501055300075', PrecioCompra: 12.00, PrecioVenta: 18.00, Stock: 50, StockMin: 10, Unidad: 'pieza', Categoría: 'Bebidas' },
      { Nombre: 'Pepsi Regular 600ml', Código: '7501031311304', PrecioCompra: 11.00, PrecioVenta: 16.00, Stock: 40, StockMin: 10, Unidad: 'pieza', Categoría: 'Bebidas' },
      { Nombre: 'Sabritas Sal Original 42g', Código: '7501011131068', PrecioCompra: 10.00, PrecioVenta: 16.00, Stock: 30, StockMin: 5, Unidad: 'pieza', Categoría: 'Botanas' },
      { Nombre: 'Doritos Nacho 58g', Código: '7501011131136', PrecioCompra: 10.50, PrecioVenta: 16.00, Stock: 30, StockMin: 5, Unidad: 'pieza', Categoría: 'Botanas' },
      { Nombre: 'Gansito Marinela 50g', Código: '7501000153101', PrecioCompra: 11.00, PrecioVenta: 17.00, Stock: 20, StockMin: 5, Unidad: 'pieza', Categoría: 'Panadería' },
      { Nombre: 'Bimbo Pan Blanco Chico', Código: '7501000111200', PrecioCompra: 28.00, PrecioVenta: 36.00, Stock: 15, StockMin: 3, Unidad: 'pieza', Categoría: 'Panadería' },
      { Nombre: 'Leche Lala Entera 1L', Código: '7501020515435', PrecioCompra: 21.00, PrecioVenta: 26.00, Stock: 20, StockMin: 5, Unidad: 'pieza', Categoría: 'Lácteos' },
      { Nombre: 'Nutri Leche 1L', Código: '7501020540444', PrecioCompra: 16.00, PrecioVenta: 21.00, Stock: 20, StockMin: 5, Unidad: 'pieza', Categoría: 'Lácteos' },
      { Nombre: 'Atún Dolores en Agua 140g', Código: '7501040001555', PrecioCompra: 14.50, PrecioVenta: 21.00, Stock: 24, StockMin: 6, Unidad: 'pieza', Categoría: 'Abarrotes' },
      { Nombre: 'Maruchan Camarón Limón', Código: '041789001214', PrecioCompra: 11.00, PrecioVenta: 16.00, Stock: 40, StockMin: 10, Unidad: 'pieza', Categoría: 'Abarrotes' }
    ];

    const ws = XLSX.utils.json_to_sheet(baseProducts);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Plantilla Base');
    XLSX.writeFile(wb, \`catalogo_base.xlsx\`);
    App.toast('Catálogo descargado, ahora puedes importarlo', 'success');
  }
};
