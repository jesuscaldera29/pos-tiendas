// ============================================
// DB.JS - Database Service Layer (Supabase)
// ============================================
const DB = {
  businessId: null,
  userId: null,

  init(businessId, userId) {
    this.businessId = businessId;
    this.userId = userId;
  },

  // ---- PRODUCTS ----
  async getProducts(filters = {}) {
    try {
      let q = supabase.from('products').select('*, categories(name, icon, color)').eq('business_id', this.businessId).eq('is_active', true).order('name');
      if (filters.category_id) q = q.eq('category_id', filters.category_id);
      if (filters.search) q = q.ilike('name', `%${filters.search}%`);
      if (filters.lowStock) q = q.lte('stock', 'min_stock');
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    } catch (err) {
      console.warn("Failed fetching products with categories join, retrying without join:", err);
      let q = supabase.from('products').select('*').eq('business_id', this.businessId).eq('is_active', true).order('name');
      if (filters.category_id) q = q.eq('category_id', filters.category_id);
      if (filters.search) q = q.ilike('name', `%${filters.search}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    }
  },

  async getProductByBarcode(barcode) {
    try {
      const { data } = await supabase.from('products').select('*, categories(name, icon, color)').eq('business_id', this.businessId).eq('is_active', true).or(`barcode.eq.${barcode},wholesale_barcode.eq.${barcode}`).limit(1).maybeSingle();
      return data;
    } catch (err) {
      console.warn("Failed getProductByBarcode with join, retrying without join:", err);
      const { data } = await supabase.from('products').select('*').eq('business_id', this.businessId).eq('is_active', true).or(`barcode.eq.${barcode},wholesale_barcode.eq.${barcode}`).limit(1).maybeSingle();
      return data;
    }
  },

  async getProductById(id) {
    try {
      const { data } = await supabase.from('products').select('*, categories(name, icon, color)').eq('id', id).single();
      return data;
    } catch (err) {
      console.warn("Failed getProductById with join, retrying without join:", err);
      const { data } = await supabase.from('products').select('*').eq('id', id).single();
      return data;
    }
  },

  async saveProduct(product) {
    product.business_id = this.businessId;
    if (product.id) {
      const { data, error } = await supabase.from('products').update(product).eq('id', product.id).select().single();
      if (error) throw error;
      return data;
    }
    const { data, error } = await supabase.from('products').insert(product).select().single();
    if (error) throw error;
    return data;
  },

  async deleteProduct(id) {
    const { error } = await supabase.from('products').update({ is_active: false }).eq('id', id);
    if (error) throw error;
  },

  async updateStock(productId, quantity, type = 'sale', reason = '') {
    const product = await this.getProductById(productId);
    if (!product) return;
    const stockBefore = product.stock;
    const stockAfter = type === 'sale' ? stockBefore - quantity : stockBefore + quantity;
    await supabase.from('products').update({ stock: stockAfter }).eq('id', productId);
    await supabase.from('stock_movements').insert({
      business_id: this.businessId, product_id: productId,
      type, quantity, stock_before: stockBefore, stock_after: stockAfter, reason
    });
  },

  async importProducts(products) {
    const rows = products.map(p => ({ ...p, business_id: this.businessId }));
    const { data, error } = await supabase.from('products').insert(rows).select();
    if (error) throw error;
    return data;
  },

  // ---- CATEGORIES ----
  async getCategories() {
    const { data } = await supabase.from('categories').select('*').eq('business_id', this.businessId).order('sort_order');
    return data || [];
  },

  async saveCategory(cat) {
    cat.business_id = this.businessId;
    if (cat.id) {
      const { data, error } = await supabase.from('categories').update(cat).eq('id', cat.id).select().single();
      if (error) throw error;
      return data;
    }
    const { data, error } = await supabase.from('categories').insert(cat).select().single();
    if (error) throw error;
    return data;
  },

  async deleteCategory(id) {
    await supabase.from('categories').delete().eq('id', id);
  },

  // ---- SALES ----
  async createSale(sale, items) {
    sale.business_id = this.businessId;
    sale.user_id = this.userId;
    const { data: saleData, error } = await supabase.from('sales').insert(sale).select().single();
    if (error) throw error;
    
    // Strip custom JS fields that aren't database columns in sale_items
    const dbSaleItems = items.map(item => ({
      sale_id: saleData.id,
      product_id: item.product_id,
      product_name: item.product_name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      discount: item.discount || 0,
      subtotal: item.subtotal
    }));
    await supabase.from('sale_items').insert(dbSaleItems);
    
    // Update stock taking conversion units into account
    for (const item of items) {
      if (item.product_id) {
        const qtyToDeduct = item.is_wholesale ? item.quantity * item.wholesale_units : item.quantity;
        await this.updateStock(item.product_id, qtyToDeduct, 'sale');
      }
    }
    return saleData;
  },

  async getSales(dateFrom, dateTo) {
    let q = supabase.from('sales').select('*, profiles(full_name), customers(name)').eq('business_id', this.businessId).order('created_at', { ascending: false });
    if (dateFrom) q = q.gte('created_at', dateFrom);
    if (dateTo) q = q.lte('created_at', dateTo);
    const { data } = await q;
    return data || [];
  },

  async getSaleWithItems(saleId) {
    const { data: sale } = await supabase.from('sales').select('*, profiles(full_name), customers(name)').eq('id', saleId).single();
    const { data: items } = await supabase.from('sale_items').select('*').eq('sale_id', saleId);
    return { ...sale, items: items || [] };
  },

  async getTodaySales() {
    const today = new Date().toISOString().split('T')[0];
    return this.getSales(today + 'T00:00:00', today + 'T23:59:59');
  },

  // ---- CUSTOMERS ----
  async getCustomers(search = '') {
    let q = supabase.from('customers').select('*').eq('business_id', this.businessId).order('name');
    if (search) q = q.ilike('name', `%${search}%`);
    const { data } = await q;
    return data || [];
  },

  async getCustomerById(id) {
    const { data } = await supabase.from('customers').select('*').eq('id', id).single();
    return data;
  },

  async saveCustomer(customer) {
    customer.business_id = this.businessId;
    if (customer.id) {
      const { data, error } = await supabase.from('customers').update(customer).eq('id', customer.id).select().single();
      if (error) throw error;
      return data;
    }
    const { data, error } = await supabase.from('customers').insert(customer).select().single();
    if (error) throw error;
    return data;
  },

  async deleteCustomer(id) {
    await supabase.from('customers').delete().eq('id', id);
  },

  // ---- CREDIT / FIADO ----
  async addCredit(customerId, saleId, amount) {
    const customer = await this.getCustomerById(customerId);
    const newBalance = (customer.balance || 0) + amount;
    await supabase.from('customers').update({ balance: newBalance }).eq('id', customerId);
    await supabase.from('credit_transactions').insert({
      business_id: this.businessId, customer_id: customerId, sale_id: saleId,
      type: 'credit', amount, balance_after: newBalance
    });
    return newBalance;
  },

  async addPayment(customerId, amount, notes = '') {
    const customer = await this.getCustomerById(customerId);
    const newBalance = Math.max(0, (customer.balance || 0) - amount);
    await supabase.from('customers').update({ balance: newBalance }).eq('id', customerId);
    await supabase.from('credit_transactions').insert({
      business_id: this.businessId, customer_id: customerId,
      type: 'payment', amount, balance_after: newBalance, notes
    });
    return newBalance;
  },

  async getCreditHistory(customerId) {
    const { data } = await supabase.from('credit_transactions').select('*, sales(sale_number, total)').eq('customer_id', customerId).order('created_at', { ascending: false });
    return data || [];
  },

  async getTotalCredit() {
    const { data } = await supabase.from('customers').select('balance').eq('business_id', this.businessId).gt('balance', 0);
    return (data || []).reduce((sum, c) => sum + (c.balance || 0), 0);
  },

  // ---- CASH SESSIONS ----
  async getCurrentSession() {
    const { data } = await supabase.from('cash_sessions').select('*').eq('business_id', this.businessId).eq('status', 'open').order('opened_at', { ascending: false }).limit(1).single();
    return data;
  },

  async openSession(amount) {
    const { data, error } = await supabase.from('cash_sessions').insert({
      business_id: this.businessId, user_id: this.userId, opening_amount: amount
    }).select().single();
    if (error) throw error;
    return data;
  },

  async closeSession(sessionId, closingData) {
    const { data, error } = await supabase.from('cash_sessions').update({
      ...closingData, status: 'closed', closed_at: new Date().toISOString()
    }).eq('id', sessionId).select().single();
    if (error) throw error;
    return data;
  },

  async updateSessionTotals(sessionId, field, amount) {
    const session = await this.getCurrentSession();
    if (!session) return;
    const current = session[field] || 0;
    await supabase.from('cash_sessions').update({ [field]: current + amount }).eq('id', sessionId);
  },

  async getSessionHistory() {
    const { data } = await supabase.from('cash_sessions').select('*, profiles(full_name)').eq('business_id', this.businessId).order('opened_at', { ascending: false }).limit(30);
    return data || [];
  },

  async addCashMovement(sessionId, type, amount, reason) {
    await supabase.from('cash_movements').insert({ session_id: sessionId, type, amount, reason });
    const field = type === 'deposit' ? 'total_deposits' : 'total_withdrawals';
    await this.updateSessionTotals(sessionId, field, amount);
  },

  async getSessionMovements(sessionId) {
    const { data } = await supabase.from('cash_movements').select('*').eq('session_id', sessionId).order('created_at');
    return data || [];
  },

  // ---- EXPENSES ----
  async getExpenses(dateFrom, dateTo) {
    let q = supabase.from('expenses').select('*').eq('business_id', this.businessId).order('created_at', { ascending: false });
    if (dateFrom) q = q.gte('created_at', dateFrom);
    if (dateTo) q = q.lte('created_at', dateTo);
    const { data } = await q;
    return data || [];
  },

  async saveExpense(expense) {
    expense.business_id = this.businessId;
    const session = await this.getCurrentSession();
    if (session) {
      expense.session_id = session.id;
      await this.updateSessionTotals(session.id, 'total_expenses', expense.amount);
    }
    const { data, error } = await supabase.from('expenses').insert(expense).select().single();
    if (error) throw error;
    return data;
  },

  async deleteExpense(id) {
    await supabase.from('expenses').delete().eq('id', id);
  },

  async getExpenseCategories() {
    const { data } = await supabase.from('expense_categories').select('*').eq('business_id', this.businessId);
    return data || [];
  },

  async saveExpenseCategory(cat) {
    cat.business_id = this.businessId;
    const { data, error } = await supabase.from('expense_categories').insert(cat).select().single();
    if (error) throw error;
    return data;
  },

  // ---- REPORTS DATA ----
  async getSalesReport(dateFrom, dateTo) {
    const sales = await this.getSales(dateFrom, dateTo);
    const totalSales = sales.reduce((s, v) => s + v.total, 0);
    const totalDiscount = sales.reduce((s, v) => s + (v.discount || 0), 0);
    const cashSales = sales.filter(s => s.payment_method === 'cash').reduce((s, v) => s + v.total, 0);
    const cardSales = sales.filter(s => s.payment_method === 'card').reduce((s, v) => s + v.total, 0);
    const creditSales = sales.filter(s => s.is_credit).reduce((s, v) => s + v.total, 0);
    return { sales, totalSales, totalDiscount, cashSales, cardSales, creditSales, count: sales.length };
  },

  async getTopProducts(dateFrom, dateTo, limit = 10) {
    const sales = await this.getSales(dateFrom, dateTo);
    const saleIds = sales.map(s => s.id);
    if (!saleIds.length) return [];
    const { data: items } = await supabase.from('sale_items').select('product_name, quantity, subtotal').in('sale_id', saleIds);
    const map = {};
    (items || []).forEach(i => {
      if (!map[i.product_name]) map[i.product_name] = { name: i.product_name, qty: 0, total: 0 };
      map[i.product_name].qty += i.quantity;
      map[i.product_name].total += i.subtotal;
    });
    return Object.values(map).sort((a, b) => b.qty - a.qty).slice(0, limit);
  },

  async getLowStockProducts() {
    const { data } = await supabase.from('products').select('*').eq('business_id', this.businessId).eq('is_active', true);
    return (data || []).filter(p => p.stock <= p.min_stock);
  },

  // ---- BUSINESS SETTINGS ----
  async getBusiness() {
    const { data } = await supabase.from('businesses').select('*').eq('id', this.businessId).single();
    return data;
  },

  async updateBusiness(updates) {
    const { data, error } = await supabase.from('businesses').update(updates).eq('id', this.businessId).select().single();
    if (error) throw error;
    return data;
  },

  // ---- BACKUP ----
  async exportAllData() {
    const { data, error } = await supabase.rpc('export_business_data', { p_business_id: this.businessId });
    if (error) throw error;
    return data;
  },

  // ---- ACTIVITY LOG ----
  async log(action, details = {}) {
    await supabase.from('activity_log').insert({
      business_id: this.businessId, user_id: this.userId, action, details
    });
  }
};
