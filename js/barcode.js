// ============================================
// BARCODE.JS - Barcode scanner handler
// ============================================
const BarcodeScanner = {
  buffer: '',
  timeout: null,
  callback: null,
  listening: false,

  init(callback) {
    this.callback = callback;
    this.startListening();
  },

  startListening() {
    if (this.listening) return;
    this.listening = true;
    document.addEventListener('keydown', this.handleKey.bind(this));
  },

  handleKey(e) {
    // Ignore if user is typing in an input (except barcode input)
    const target = e.target;
    const isBarcodeInput = target.id === 'barcode-input';
    const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';

    if (isInput && !isBarcodeInput) return;

    // Scanner sends characters rapidly then Enter
    if (e.key === 'Enter') {
      if (this.buffer.length >= 4) {
        e.preventDefault();
        const code = this.buffer.trim();
        this.buffer = '';
        if (this.callback) this.callback(code);
      }
      this.buffer = '';
      clearTimeout(this.timeout);
      return;
    }

    if (e.key.length === 1) {
      this.buffer += e.key;
      clearTimeout(this.timeout);
      this.timeout = setTimeout(() => { this.buffer = ''; }, 100);
    }
  },

  destroy() {
    document.removeEventListener('keydown', this.handleKey.bind(this));
    this.listening = false;
  }
};
