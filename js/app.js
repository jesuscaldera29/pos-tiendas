// ============================================
// APP.JS - Main Application Controller
// ============================================
const App = {
  currentSection: 'pos',
  user: null,
  profile: null,
  business: null,

  async init() {
    // Check auth
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { window.location.href = 'login.html'; return; }
    this.user = session.user;

    // Get profile
    const { data: profile } = await supabase.from('profiles')
      .select('*, businesses(*)')
      .eq('id', this.user.id).single();

    if (!profile) { window.location.href = 'login.html'; return; }
    
    // SuperAdmin impersonation check
    const urlParams = new URLSearchParams(window.location.search);
    const targetBiz = urlParams.get('biz');

    if (profile.role === 'superadmin') {
      if (targetBiz) {
        // Log in as target business
        profile.business_id = targetBiz;
        const { data: targetBusiness } = await supabase.from('businesses').select('*').eq('id', targetBiz).single();
        if (!targetBusiness) { alert('Negocio no encontrado'); window.location.href = 'superadmin.html'; return; }
        profile.businesses = targetBusiness;
        
        // Add a visual indicator for Superadmin
        document.body.style.borderTop = '4px solid var(--warning)';
        App.toast('Modo SuperAdmin: ' + targetBusiness.name, 'warning');
      } else {
        window.location.href = 'superadmin.html'; 
        return;
      }
    } else {
      if (!profile.business_id) {
        alert('Tu cuenta no tiene un negocio asignado. Contacta al administrador.');
        await supabase.auth.signOut();
        window.location.href = 'login.html';
        return;
      }
    }

    this.profile = profile;
    this.business = profile.businesses;

    // Init modules
    DB.init(profile.business_id, profile.id);
    Sounds.init();
    Tickets.init(this.business);
    BarcodeScanner.init((code) => {
      if (App.currentSection === 'pos') {
        POS.handleBarcodeScan(code);
      } else if (App.currentSection === 'inventory') {
        Inventory.handleBarcodeScan(code);
      }
    });

    // Update UI
    document.getElementById('business-name').textContent = this.business?.name || 'Mi Tienda';
    if (this.business?.logo_url) {
      const logoEl = document.querySelector('.sidebar-header .logo');
      if (logoEl) logoEl.innerHTML = `<img src="${this.business.logo_url}" style="width:32px;height:32px;border-radius:4px;object-fit:cover;">`;
    }
    this.updateDynamicManifest();
    this.updateDate();
    setInterval(() => this.updateDate(), 60000);

    // Hide admin-only nav items for cashiers
    if (profile.role === 'cashier') {
      document.querySelectorAll('[data-section="reports"],[data-section="settings"]').forEach(el => el.style.display = 'none');
    }

    // Render initial section
    this.navigate('pos');

    // Register SW
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  },

  navigate(section) {
    this.currentSection = section;
    // Update nav
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelector(`.nav-item[data-section="${section}"]`)?.classList.add('active');
    // Update sections
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById(`section-${section}`)?.classList.add('active');
    // Update title
    const titles = { pos: 'Punto de Venta', inventory: 'Inventario', customers: 'Clientes / Fiado', cashbox: 'Caja', expenses: 'Gastos', reports: 'Reportes', settings: 'Configuración' };
    document.getElementById('section-title').textContent = titles[section] || section;
    // Close sidebar on mobile
    if (window.innerWidth <= 768) {
      document.getElementById('sidebar').classList.remove('open');
    }
    // Render module
    const modules = { pos: POS, inventory: Inventory, customers: Customers, cashbox: Cashbox, expenses: Expenses, reports: Reports, settings: Settings };
    modules[section]?.render();
  },

  toggleSidebar() {
    if (window.innerWidth <= 768) {
      document.getElementById('sidebar').classList.toggle('open');
    } else {
      document.getElementById('sidebar').classList.toggle('collapsed');
    }
  },

  updateDate() {
    document.getElementById('current-date').textContent = new Date().toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  },

  // Modal system
  showModal(content, extraClass = '') {
    const overlay = document.getElementById('modal-overlay');
    const modal = document.getElementById('modal-content');
    modal.className = 'modal ' + extraClass;
    modal.innerHTML = content;
    overlay.classList.add('active');
  },

  closeModal() {
    document.getElementById('modal-overlay').classList.remove('active');
  },

  activeScanner: null,

  startCameraScanner(callback) {
    App.showModal(`
      <div class="modal-header"><h3>📷 Escanear con Cámara</h3><button class="modal-close" onclick="App.stopCameraScanner()">✕</button></div>
      <div class="modal-body text-center">
        <div id="camera-reader" style="width:100%; max-width:400px; margin:0 auto; border-radius:var(--radius-sm); overflow:hidden;"></div>
        <p class="text-muted mt-8">Apunta al código de barras con la cámara trasera de tu celular.</p>
      </div>
    `);

    setTimeout(() => {
      if (typeof Html5Qrcode === 'undefined') {
        App.toast("Cargando escáner de cámara...", "info");
        return;
      }
      const html5QrCode = new Html5Qrcode("camera-reader");
      App.activeScanner = html5QrCode;
      
      html5QrCode.start(
        { facingMode: "environment" }, 
        {
          fps: 10,
          qrbox: (width, height) => {
            return { width: Math.min(width * 0.8, 300), height: 120 };
          }
        },
        (decodedText) => {
          Sounds.play('scan');
          App.toast(`Código detectado: ${decodedText}`, 'success');
          // Stop scanner and close camera modal FIRST, then call callback
          const runCallback = () => {
            setTimeout(() => { if (callback) callback(decodedText); }, 250);
          };
          if (App.activeScanner) {
            App.activeScanner.stop().then(() => {
              App.activeScanner = null;
              App.closeModal();
              runCallback();
            }).catch(err => {
              console.error("Error stopping camera scanner:", err);
              App.activeScanner = null;
              App.closeModal();
              runCallback();
            });
          } else {
            App.closeModal();
            runCallback();
          }
        },
        (errorMessage) => {
          // Silent scan errors
        }
      ).catch(err => {
        console.error("Camera scan failed to start:", err);
        App.toast("Error al abrir cámara: " + err.message, "error");
        App.closeModal();
      });
    }, 300);
  },

  stopCameraScanner() {
    if (App.activeScanner) {
      App.activeScanner.stop().then(() => {
        App.activeScanner = null;
        App.closeModal();
      }).catch(err => {
        console.error("Error stopping camera scanner:", err);
        App.activeScanner = null;
        App.closeModal();
      });
    } else {
      App.closeModal();
    }
  },

  // Toast notifications
  toast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${icons[type] || ''}</span><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 4000);
  },

  async logout() {
    if (!confirm('¿Cerrar sesión?')) return;
    await supabase.auth.signOut();
    window.location.href = 'login.html';
  },

  installPWA() {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
          App.toast('¡Aplicación instalada con éxito!', 'success');
        }
        deferredPrompt = null;
      });
    } else {
      App.toast('La aplicación ya está instalada o puedes añadirla desde el menú del navegador ("Instalar" o "Agregar a pantalla de inicio").', 'info');
    }
  },

  updateDynamicManifest() {
    try {
      const logoUrl = this.business?.logo_url;
      const name = this.business?.name || 'POS Tienda';
      
      const manifest = {
        name: name,
        short_name: name,
        start_url: window.location.pathname.includes('app.html') ? 'app.html' : 'index.html',
        display: "standalone",
        background_color: "#0a0a1a",
        theme_color: "#0a0a1a",
        icons: [
          {
            src: logoUrl || "assets/icon-192.png",
            sizes: "192x192",
            type: "image/png"
          },
          {
            src: logoUrl || "assets/icon-512.png",
            sizes: "512x512",
            type: "image/png"
          }
        ]
      };
      
      const blob = new Blob([JSON.stringify(manifest)], {type: 'application/json'});
      const manifestURL = URL.createObjectURL(blob);
      
      const oldManifestLink = document.querySelector('link[rel="manifest"]');
      if (oldManifestLink) {
        oldManifestLink.setAttribute('href', manifestURL);
      }
    } catch (e) {
      console.warn("Failed to generate dynamic PWA manifest:", e);
    }
  }
};

let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  const btn = document.getElementById('pwa-install-btn');
  if (btn) {
    btn.style.display = 'block';
    btn.textContent = '📲 Instalar en este Dispositivo';
  }
});

// Close modal on overlay click
document.getElementById('modal-overlay')?.addEventListener('click', (e) => {
  if (e.target === e.currentTarget) App.closeModal();
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  if (e.key === 'F1') { e.preventDefault(); App.navigate('pos'); }
  if (e.key === 'F2') { e.preventDefault(); App.navigate('inventory'); }
  if (e.key === 'F3') { e.preventDefault(); App.navigate('customers'); }
  if (e.key === 'F4') { e.preventDefault(); App.navigate('cashbox'); }
  if (e.key === 'F5') { e.preventDefault(); App.navigate('reports'); }
});

// Init app
document.addEventListener('DOMContentLoaded', () => {
  App.init();
  document.querySelector('.main-content')?.addEventListener('click', () => {
    if (window.innerWidth <= 768) {
      document.getElementById('sidebar')?.classList.remove('open');
    }
  });
});
