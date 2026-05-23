// ============================================
// SETTINGS.JS - Business Configuration & Backup
// ============================================
const Settings = {
  business: null,

  async render() {
    try {
      this.business = await DB.getBusiness();
    } catch (err) {
      console.error("Error loading settings:", err);
      document.getElementById('section-settings').innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">❌</div>
          <h3>Error al cargar la configuración</h3>
          <p class="text-muted">${err.message || JSON.stringify(err)}</p>
          <button class="btn btn-primary mt-16" onclick="Settings.render()">🔄 Reintentar</button>
        </div>
      `;
      return;
    }
    const b = this.business || {};

    document.getElementById('section-settings').innerHTML = `
      <div class="settings-grid">
        <div class="settings-section">
          <h4>🏪 Datos del Negocio</h4>
          <div class="form-group"><label class="form-label">Nombre del negocio</label>
            <input type="text" id="set-name" class="form-input" value="${b.name || ''}"></div>
          <div class="form-group"><label class="form-label">Dirección</label>
            <input type="text" id="set-address" class="form-input" value="${b.address || ''}"></div>
          <div class="grid-2">
            <div class="form-group"><label class="form-label">Teléfono</label>
              <input type="text" id="set-phone" class="form-input" value="${b.phone || ''}"></div>
            <div class="form-group"><label class="form-label">RFC</label>
              <input type="text" id="set-rfc" class="form-input" value="${b.rfc || ''}"></div>
          </div>
          <button class="btn btn-primary w-full" onclick="Settings.saveBusiness()">💾 Guardar Datos</button>
        </div>

        <div class="settings-section">
          <h4>🧾 Configuración de Ticket</h4>
          <div class="form-group"><label class="form-label">Ancho de ticket</label>
            <select id="set-ticket-width" class="form-select">
              <option value="58" ${b.ticket_width === 58 ? 'selected' : ''}>58mm</option>
              <option value="80" ${b.ticket_width === 80 ? 'selected' : ''}>80mm</option>
            </select>
          </div>
          <div class="form-group"><label class="form-label">Encabezado del ticket</label>
            <textarea id="set-ticket-header" class="form-textarea">${b.ticket_header || ''}</textarea></div>
          <div class="form-group"><label class="form-label">Pie del ticket</label>
            <input type="text" id="set-ticket-footer" class="form-input" value="${b.ticket_footer || 'Gracias por su compra'}"></div>
          <button class="btn btn-primary w-full" onclick="Settings.saveTicket()">💾 Guardar Ticket</button>
        </div>

        <div class="settings-section">
          <h4>💰 Impuestos</h4>
          <div class="flex items-center gap-12 mb-16">
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
              <input type="checkbox" id="set-tax-enabled" ${b.tax_enabled ? 'checked' : ''} style="width:20px;height:20px;">
              <span>Cobrar IVA</span>
            </label>
          </div>
          <div class="form-group"><label class="form-label">Tasa de impuesto (%)</label>
            <input type="number" id="set-tax-rate" class="form-input" value="${b.tax_rate || 16}" step="0.01"></div>
          <button class="btn btn-primary w-full" onclick="Settings.saveTax()">💾 Guardar</button>
        </div>

        <div class="settings-section">
          <h4>🔊 Sonidos</h4>
          <div class="flex items-center gap-12 mb-16">
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
              <input type="checkbox" id="set-sounds" ${Sounds.enabled ? 'checked' : ''} onchange="Sounds.enabled=this.checked" style="width:20px;height:20px;">
              <span>Sonidos activados</span>
            </label>
          </div>
          <div class="flex gap-8 flex-wrap">
            <button class="btn btn-outline btn-sm" onclick="Sounds.play('scan')">🔊 Escaneo</button>
            <button class="btn btn-outline btn-sm" onclick="Sounds.play('sale')">🔊 Venta</button>
            <button class="btn btn-outline btn-sm" onclick="Sounds.play('cash')">🔊 Caja</button>
            <button class="btn btn-outline btn-sm" onclick="Sounds.play('error')">🔊 Error</button>
          </div>
        </div>

        <div class="settings-section">
          <h4>💾 Copia de Seguridad</h4>
          <p class="text-muted mb-16">Exporta todos los datos de tu negocio en un archivo JSON que puedes guardar como respaldo.</p>
          <button class="btn btn-success w-full mb-16" onclick="Settings.exportBackup()">📥 Exportar Copia de Seguridad</button>
          <button class="btn btn-warning w-full" onclick="Settings.importBackup()">📤 Restaurar desde Respaldo</button>
          <p class="text-muted mt-8" style="font-size:0.75rem">⚠️ Restaurar reemplazará los datos actuales</p>
        </div>

        <div class="settings-section">
          <h4>👤 Usuarios del Negocio</h4>
          <div id="users-list"><span class="spinner"></span> Cargando...</div>
          <button class="btn btn-outline w-full mt-16" onclick="Settings.showAddUser()">➕ Agregar Cajero</button>
        </div>

        <div class="settings-section col-span-2" style="grid-column: 1 / -1;">
          <h4>🔌 Diagnóstico de Hardware y Conexiones</h4>
          <p class="text-muted mb-16">Prueba que tu lector de códigos, impresora y cámara de celular estén configurados correctamente.</p>
          <div class="grid-3">
            <div style="background:var(--bg-surface); padding:16px; border-radius:var(--radius-sm); border:1px solid var(--border);">
              <h5 class="mb-8">🖨️ Impresora de Tickets</h5>
              <p class="text-muted mb-12" style="font-size:0.8rem;">Imprime un ticket de prueba para verificar alineación y conexión.</p>
              <button class="btn btn-outline btn-sm w-full" onclick="Settings.printTestTicket()">🖨️ Probar Impresora</button>
            </div>
            
            <div style="background:var(--bg-surface); padding:16px; border-radius:var(--radius-sm); border:1px solid var(--border);">
              <h5 class="mb-8">🔌 Lector Físico (Pistola Láser)</h5>
              <p class="text-muted mb-12" style="font-size:0.8rem;">Haz clic en el cuadro y escanea un producto con tu lector.</p>
              <input type="text" class="form-input" style="padding:6px 12px;font-size:0.85rem;" placeholder="Haz clic aquí y escanea..." onkeydown="Settings.testBarcodeScanner(event)">
              <div id="scanner-test-result" class="mt-8 text-success font-bold" style="font-size:0.8rem;"></div>
            </div>

            <div style="background:var(--bg-surface); padding:16px; border-radius:var(--radius-sm); border:1px solid var(--border);">
              <h5 class="mb-8">📷 Escáner de Cámara (Celular)</h5>
              <p class="text-muted mb-12" style="font-size:0.8rem;">Verifica los permisos y prueba la lectura rápida de códigos desde tu celular.</p>
              <button class="btn btn-outline btn-sm w-full" onclick="App.startCameraScanner(code => Settings.testCameraScannerResult(code))">📷 Iniciar Cámara</button>
              <div id="camera-test-result" class="mt-8 text-success font-bold" style="font-size:0.8rem;"></div>
            </div>
          </div>
        </div>
      </div>
    `;
    this.loadUsers();
  },

  printTestTicket() {
    const businessName = this.business?.name || 'Mi Negocio';
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
      <head>
        <title>Ticket de Prueba</title>
        <style>
          body { font-family: 'Courier New', Courier, monospace; width: 80mm; margin: 0; padding: 20px; text-align: center; color: #000; }
          .hr { border-bottom: 1px dashed #000; margin: 10px 0; }
        </style>
      </head>
      <body>
        <h3>${businessName}</h3>
        <p>PRUEBA DE IMPRESIÓN</p>
        <div class="hr"></div>
        <p>La impresora de tickets se encuentra conectada correctamente.</p>
        <p>Fecha: ${new Date().toLocaleString()}</p>
        <div class="hr"></div>
        <p>¡Gracias por su prueba!</p>
        <script>
          window.onload = function() { window.print(); window.close(); };
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
    App.toast('Enviando ticket de prueba...', 'success');
  },

  testBarcodeScanner(e) {
    if (e.key === 'Enter') {
      const val = e.target.value.trim();
      if (val) {
        document.getElementById('scanner-test-result').textContent = `✅ Escaneado: ${val}`;
        Sounds.play('scan');
        e.target.value = '';
      }
    }
  },

  testCameraScannerResult(code) {
    document.getElementById('camera-test-result').textContent = `✅ Escaneado: ${code}`;
  },

  async saveBusiness() {
    try {
      const updates = {
        name: document.getElementById('set-name').value,
        address: document.getElementById('set-address').value,
        phone: document.getElementById('set-phone').value,
        rfc: document.getElementById('set-rfc').value,
      };
      await DB.updateBusiness(updates);
      document.getElementById('business-name').textContent = updates.name;
      App.toast('Datos actualizados', 'success');
    } catch (e) { App.toast('Error: ' + e.message, 'error'); }
  },

  async saveTicket() {
    try {
      await DB.updateBusiness({
        ticket_width: parseInt(document.getElementById('set-ticket-width').value),
        ticket_header: document.getElementById('set-ticket-header').value,
        ticket_footer: document.getElementById('set-ticket-footer').value,
      });
      App.toast('Configuración de ticket guardada', 'success');
    } catch (e) { App.toast('Error: ' + e.message, 'error'); }
  },

  async saveTax() {
    try {
      await DB.updateBusiness({
        tax_enabled: document.getElementById('set-tax-enabled').checked,
        tax_rate: parseFloat(document.getElementById('set-tax-rate').value) || 16,
      });
      App.toast('Configuración de impuesto guardada', 'success');
    } catch (e) { App.toast('Error: ' + e.message, 'error'); }
  },

  async exportBackup() {
    try {
      App.toast('Generando respaldo...', 'info');
      const data = await DB.exportAllData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup_${this.business?.slug || 'tienda'}_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      App.toast('Respaldo descargado', 'success');
      await DB.log('backup_export', { date: new Date().toISOString() });
    } catch (e) { App.toast('Error al exportar: ' + e.message, 'error'); }
  },

  importBackup() {
    if (!confirm('⚠️ Restaurar un respaldo reemplazará los datos actuales. ¿Continuar?')) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      try {
        const file = e.target.files[0];
        const text = await file.text();
        const data = JSON.parse(text);
        if (!data.business || !data.products) throw new Error('Archivo de respaldo inválido');

        // Restore products
        if (data.products?.length) {
          for (const p of data.products) {
            delete p.id;
            p.business_id = DB.businessId;
            await supabase.from('products').insert(p);
          }
        }
        // Restore categories
        if (data.categories?.length) {
          for (const c of data.categories) {
            delete c.id;
            c.business_id = DB.businessId;
            await supabase.from('categories').insert(c);
          }
        }
        // Restore customers
        if (data.customers?.length) {
          for (const cu of data.customers) {
            delete cu.id;
            cu.business_id = DB.businessId;
            await supabase.from('customers').insert(cu);
          }
        }
        App.toast('Datos restaurados exitosamente', 'success');
        this.render();
      } catch (err) { App.toast('Error al restaurar: ' + err.message, 'error'); }
    };
    input.click();
  },

  async loadUsers() {
    const { data: users } = await supabase.from('profiles')
      .select('id, email, full_name, role, pin, is_active')
      .eq('business_id', DB.businessId);
    const el = document.getElementById('users-list');
    if (!el) return;
    if (!users?.length) { el.innerHTML = '<p class="text-muted">Sin usuarios</p>'; return; }
    el.innerHTML = users.map(u => `
      <div class="flex items-center justify-between" style="padding:10px 0;border-bottom:1px solid var(--border);">
        <div>
          <strong>${u.full_name || u.email}</strong>
          <span class="badge ${u.role === 'admin' ? 'badge-primary' : 'badge-warning'}" style="margin-left:8px">${u.role}</span>
        </div>
        <span class="text-muted" style="font-size:0.8rem">${u.email}</span>
      </div>
    `).join('');
  },

  showAddUser() {
    App.showModal(`
      <div class="modal-header"><h3>➕ Agregar Cajero</h3><button class="modal-close" onclick="App.closeModal()">✕</button></div>
      <div class="modal-body">
        <p class="text-muted mb-16">El cajero debe tener una cuenta creada primero (registrarse en la página de login).</p>
        <div class="form-group"><label class="form-label">Email del cajero</label>
          <input type="email" id="add-user-email" class="form-input" placeholder="cajero@correo.com"></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-outline" onclick="App.closeModal()">Cancelar</button>
        <button class="btn btn-primary" onclick="Settings.addUser()">Agregar</button>
      </div>
    `);
  },

  async addUser() {
    const email = document.getElementById('add-user-email').value;
    if (!email) return App.toast('Ingresa el email', 'error');
    try {
      const { data: profile } = await supabase.from('profiles').select('id').eq('email', email).single();
      if (!profile) return App.toast('Usuario no encontrado. Debe registrarse primero.', 'error');
      await supabase.from('profiles').update({ business_id: DB.businessId, role: 'cashier' }).eq('id', profile.id);
      App.toast('Cajero agregado', 'success');
      App.closeModal();
      this.loadUsers();
    } catch (e) { App.toast('Error: ' + e.message, 'error'); }
  }
};
