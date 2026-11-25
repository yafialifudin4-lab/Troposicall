import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Activity,
  ArrowLeft,
  Banknote,
  BarChart3,
  Boxes,
  Check,
  ChevronDown,
  CircleCheck,
  CircleDollarSign,
  ClipboardList,
  CreditCard,
  Download,
  Eye,
  EyeOff,
  LayoutDashboard,
  LockKeyhole,
  LogOut,
  Menu,
  Minus,
  Pencil,
  Plus,
  Printer,
  QrCode,
  Receipt,
  Search,
  Settings,
  ShoppingCart,
  Tags,
  Trash2,
  Utensils,
  Users,
  Clock3,
  X,
  ArrowRight,
} from 'lucide-react';
import { supabase } from './lib/supabase.js';
import {
  CartItems,
  CashierDashboard,
  CashierOrdersPage,
  categories,
  dateKey,
  IncomingOrdersPage,
  money,
  orderRevenue,
  Pill,
  PaymentVerificationPage,
  PosPage,
  StatCard,
  StaffHeading,
  statusTone,
} from './CashierPages.jsx';
import {
  applyOrderChanges,
  createOrder,
  deleteProduct,
  fetchProducts,
  fetchStoreSettings,
  fetchTransactions,
  renameProductCategory,
  saveProduct,
  setProductStock,
  updateOrderState,
} from './lib/order-service.js';

function Logo({ small = false }) {
  return (
    <div className={`brand-logo${small ? ' brand-logo-small' : ''}`}>
      <img src="/assets/palm-sun.png" alt="" />
      <span className="brand-wordmark">
        <strong>TROPOSICAL</strong>
        <small>BY LOVE IN PARADISE</small>
      </span>
    </div>
  );
}

function ReadOnlyOrderItems({ items }) {
  return (
    <div className="receipt-order-items">
      {items.map((item, index) => (
        <div className="receipt-order-line" key={item.id || `${item.name}-${index}`}>
          <span>{item.quantity} × {item.name}</span>
          <strong>{money(item.total)}</strong>
        </div>
      ))}
    </div>
  );
}

function ProductCard({ product, onAdd, compact = false, disabled = false }) {
  return (
    <article className={`product-card${compact ? ' product-card-compact' : ''}`}>
      <div className="product-photo-wrap">
        <img className="product-photo" src={product.image} alt={product.name} />
        <span className="product-category">{product.category}</span>
        {product.stock <= 0 && <span className="sold-stamp">Sold out</span>}
      </div>
      <div className="product-copy">
        <h3>{product.name}</h3>
        {product.description && <p>{product.description}</p>}
        <div className="product-meta">
          <strong>{money(product.price)}</strong>
          {product.stock > 0 && <span className="stock-tag">Stock {product.stock}</span>}
        </div>
        <button
          className="button button-red button-small add-product"
          disabled={disabled || !product.available || product.stock <= 0}
          onClick={() => onAdd(product)}
        >
          <Plus size={14} /> Add · {money(product.price)}
        </button>
      </div>
    </article>
  );
}

function ReceiptPreview({ order, onBack }) {
  const [paperSize, setPaperSize] = useState('80mm');
  const createdDate = order.createdAt ? new Date(order.createdAt) : null;
  const createdLabel = createdDate && !Number.isNaN(createdDate.getTime())
    ? `${createdDate.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}, ${createdDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`
    : order.time;
  const printReceipt = () => window.print();
  const paymentStatus = order.status === 'Completed'
    ? 'COMPLETE'
    : order.paymentStatus === 'Lunas'
      ? 'PAID'
      : order.paymentStatus === 'Dibatalkan'
        ? 'CANCELLED'
        : 'WAITING';

  return (
    <div className="overlay receipt-preview-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onBack(); }}>
      <section className="modal receipt-preview-modal">
        <button className="icon-button modal-close" aria-label="Close receipt" onClick={onBack}><X size={17} /></button>
        <h2 className="order-id">{order.id}</h2>
        <p className="receipt-preview-meta">{order.customer === 'Walk-in' ? 'Walk-in guest' : order.customer} · {createdLabel}</p>
        <div className="modal-status">
          <Pill>{order.customer === 'Walk-in' ? 'Walk-in' : 'Customer'}</Pill>
          <Pill tone={order.payment === 'QRIS' ? 'blue' : 'neutral'}>{order.payment}</Pill>
          {order.paymentStatus === 'Lunas' && <Pill tone="green">Paid</Pill>}
          <Pill tone={statusTone(order.status)}>{order.status}</Pill>
        </div>
        <div className="receipt-size-options" role="group" aria-label="Receipt paper size">
          {['58mm', '80mm', 'Standard'].map((size) => (
            <button type="button" className={paperSize === size ? 'selected' : ''} key={size} onClick={() => setPaperSize(size)}>{size}</button>
          ))}
        </div>
        <article className={`receipt-paper receipt-paper-${paperSize.toLowerCase()}`}>
          <Logo />
          <p className="receipt-tagline">Summer Tastes, Paradise Memories.</p>
          <div className="receipt-paper-divider" />
          <div className="receipt-paper-info"><span>No.</span><strong>{order.id}</strong></div>
          <div className="receipt-paper-info"><span>Date</span><strong>{createdLabel}</strong></div>
          <div className="receipt-paper-info"><span>Type</span><strong>{order.customer === 'Walk-in' ? 'Walk-in' : 'Customer'}</strong></div>
          <div className="receipt-paper-info"><span>Name</span><strong>{order.customer}</strong></div>
          <div className="receipt-paper-divider" />
          <div className="receipt-paper-lines">
            {(order.lines || []).map((line) => (
              <div className="receipt-paper-item" key={line.id || line.name}>
                <strong>{line.name}</strong>
                <div><span>{line.quantity} x {money(line.unitPrice)}</span><b>{money(line.total)}</b></div>
              </div>
            ))}
          </div>
          <div className="receipt-paper-divider" />
          <div className="receipt-paper-total"><strong>TOTAL</strong><strong>{money(order.total)}</strong></div>
          <div className="receipt-paper-info"><span>Payment</span><strong>{order.payment}</strong></div>
          <div className="receipt-paper-info"><span>Status</span><strong>{paymentStatus}</strong></div>
  
          <div className="receipt-paper-divider" />
          <p className="receipt-paper-footer">Thank you! See you by the shore.<br />~ &nbsp; ~ &nbsp; ~</p>
        </article>
        <div className="receipt-preview-actions">
          <button type="button" className="button button-outline" onClick={printReceipt}><Printer size={15} /> Print</button>
          <button type="button" className="button button-blue" onClick={printReceipt}><Download size={15} /> PDF</button>
        </div>
        <button type="button" className="receipt-back-button" onClick={onBack}>Back to order</button>
      </section>
    </div>
  );
}

function CustomerSite({
  products,
  cart,
  addToCart,
  changeQuantity,
  clearCart,
  onStaff,
  onCreateOrder,
  onSendReceipt,
  loading,
  loadError,
  storeOpen,
  storeSettingsConfigured,
  qrisImage,
}) {
  const [category, setCategory] = useState('All');
  const [search, setSearch] = useState('');
  const [cartOpen, setCartOpen] = useState(false);
  const [stage, setStage] = useState('menu');
  const [customer, setCustomer] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [payment, setPayment] = useState('Cash');
  const [receiptOrder, setReceiptOrder] = useState(null);
  const [receiptEmailStatus, setReceiptEmailStatus] = useState('');
  const [notice, setNotice] = useState('');
  const [orderError, setOrderError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const noticeTimer = useRef(null);
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
  const total = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

  useEffect(() => () => {
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
  }, []);

  const showCartNotice = (itemName) => {
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
    setNotice(`✓ ${itemName} berhasil ditambahkan ke keranjang.`);
    noticeTimer.current = window.setTimeout(() => setNotice(''), 2200);
  };

  const categoryOptions = categories;
  const filteredProducts = useMemo(
    () =>
      products.filter((product) => {
        const matchesCategory = category === 'All' || product.category === category;
        const matchesSearch = `${product.name} ${product.description}`.toLowerCase().includes(search.toLowerCase());
        return matchesCategory && matchesSearch;
      }),
    [category, products, search],
  );

  const updateCart = (product, amount) => {
    if (amount > 0) addToCart(product);
    else changeQuantity(product, -1);
  };

  const startCheckout = () => {
    if (!customer.trim()) {
      setOrderError('Customer name is required.');
      return;
    }
    setCustomer(customer.trim());
    setOrderError('');
    setCartOpen(false);
    setStage('checkout');
  };

  const placeOrder = async (event) => {
    event.preventDefault();
    if (cart.length === 0 || !storeOpen || submitting) return;
    if (!customer.trim()) {
      setOrderError('Customer name is required.');
      return;
    }
    setOrderError('');
    setSubmitting(true);
    try {
      const email = customerEmail.trim();
      const order = await onCreateOrder({
        channel: 'customer',
        customerName: customer.trim(),
        payment,
        items: cart,
      });
      if (email) {
        try {
          await onSendReceipt(order, email);
          setReceiptEmailStatus(`Receipt sent to ${email}.`);
        } catch (error) {
          setReceiptEmailStatus(`Order saved, but the receipt could not be emailed to ${email}: ${error.message}`);
        }
      } else {
        setReceiptEmailStatus('');
      }
      setReceiptOrder(order);
      setStage('complete');
    } catch (error) {
      setOrderError(error.message || 'Order could not be saved. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };
  const backToMenu = () => {
    if (stage === 'complete') {
      clearCart();
      setCustomer('');
      setCustomerEmail('');
      setReceiptOrder(null);
      setReceiptEmailStatus('');
    }
    setStage('menu');
  };

  return (
    <main className="customer-site">
      <header className="customer-header">
        {stage === 'checkout' || stage === 'complete' ? (
          <button className="text-button back-menu" onClick={backToMenu}><ArrowLeft size={16} /> Back to menu</button>
        ) : <Logo />}
        {stage === 'menu' && (
          <button className="button button-red cart-trigger" onClick={() => setCartOpen(true)}>
            <ShoppingCart size={15} /> Cart <span>{count}</span>
          </button>
        )}
      </header>

      {stage === 'menu' && (
        <>
          <section className="beach-hero" aria-label="Beach paradise">
            <img src="/assets/beach-hero.png" alt="" />
          </section>
          <section className="menu-section">
            <div className="menu-title-row">
              <div>
                <p className="eyebrow"><span>★</span> TODAY'S MENU</p>
                <h1>Pick your paradise</h1>
              </div>
              <label className="search-field menu-search">
                <Search size={16} />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search the menu..." />
              </label>
            </div>
            <div className="menu-filter-row">
              <div className="category-pills">
                {categoryOptions.map((item) => (
                  <button
                    className={`category-pill${category === item ? ' selected' : ''}`}
                    key={item}
                    onClick={() => setCategory(item)}
                  >
                    {item === 'All' ? '✣' : '★'}&nbsp; {item}
                  </button>
                ))}
              </div>
              <label className="search-field mobile-search">
                <Search size={16} />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search the menu..." />
              </label>
            </div>
            {!storeOpen && <p className="inline-error" role="status">Online ordering is currently closed.</p>}
            {loadError && <p className="inline-error" role="alert">{loadError}</p>}
            {notice && <p className="inline-notice" role="status">{notice}</p>}
            <div className="product-grid">
              {filteredProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  disabled={!storeOpen}
                  onAdd={(item) => {
                    if (storeOpen && item.stock > 0) {
                      addToCart(item);
                      showCartNotice(item.name);
                    }
                  }}
                />
              ))}
              {loading && <div className="empty-search">Loading the menu…</div>}
              {!loading && products.length === 0 && !loadError && <div className="empty-search">The menu is being prepared.</div>}
              {!loading && products.length > 0 && filteredProducts.length === 0 && <div className="empty-search">No menu items match your search.</div>}
            </div>
          </section>
          <footer className="customer-footer">
            <Logo small />
            <p>Thank you! See you by the shore.</p>
            <button className="text-button" onClick={onStaff}>Copyright © 2026 TROPOSICAL. All rights reserved.</button>
          </footer>
        </>
      )}

      {stage === 'checkout' && (
        <section className="checkout-page">
          <div className="checkout-heading">
            <p className="eyebrow">YOUR BEACH BASKET</p>
            <h1>Checkout</h1>
          </div>
          <form className="checkout-grid" onSubmit={placeOrder}>
            <div className="checkout-steps">
              <section className="checkout-card">                
                <h2>Who's this for?</h2>
                <input value={customer} readOnly aria-label="Customer name" />
                <small>Name helps us call you when your order is ready.</small>
              </section>              
              <section className="checkout-card">
                <h2>Order summary</h2>
                <CartItems cart={cart} onChange={updateCart} />
                <div className="checkout-total"><span>Total payment</span><strong>{money(total)}</strong></div>
              </section>
              <section className="checkout-card">
                <h2>How will you pay?</h2>
                <div className="payment-options">
                  {['Cash', 'QRIS'].map((option) => (
                    <button className={`payment-option${payment === option ? ' selected' : ''}`} type="button" key={option} onClick={() => setPayment(option)}>
                      {option === 'Cash' ? <Banknote size={22} /> : <QrCode size={22} />}
                      <strong>{option}</strong>
                      <span>{option === 'Cash' ? 'Pay at the cashier' : 'Scan with your e-wallet'}</span>
                    </button>
                  ))}
                </div>
                {payment === 'QRIS' && <p className="payment-note">The QRIS code will appear after you place your order. Please show your payment proof to the cashier.</p>}
              </section>
            </div>
            <aside className="checkout-aside">
              <h2>Order total</h2>
              <p>{count} item{count === 1 ? '' : 's'} in your basket</p>
              <div className="checkout-total"><span>Total</span><strong>{money(total)}</strong></div>
              {orderError && <p className="inline-error" role="alert">{orderError}</p>}
              <button className="button button-red checkout-submit" type="submit" disabled={!cart.length || !storeOpen || submitting}>
                {submitting ? 'Saving order…' : `Place order · ${money(total)}`}
              </button>
              <small>Payment is confirmed manually by the cashier.</small>
            </aside>
          </form>
        </section>
      )}

      {stage === 'complete' && (
        <section className="receipt-page">
          <div className="receipt-card">
            <div className="receipt-check"><CircleCheck size={30} /></div>
            <Logo />
            <p className="eyebrow">ORDER RECEIVED</p>
            <h1>Thank you{customer ? `, ${customer}` : ''}!</h1>
            <p>Your order has been saved and sent to the booth.</p>
            {receiptEmailStatus && (
              <p
                className={receiptEmailStatus.startsWith('Receipt sent') ? 'inline-notice' : 'inline-error'}
                role={receiptEmailStatus.startsWith('Receipt sent') ? 'status' : 'alert'}
              >
                {receiptEmailStatus}
              </p>
            )}
            <div className="receipt-number">{receiptOrder?.id}</div>
            <div className={`receipt-status${payment === 'QRIS' && receiptOrder?.paymentStatus === 'Menunggu' ? ' receipt-status-qris' : ''}`}>
              <div className="receipt-status-info">
                <span>Payment</span><Pill tone="blue">{payment}</Pill><Pill tone={statusTone(receiptOrder?.status)}>{receiptOrder?.status}</Pill>
              </div>
              {payment === 'QRIS' && receiptOrder?.paymentStatus === 'Menunggu' && (
                <a className="button button-outline button-small receipt-qris-download" href={qrisImage} download="QRIS-TROPOSICAL">
                  <QrCode size={12} /> Unduh Qris
                </a>
              )}
            </div>
            {payment === 'QRIS' && receiptOrder?.paymentStatus === 'Menunggu' && (
              <div className="qris-payment">
                <p>Scan to pay, then show your payment proof to the cashier.</p>
                <img src={qrisImage} alt="TROPOSICAL QRIS payment code" />
              </div>
            )}
            {payment === 'Cash' && <p className="payment-note">Pay at the cashier and show this order number.</p>}
            <div className="receipt-summary">
              <ReadOnlyOrderItems items={receiptOrder?.lines || []} />
              <div className="checkout-total"><span>Total</span><strong>{money(receiptOrder?.total)}</strong></div>
            </div>
            <p className="preview-notice">Payment is not verified automatically; the cashier updates the status after checking.</p>
            <button className="button button-blue" onClick={backToMenu}>Back to menu</button>
          </div>
        </section>
      )}

      {cartOpen && (
        <div className="overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) setCartOpen(false); }}>
          <aside className="basket-drawer">
            <div className="drawer-heading">
              <div><p className="eyebrow">YOUR BEACH BASKET</p><h2>{count} item{count === 1 ? '' : 's'}</h2></div>
              <button className="icon-button" aria-label="Close basket" onClick={() => setCartOpen(false)}><X size={20} /></button>
            </div>
            {cart.length ? (
              <>
                <CartItems cart={cart} onChange={updateCart} onRemove={(product) => changeQuantity(product, -999)} />
                <div className="basket-summary">
                  <div><span>Subtotal</span><span>{money(total)}</span></div>
                  <div className="checkout-total"><span>Total</span><strong>{money(total)}</strong></div>
                  <label className="basket-customer-field">
                    <span>Customer name (required)</span>
                    <input
                      value={customer}
                      onChange={(event) => {
                        setCustomer(event.target.value);
                        if (orderError) setOrderError('');
                      }}
                      placeholder="Enter customer name"
                      required
                    />
                  </label>
                  {orderError && <p className="inline-error" role="alert">{orderError}</p>}
                  <div className="basket-actions">
                    <button className="text-button" onClick={clearCart}>Clear cart</button>
                    <button className="button button-red" onClick={startCheckout}>Checkout · {money(total)}</button>
                  </div>
                </div>
              </>
            ) : <div className="empty-basket"><span>☼</span><h3>Your basket is empty</h3><p>Pick a little paradise from the menu.</p></div>}
          </aside>
        </div>
      )}
    </main>
  );
}

const adminNav = [
  ['Dashboard', LayoutDashboard],
  ['Product Management', Utensils],
  ['Categories', Tags],
  ['Inventory & Stock', Boxes],
  ['Order Management', ClipboardList],
  ['Cashier Management', Users],
  ['Sales Reports', BarChart3],
  ['Settings', Settings],
  ['Open cashier POS', CreditCard],
];
const cashierNav = [
  ['Dashboard', LayoutDashboard],
  ['New Transaction', CreditCard],
  ['Incoming Orders', ClipboardList],
  ['All Orders', Receipt],
  ['Payment Verification', CircleCheck],
  ['Transaction History', Activity],
];

function LoginPage({ role, setRole, onLogin, onMenu }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await onLogin({ email, password, expectedRole: role });
    } catch (loginError) {
      setError(loginError.message || 'Sign in failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <main className="login-page">
      <div className="login-art">
        <img src="/assets/beach-hero.png" alt="" />
        <div className="login-brand-card"><Logo small /><p>{role === 'admin' ? 'Admin dashboard' : 'Cashier and admin dashboards for the TROPOSICAL summer bazaar booth.'}</p></div>
      </div>
      <section className="login-panel">
        <div className="login-content">
          <Logo />
          <form className="login-card" onSubmit={submit}>
            <h1><LockKeyhole size={15} /> {role === 'admin' ? 'Admin sign in' : 'Cashier sign in'}</h1>
            <label>Email<input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" /></label>
            <div className="password-field">
              <label htmlFor="login-password">Password</label>
              <div className="password-input-wrap">
                <input id="login-password" type={showPassword ? 'text' : 'password'} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="••••••••" />
                <button
                  className="password-visibility-toggle"
                  type="button"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((visible) => !visible)}
                >
                  {showPassword ? <Eye size={16} /> : <EyeOff size={16} />}
                </button>
              </div>
            </div>
            {error && <p className="inline-error" role="alert">{error}</p>}
            <button className="button button-red" type="submit" disabled={submitting}>{submitting ? 'Signing in…' : 'Sign in'}</button>
            <p className="login-preview">Sign in with your Supabase staff account.</p>
          </form>
          <div className="login-links">
            <button className="text-button" onClick={() => setRole(role === 'admin' ? 'cashier' : 'admin')}>
              Open {role === 'admin' ? 'cashier' : 'admin'} sign in
            </button>
            <button className="text-button" onClick={onMenu}>Open the menu for ordering</button>
          </div>
        </div>
      </section>
    </main>
  );
}

function Sidebar({ role, page, setPage, onLogout, open, onToggle, staffName, staffEmail, onOpenCashier }) {
  const navigation = role === 'admin' ? adminNav : cashierNav;
  const accountName = staffName || staffEmail?.split('@')[0] || (role === 'admin' ? 'Admin' : 'Cashier');
  return (
    <>
      {open && <button className="sidebar-backdrop" aria-label="Close navigation" onClick={() => onToggle(false)} />}
      <aside className={`staff-sidebar${open ? ' sidebar-open' : ''}`}>
        <div className="sidebar-logo"><Logo small /><span>{role === 'admin' ? 'ADMIN' : 'CASHIER · ADMIN'}</span></div>
        <nav>
          {navigation.map(([label, Icon]) => (
            <button
              className={`sidebar-link${page === label ? ' active' : ''}`}
              key={label}
              onClick={() => {
                onToggle(false);
                if (label === 'Open cashier POS') onOpenCashier();
                else setPage(label);
              }}
            >
              <Icon size={16} /><span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-account">
          <strong>{accountName}</strong>
          <span>{staffEmail || '—'}</span>
          <button onClick={onLogout}><LogOut size={14} /> Logout</button>
        </div>
      </aside>
    </>
  );
}

function DashboardPage({ orders, products }) {
  const todayKey = dateKey(new Date());
  const paidOrders = orders.filter((order) => order.paymentStatus === 'Lunas');
  const ordersToday = orders.filter((order) => order.createdAt && dateKey(order.createdAt) === todayKey);
  const todayPaidOrders = ordersToday.filter((order) => order.paymentStatus === 'Lunas');
  const lastSevenDays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    const key = dateKey(date);
    const dayOrders = paidOrders.filter((order) => order.createdAt && dateKey(order.createdAt) === key);
    return {
      key,
      label: date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' }),
      revenue: orderRevenue(dayOrders),
    };
  });
  const maxDailyRevenue = Math.max(1, ...lastSevenDays.map((day) => day.revenue));
  const unitsSold = todayPaidOrders.reduce((sum, order) => sum + order.lines.reduce((itemSum, item) => itemSum + item.quantity, 0), 0);
  const cashToday = orderRevenue(todayPaidOrders.filter((order) => order.payment === 'Cash'));
  const qrisToday = orderRevenue(todayPaidOrders.filter((order) => order.payment === 'QRIS'));
  const paymentTotalToday = cashToday + qrisToday;
  const cashShare = paymentTotalToday ? (cashToday / paymentTotalToday) * 100 : 0;
  const paymentChart = paymentTotalToday
    ? `conic-gradient(#188658 0 ${cashShare}%, #5470eb ${cashShare}% 100%)`
    : '#e9e3d8';
  const unpaidToday = ordersToday.filter((order) => order.paymentStatus === 'Menunggu').length;
  const cancelledToday = ordersToday.filter((order) => order.paymentStatus === 'Dibatalkan').length;
  const soldByProduct = new Map();
  paidOrders.forEach((order) => order.lines.forEach((item) => soldByProduct.set(item.name, (soldByProduct.get(item.name) || 0) + item.quantity)));
  return (
    <>
      <StaffHeading eyebrow="BAZAAR OVERVIEW" title="Admin dashboard" />
      <div className="staff-page-content">
        <div className="stats-grid">
          <StatCard icon={CircleDollarSign} label="REVENUE TODAY" value={money(orderRevenue(todayPaidOrders))} color="red" />
          <StatCard icon={CircleCheck} label="SUCCESSFUL TRANSACTIONS" value={todayPaidOrders.length} note={`${unpaidToday} unpaid · ${cancelledToday} cancelled`} color="blue" />
          <StatCard icon={ShoppingCart} label="PRODUCTS SOLD" value={unitsSold} color="yellow" />
          <StatCard icon={BarChart3} label="REVENUE (7 DAYS)" value={money(orderRevenue(paidOrders.filter((order) => order.createdAt && dateKey(order.createdAt) >= lastSevenDays[0].key)))} color="green" />
        </div>
        <div className="dashboard-top-grid">
          <section className="panel revenue-panel">
            <h2>Revenue</h2>
            <div className="bar-chart">
              {lastSevenDays.map((day) => (
                <div className="bar-column" key={day.label}><span style={{ height: `${Math.max(4, (day.revenue / maxDailyRevenue) * 92)}%` }} /><small>{day.label}</small></div>
              ))}
              <div className="chart-y-labels"><span>120k</span><span>80k</span><span>40k</span><span>0</span></div>
            </div>
          </section>
          <section className="panel payment-panel">
            <h2>Cash vs QRIS today</h2>
            <div className="donut-chart" style={{ background: paymentChart }}><div /></div>
            <div className="payment-legend"><span>Cash <strong>{money(cashToday)}</strong></span><span>QRIS <strong>{money(qrisToday)}</strong></span></div>
          </section>
        </div>
        <div className="dashboard-bottom-grid">
          <section className="panel">
            <h2>Best sellers</h2>
            {[...products].sort((a, b) => (soldByProduct.get(b.name) || 0) - (soldByProduct.get(a.name) || 0)).map((product, index) => (
              <div className="mini-product" key={product.id}><span className="rank">{index + 1}</span><img src={product.image} alt="" /><strong>{product.name}</strong><span>{soldByProduct.get(product.name) || 0} sold<br /><small>{money(product.price)}</small></span></div>
            ))}
          </section>
          <section className="panel">
            <h2>Stock overview <button className="text-button" onClick={() => window.dispatchEvent(new CustomEvent('staff-nav', { detail: 'Inventory & Stock' }))}>Manage</button></h2>
            {products.map((product) => <div className="stock-row" key={product.id}><img src={product.image} alt="" /><strong>{product.name}</strong><Pill tone="green">{product.stock} left</Pill></div>)}
          </section>
        </div>
      </div>
    </>
  );
}

function ProductManagement({ products, openModal, categoryOptions, onToggleProduct, onDeleteProduct }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All categories');
  const visible = products.filter((item) => item.name.toLowerCase().includes(search.toLowerCase()) && (filter === 'All categories' || item.category === filter));
  return (
    <>
      <StaffHeading
        eyebrow="MENU"
        title="Product management"
        action={<button className="button button-red button-small" onClick={() => openModal('product')}><Plus size={14} /> Add product</button>}
      />
      <div className="staff-page-content">
        <div className="table-tools">
          <label className="search-field"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search products" /></label>
          <label className="select-field"><select value={filter} onChange={(event) => setFilter(event.target.value)}><option>All categories</option>{categoryOptions.map((item) => <option key={item}>{item}</option>)}</select><ChevronDown size={14} /></label>
        </div>
        <div className="manage-product-grid">
          {visible.map((product) => (
            <article className={`manage-product-card${product.available && product.stock > 0 ? ' is-available' : ' is-hidden'}`} key={product.id}>
              <div className="manage-product-image">
                <img src={product.image} alt="" />
                {(!product.available || product.stock <= 0) && <span className="manage-sold-out">Sold out</span>}
              </div>
              <div className="manage-product-copy">
                <small>{product.category.toUpperCase()}</small><h3>{product.name}</h3>
                {product.description && <p>{product.description}</p>}
                <div className="product-meta"><strong>{money(product.price)}</strong><span className="stock-tag">Stock {product.stock}</span></div>
                <div className="manage-product-actions">
                  <button className={`availability-toggle${product.stock <= 0 ? ' empty' : product.available ? (product.stock <= 8 ? ' running-low' : ' on') : ''}`} onClick={() => onToggleProduct(product)}><i />{product.stock <= 0 ? 'Empty' : product.available ? (product.stock <= 8 ? 'Running low' : 'Available') : 'Hidden'}</button>
                  <button className="icon-button" aria-label={`Edit ${product.name}`} onClick={() => openModal('product', product)}><Pencil size={14} /></button>
                  <button className="icon-button danger" aria-label={`Delete ${product.name}`} onClick={() => onDeleteProduct(product)}><Trash2 size={14} /></button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </>
  );
}

function CategoriesPage({ products, customCategories, openModal }) {
  const unique = categories.slice(1);
  return (
    <>
      <StaffHeading eyebrow="MENU" title="Categories" />
      <div className="staff-page-content category-grid">
        {unique.map((name, index) => {
          const count = products.filter((product) => product.category === name).length;
          return <article className="category-card" key={name}><span className="category-card-icon">{index === 0 ? '✿' : index === 2 ? '☼' : '✦'}</span><div><h2>{name}</h2><p>{count} menu item{count === 1 ? '' : 's'}</p></div></article>;
        })}
      </div>
    </>
  );
}

function InventoryPage({ products, onAdjustStock }) {
  return (
    <>
      <StaffHeading eyebrow="BOOTH" title="Inventory & stock" />
      <div className="staff-page-content">
        <section className="panel table-panel">
          <div className="table-scroll"><table><thead><tr><th>Product</th><th>Category</th><th>Current stock</th><th>Status</th><th>Update stock</th></tr></thead><tbody>
            {products.map((product) => <tr key={product.id}><td><div className="table-product"><img src={product.image} alt="" /><strong>{product.name}</strong></div></td><td>{product.category}</td><td>{product.stock}</td><td><Pill tone={product.stock < product.minimumStock ? 'orange' : 'green'}>{product.stock < product.minimumStock ? 'Low stock' : 'In stock'}</Pill></td><td><div className="stock-edit"><button className="icon-button" disabled={product.stock === 0} onClick={() => onAdjustStock(product, -1)}><Minus size={14} /></button><button className="icon-button" onClick={() => onAdjustStock(product, 1)}><Plus size={14} /></button></div></td></tr>)}
          </tbody></table></div>
        </section>
      </div>
    </>
  );
}

function OrdersPage({ orders, openOrder }) {
  const [filter, setFilter] = useState('All');
  const states = ['All', 'Waiting for Payment', 'Confirmed', 'Preparing', 'Ready', 'Completed', 'Cancelled'];
  const filtered = orders.filter((order) => filter === 'All' || order.status === filter);
  return (
    <>
      <StaffHeading eyebrow="BOOTH" title="Order management" />
      <div className="staff-page-content">
        <div className="order-filters">{states.map((state) => <button className={`category-pill${filter === state ? ' selected' : ''}`} onClick={() => setFilter(state)} key={state}>{state}</button>)}</div>
        <section className="panel table-panel"><div className="table-scroll"><table><thead><tr><th>Order</th><th>Customer</th><th>Items</th><th>Payment</th><th>Total</th><th>Status</th><th /></tr></thead><tbody>
          {filtered.map((order) => <tr key={order.id}><td><strong>{order.id}</strong><small className="cell-subtitle">{order.time}</small></td><td>{order.customer}</td><td>{order.items}</td><td><Pill tone="blue">{order.payment}</Pill></td><td><strong>{money(order.total)}</strong></td><td><Pill tone={statusTone(order.status)}>{order.status}</Pill></td><td><button className="icon-button" aria-label="View order" onClick={() => openOrder(order)}><Eye size={15} /></button></td></tr>)}
          {filtered.length === 0 && <tr><td colSpan="7" className="empty-table">No orders in this status.</td></tr>}
        </tbody></table></div></section>
      </div>
    </>
  );
}

function CashierManagement({ openModal, cashiers }) {
  return (
    <>
      <StaffHeading eyebrow="BOOTH" title="Cashier management" action={<button className="button button-red button-small" onClick={() => openModal('cashier')}><Plus size={14} /> Add cashier</button>} />
      <div className="staff-page-content"><section className="panel table-panel"><div className="table-scroll"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th /></tr></thead><tbody>
        {cashiers.map((cashier) => <tr key={cashier.email}><td><strong>{cashier.name}</strong></td><td>{cashier.email}</td><td><Pill tone="blue">{cashier.role || 'Cashier'}</Pill></td><td><Pill tone="green">Active</Pill></td><td><button className="icon-button" onClick={() => openModal('cashier', cashier)}><Pencil size={14} /></button></td></tr>)}
      </tbody></table></div></section></div>
    </>
  );
}

function ReportsPage({ orders }) {
  const paidOrders = orders.filter((order) => order.paymentStatus === 'Lunas');
  const revenue = orderRevenue(paidOrders);
  const itemsSold = paidOrders.reduce((sum, order) => sum + order.lines.reduce((itemSum, item) => itemSum + item.quantity, 0), 0);
  return (
    <>
      <StaffHeading eyebrow="BAZAAR OVERVIEW" title="Sales reports" action={<button className="button button-outline button-small" onClick={() => window.print()}><Download size={14} /> Export report</button>} />
      <div className="staff-page-content">
        <div className="report-filters"><label>From <input type="date" defaultValue="2026-11-17" /></label><label>To <input type="date" defaultValue="2026-11-23" /></label><button className="button button-blue button-small">Apply</button></div>
        <div className="stats-grid"><StatCard icon={CircleDollarSign} label="TOTAL REVENUE" value={money(revenue)} /><StatCard icon={Receipt} label="TRANSACTIONS" value={paidOrders.length} color="blue" /><StatCard icon={ShoppingCart} label="ITEMS SOLD" value={itemsSold} color="yellow" /><StatCard icon={Activity} label="AVERAGE ORDER" value={money(paidOrders.length ? revenue / paidOrders.length : 0)} color="green" /></div>
        <section className="panel report-chart"><h2>Revenue by day</h2><div className="bar-chart tall-chart">{[30, 45, 28, 66, 50, 74, 90].map((height, index) => <div className="bar-column" key={index}><span style={{ height: `${height}%` }} /><small>{['17 Nov', '18 Nov', '19 Nov', '20 Nov', '21 Nov', '22 Nov', '23 Nov'][index]}</small></div>)}</div></section>
      </div>
    </>
  );
}

function SettingsPage() {
  const [saved, setSaved] = useState(false);
  return (
    <>
      <StaffHeading eyebrow="BOOTH" title="Settings" />
      <div className="staff-page-content settings-layout">
        <form className="panel settings-form" onSubmit={(event) => { event.preventDefault(); setSaved(true); }}>
          <label>Store name<input defaultValue="TROPOSICAL" /></label>
          <label>Tagline<input defaultValue="Summer Taste, Paradise Memories." /></label>
          <label className="full-field">Booth location<input defaultValue="Summer Bazaar — Main Courtyard" /></label>
          <label className="full-field">Receipt footer message<input defaultValue="Thank you! See you by the shore." /></label>
          <label>Low-stock warning at<input type="number" defaultValue="10" /></label>
          <label className="switch-row"><input type="checkbox" defaultChecked /> Accept QR customer orders</label>
          <button className="button button-red button-small" type="submit">Save settings</button>
          {saved && <span className="saved-message"><Check size={14} /> Settings saved in this preview.</span>}
        </form>
        <section className="panel qr-poster"><h2>Customer menu QR</h2><p>Print and place on tables. Customers can scan to order — no app or account needed.</p><Logo /><div className="qr-placeholder"><QrCode size={104} strokeWidth={1.4} /></div><strong>Scan to order!</strong><span>Summer Taste, Paradise Memories.</span><button className="button button-outline button-small" onClick={() => window.print()}><Printer size={14} /> Print QR poster</button></section>
      </div>
    </>
  );
}

function OrderModal({ order, close, onReceipt, updateOrder, qrisImage }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const cancelOrder = async () => {
    setError('');
    setSaving(true);
    try {
      await updateOrder(order.transactionId, { paymentStatus: 'Dibatalkan' });
      close();
    } catch (updateError) {
      setError(updateError.message || 'Order could not be cancelled.');
    } finally {
      setSaving(false);
    }
  };
  const stages = [
    ['Baru', 'Diproses', 'Preparing'],
    ['Diproses', 'Siap', 'Ready'],
    ['Siap', 'Selesai', 'Completed'],
  ];
  const nextStage = stages.find(([current]) => current === order.orderStage);
  const nextLabel = nextStage?.[2];
  const confirm = async () => {
    setError('');
    setSaving(true);
    try {
      if (order.paymentStatus === 'Menunggu') {
        await updateOrder(order.transactionId, { paymentStatus: 'Lunas' });
      } else if (nextStage) {
        await updateOrder(order.transactionId, { orderStatus: nextStage[1] });
      }
    } catch (updateError) {
      setError(updateError.message || 'Order could not be updated.');
    } finally {
      setSaving(false);
    }
  };
  const stageHistory = ['Confirmed', ...stages.map(([, , label]) => label)];
  const currentStageIndex = ['Baru', 'Diproses', 'Siap', 'Selesai'].indexOf(order.orderStage);
  const history = order.paymentStatus === 'Lunas'
    ? ['Payment confirmed', ...stageHistory.slice(0, currentStageIndex + 1)]
    : ['Waiting for Payment'];
  const createdDate = order.createdAt ? new Date(order.createdAt) : null;
  const createdLabel = createdDate && !Number.isNaN(createdDate.getTime())
    ? `${createdDate.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}, ${createdDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}`
    : order.time;
  return (
    <div className="overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
      <section className="modal order-modal">
        <button className="icon-button modal-close" aria-label="Close order" onClick={close}><X size={17} /></button>
        <h2 className="order-id">{order.id}</h2>
        <p className="order-modal-meta">{order.customer === 'Walk-in' ? 'Walk-in guest' : order.customer} · {createdLabel}</p>
        <div className="modal-status">
          <Pill>{order.customer === 'Walk-in' ? 'Walk-in' : 'Customer'}</Pill>
          <Pill tone={order.payment === 'QRIS' ? 'blue' : 'neutral'}>{order.payment === 'QRIS' ? 'QRIS' : order.payment}</Pill>
          {order.paymentStatus === 'Lunas' && <Pill tone="green">Paid</Pill>}
          <Pill tone={statusTone(order.status)}>{order.status}</Pill>
        </div>
        <div className="order-item-summary">
          {(order.lines || []).map((line) => (
            <div className="order-item-line" key={line.id || line.name}>
              <span><b>{line.quantity}x</b> {line.name} @ {money(line.unitPrice)}</span>
              <strong>{money(line.total)}</strong>
            </div>
          ))}
        </div>
        <div className="checkout-total"><span>Total</span><strong>{money(order.total)}</strong></div>
        {order.payment === 'QRIS' && order.paymentStatus === 'Menunggu' && (
          <div className="qris-payment qris-staff">
            <p>Customer should show payment proof before you confirm.</p>
            <img src={qrisImage} alt="TROPOSICAL QRIS payment code" />
          </div>
        )}
        {error && <p className="inline-error" role="alert">{error}</p>}
        <button
          className="button button-red modal-primary"
          onClick={confirm}
          disabled={saving || order.status === 'Completed' || order.status === 'Cancelled'}
        >
          {saving ? 'Saving…' : order.paymentStatus === 'Menunggu' ? 'Confirm payment' : nextLabel ? `Mark as ${nextLabel}` : 'Order complete'}
        </button>
        <div className="order-modal-actions">
          <button className="button button-outline button-small" onClick={onReceipt}><Receipt size={14} /> Receipt</button>
          <button className="button button-outline button-small cancel-order" onClick={cancelOrder} disabled={saving}><X size={14} /> Cancel order</button>
        </div>
        <div className="status-history">
          <strong>STATUS HISTORY</strong>
          {order.paymentStatus === 'Menunggu' ? (
            <span className="status-history-active"><i /> Waiting for Payment · {createdLabel}</span>
          ) : (
            <>
              {history.map((state, index) => (
                <span className={index === history.length - 1 ? 'status-history-active' : ''} key={`${state}-${index}`}>
                  <i />{state}{index === 0 ? ` · ${createdLabel}` : ''}
                  {index === 0 && order.payment === 'QRIS' && <small>QRIS payment verified by SIMULATED gateway (prototype)</small>}
                </span>
              ))}
            </>
          )}
        </div>
      </section>
    </div>
  );
}

function EditModal({ type, item, close, onSave, categoryOptions }) {
  const [name, setName] = useState(item?.name || item?.title || '');
  const [description, setDescription] = useState(item?.description || '');
  const [category, setCategory] = useState(item?.category && categoryOptions.includes(item.category) ? item.category : 'Makanan Tradisional');
  const [price, setPrice] = useState(item?.price || '');
  const [stock, setStock] = useState(item?.stock || '');
  const [email, setEmail] = useState(item?.email || '');
  const [imageUrl, setImageUrl] = useState(item?.imageUrl || '');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [available, setAvailable] = useState(item?.available ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const title = type === 'product' ? item ? 'Edit product' : 'New product' : type === 'category' ? item ? 'Edit category' : 'New category' : item ? 'Edit cashier' : 'New cashier';

  useEffect(() => () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
  }, [imagePreview]);

  const selectImage = (event) => {
    const file = event.target.files?.[0] || null;
    setImageFile(file);
    setImagePreview(file ? URL.createObjectURL(file) : '');
  };

  return (
    <div className="overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
      <form className="modal edit-modal" onSubmit={async (event) => {
        event.preventDefault();
        setError('');
        setSaving(true);
        try {
          await onSave({ ...item, name, description, category, price: Number(price), stock: Number(stock), email, imageUrl, imageFile, available });
        } catch (saveError) {
          setError(saveError.message || 'Changes could not be saved.');
        } finally {
          setSaving(false);
        }
      }}>
        <button type="button" className="icon-button modal-close" aria-label="Close" onClick={close}><X size={17} /></button>
        <h2>{title}</h2>
        {type === 'product' && <div className="upload-row"><img src={imagePreview || item?.image || '/assets/gethuk.jpeg'} alt="" /><span>Select a JPEG, JPG, or PNG image (optional).</span></div>}
        <label>{type === 'cashier' ? 'Name' : type === 'category' ? 'Category name' : 'Name'}<input value={name} onChange={(event) => setName(event.target.value)} required /></label>
        {type === 'product' && <>
          <label>Product image<input type="file" accept=".jpeg,.jpg,.png,image/jpeg,image/png" onChange={selectImage} /></label>
          <label>Description<textarea value={description} onChange={(event) => setDescription(event.target.value)} rows="3" /></label>
          <div className="form-row"><label>Category<select value={category} onChange={(event) => setCategory(event.target.value)}>{categoryOptions.map((value) => <option key={value}>{value}</option>)}</select></label><label>Price (Rp)<input type="number" min="0" value={price} onChange={(event) => setPrice(event.target.value)} required /></label><label>Stock<input type="number" min="0" value={stock} onChange={(event) => setStock(event.target.value)} required /></label></div>
          <label className="switch-row"><input type="checkbox" checked={available} onChange={(event) => setAvailable(event.target.checked)} /> Available on the menu</label>
        </>}
        {type === 'cashier' && <label>Email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>}
        {error && <p className="inline-error" role="alert">{error}</p>}
        <div className="modal-actions"><button className="button button-outline button-small" type="button" onClick={close}>Cancel</button><button className="button button-red button-small" type="submit" disabled={saving}>{saving ? 'Saving…' : `Save ${type}`}</button></div>
      </form>
    </div>
  );
}

function StaffApp({
  role,
  onLogout,
  onMenu,
  onOpenCashier,
  onBackToAdmin,
  products,
  orders,
  cart,
  addToCart,
  changeQuantity,
  clearCart,
  cashiers,
  setCashiers,
  customCategories,
  setCustomCategories,
  qrisImage,
  loadError,
  onCreateOrder,
  onRefreshProducts,
  onRefreshOrders,
  onUpdateOrder,
  staffName,
  staffEmail,
  onSaveProduct,
  onSetProductStock,
  onDeleteProduct,
  onRenameCategory,
}) {
  const [page, setPage] = useState(role === 'admin' ? 'Dashboard' : 'Dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [modal, setModal] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [receiptOrder, setReceiptOrder] = useState(null);
  const [actionError, setActionError] = useState('');
  const cashier = role === 'cashier';
  const categoryOptions = categories.slice(1);

  useEffect(() => {
    const handleNav = (event) => setPage(event.detail);
    window.addEventListener('staff-nav', handleNav);
    return () => window.removeEventListener('staff-nav', handleNav);
  }, []);

  useEffect(() => {
    setPage('Dashboard');
  }, [role]);

  useEffect(() => {
    if (!['Incoming Orders', 'Payment Verification', 'All Orders', 'Order Management', 'Transaction History'].includes(page)) return undefined;
    const refresh = () => {
      onRefreshOrders().catch((error) => {
        setActionError(`Transactions could not be refreshed: ${error.message}`);
      });
    };
    refresh();
    window.addEventListener('focus', refresh);
    const interval = window.setInterval(refresh, 20000);
    return () => {
      window.removeEventListener('focus', refresh);
      window.clearInterval(interval);
    };
  }, [page, onRefreshOrders]);

  const updateOrder = async (id, changes) => {
    const updatedOrders = await onUpdateOrder(id, changes);
    if (selectedOrder?.transactionId === id) {
      setSelectedOrder(updatedOrders.find((order) => order.transactionId === id) || null);
    }
    return updatedOrders;
  };

  const refreshProductsSafely = async () => {
    try {
      await onRefreshProducts(true);
    } catch (error) {
      setActionError(`Saved, but products could not be refreshed: ${error.message}`);
    }
  };
  const refreshOrdersSafely = async () => {
    try {
      await onRefreshOrders();
    } catch (error) {
      setActionError(`Saved, but transactions could not be refreshed: ${error.message}`);
    }
  };
  const saveItem = async (data) => {
    if (modal.type === 'product') {
      await onSaveProduct({ ...data, id: modal.item?.id });
      setModal(null);
      await refreshProductsSafely();
    } else if (modal.type === 'category') {
      if (modal.item?.name) {
        await onRenameCategory(modal.item.name, data.name);
        setModal(null);
        await refreshProductsSafely();
        setCustomCategories((old) => old.map((name) => name === modal.item.name ? data.name : name));
      } else {
        setCustomCategories((old) => old.includes(data.name) ? old : [...old, data.name]);
        setModal(null);
      }
    } else if (modal.type === 'cashier') {
      if (modal.item?.email) setCashiers((old) => old.map((cashier) => cashier.email === modal.item.email ? { ...cashier, ...data } : cashier));
      else setCashiers((old) => [...old, { ...data, role: 'Cashier' }]);
      setModal(null);
    }
  };
  const toggleProduct = async (product) => {
    setActionError('');
    try {
      await onSaveProduct({ ...product, available: !product.available });
      await refreshProductsSafely();
    } catch (error) {
      setActionError(error.message || 'Product availability could not be updated.');
    }
  };
  const removeProduct = async (product) => {
    if (!window.confirm(`Delete ${product.name}?`)) return;
    setActionError('');
    try {
      await onDeleteProduct(product.id);
      await refreshProductsSafely();
    } catch (error) {
      setActionError(error.message || 'Product could not be deleted.');
    }
  };
  const adjustStock = async (product, amount) => {
    setActionError('');
    try {
      await onSetProductStock(product.id, Math.max(0, product.stock + amount));
      await refreshProductsSafely();
    } catch (error) {
      setActionError(error.message || 'Stock could not be updated.');
    }
  };

  let content;
  if (page === 'Dashboard' && !cashier) content = <DashboardPage orders={orders} products={products} />;
  else if (page === 'Dashboard' && cashier) content = <CashierDashboard orders={orders} setPage={setPage} />;
  else if (page === 'Product Management') content = <ProductManagement products={products} categoryOptions={categoryOptions} openModal={(type, item) => setModal({ type, item })} onToggleProduct={toggleProduct} onDeleteProduct={removeProduct} />;
  else if (page === 'Categories') content = <CategoriesPage products={products} customCategories={customCategories} openModal={(type, item) => setModal({ type, item })} />;
  else if (page === 'Inventory & Stock') content = <InventoryPage products={products} onAdjustStock={adjustStock} />;
  else if (cashier && page === 'All Orders') content = <CashierOrdersPage key={page} orders={orders} openOrder={setSelectedOrder} />;
  else if (cashier && page === 'Payment Verification') content = <PaymentVerificationPage orders={orders} onUpdateOrder={updateOrder} />;
  else if (cashier && page === 'Transaction History') content = <CashierOrdersPage key={page} orders={orders} openOrder={setSelectedOrder} view="history" />;
  else if (page === 'Order Management' || page === 'All Orders' || page === 'Transaction History') content = <OrdersPage orders={orders} openOrder={setSelectedOrder} />;
  else if (page === 'Cashier Management') content = <CashierManagement cashiers={cashiers} openModal={(type, item) => setModal({ type, item })} />;
  else if (page === 'Sales Reports') content = <ReportsPage orders={orders} />;
  else if (page === 'Settings') content = <SettingsPage />;
  else if (page === 'New Transaction' || page === 'Open cashier POS') content = <PosPage products={products} cart={cart} addToCart={addToCart} changeQuantity={changeQuantity} openOrder={setSelectedOrder} clearCart={clearCart} onCreateOrder={async (payload) => {
    const order = await onCreateOrder(payload);
    await refreshProductsSafely();
    await refreshOrdersSafely();
    return order;
  }} />;
  else if (page === 'Incoming Orders') content = <IncomingOrdersPage orders={orders} openOrder={setSelectedOrder} onUpdateOrder={updateOrder} />;
  else content = <DashboardPage orders={orders} products={products} />;

  return (
    <main className="staff-app">
      {createPortal(
        <button className="mobile-menu-toggle" aria-label="Open navigation" onClick={() => setSidebarOpen(true)}><Menu size={21} /></button>,
        document.body,
      )}
      <Sidebar role={role} page={page} setPage={setPage} onLogout={onLogout} open={sidebarOpen} onToggle={(open) => setSidebarOpen(open)} staffName={staffName} staffEmail={staffEmail} onOpenCashier={onOpenCashier} />
      <section className="staff-main">
        {cashier && <button className="staff-admin-back" onClick={onBackToAdmin}><ArrowRight size={16} /> Back to admin</button>}
        {(loadError || actionError) && <p className="inline-error staff-error" role="alert">{actionError || loadError}</p>}
        {content}
      </section>
      {selectedOrder && <OrderModal order={selectedOrder} close={() => setSelectedOrder(null)} onReceipt={() => { setReceiptOrder(selectedOrder); setSelectedOrder(null); }} updateOrder={updateOrder} qrisImage={qrisImage} />}
      {receiptOrder && <ReceiptPreview order={receiptOrder} onBack={() => { setSelectedOrder(receiptOrder); setReceiptOrder(null); }} />}
      {modal && <EditModal type={modal.type} item={modal.item} close={() => setModal(null)} onSave={saveItem} categoryOptions={categoryOptions} />}
      <button className="staff-menu-shortcut" onClick={onMenu}><Utensils size={14} /> Customer menu</button>
    </main>
  );
}

async function getStaffProfile(user) {
  const { data, error } = await supabase
    .from('admin')
    .select('nama,role')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('This account is not linked to a staff record.');

  const value = String(data.role || '').trim().toLowerCase();
  let role;
  if (value.includes('admin')) role = 'admin';
  else if (value.includes('cashier') || value.includes('kasir')) role = 'cashier';
  else throw new Error('This account does not have an admin or cashier role.');

  const email = String(user.email || '').trim();
  const profileName = [data.nama, user.user_metadata?.full_name, user.user_metadata?.name]
    .map((candidate) => String(candidate || '').trim())
    .find((candidate) => candidate && !candidate.includes('@'));
  const emailName = email.split('@')[0]
    .replace(/[._-]+/g, ' ')
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
  const name = profileName || emailName || (role === 'admin' ? 'Admin' : 'Cashier');
  return { role, name, email };
}

export default function App() {
  const [mode, setMode] = useState('customer');
  const [role, setRole] = useState('cashier');
  const [staffIdentity, setStaffIdentity] = useState({ name: '', email: '' });
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [customCategories, setCustomCategories] = useState([]);
  const [cashiers, setCashiers] = useState([]);
  const [cart, setCart] = useState([]);
  const [storeSettings, setStoreSettings] = useState({
    isOpen: true,
    isConfigured: false,
    qrisImageUrl: '/assets/qris-pembayaran.jpeg',
  });
  const [authLoading, setAuthLoading] = useState(true);
  const [productsLoading, setProductsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const refreshProducts = useCallback(async (includeInactive = false) => {
    if (!supabase) throw new Error('Supabase is not configured. Check the VITE_SUPABASE_* values in .env.');
    try {
      const result = await fetchProducts(supabase, { includeInactive });
      setProducts(result);
      setLoadError('');
      return result;
    } catch (error) {
      setLoadError(error.message || 'Products could not be loaded.');
      throw error;
    }
  }, []);

  const refreshOrders = useCallback(async () => {
    if (!supabase) throw new Error('Supabase is not configured. Check the VITE_SUPABASE_* values in .env.');
    try {
      const result = await fetchTransactions(supabase);
      setOrders(result);
      setLoadError('');
      return result;
    } catch (error) {
      setLoadError(error.message || 'Transactions could not be loaded.');
      throw error;
    }
  }, []);

  useEffect(() => {
    let active = true;
    const initialize = async () => {
      if (!supabase) {
        setLoadError('Supabase is not configured. Check the VITE_SUPABASE_* values in .env.');
        setAuthLoading(false);
        setProductsLoading(false);
        return;
      }

      let staffProfile = null;
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (data.session) {
          staffProfile = await getStaffProfile(data.session.user);
          if (active) {
            setRole(staffProfile.role);
            setStaffIdentity({ name: staffProfile.name, email: staffProfile.email });
            setMode(staffProfile.role);
          }
        }
      } catch (error) {
        const { error: signOutError } = await supabase.auth.signOut();
        if (signOutError && active) setLoadError(signOutError.message);
        if (active) setLoadError(error.message || 'Staff session could not be restored.');
      }

      try {
        const result = await fetchProducts(supabase, { includeInactive: Boolean(staffProfile) });
        if (active) setProducts(result);
      } catch (error) {
        if (active) setLoadError(error.message || 'Products could not be loaded.');
      } finally {
        if (active) setProductsLoading(false);
      }

      try {
        const settings = await fetchStoreSettings(supabase);
        if (active) setStoreSettings(settings);
      } catch (error) {
        if (active) setLoadError(error.message || 'Store settings could not be loaded.');
      }

      if (staffProfile) {
        try {
          const result = await fetchTransactions(supabase);
          if (active) setOrders(result);
        } catch (error) {
          if (active) setLoadError(error.message || 'Transactions could not be loaded.');
        }
      }
      if (active) setAuthLoading(false);
    };

    initialize();
    return () => { active = false; };
  }, []);

  const login = async ({ email, password, expectedRole }) => {
    if (!supabase) throw new Error('Supabase is not configured. Check the VITE_SUPABASE_* values in .env.');
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;

    let staffProfile;
    try {
      staffProfile = await getStaffProfile(data.user);
      if (staffProfile.role !== expectedRole) {
        const selectedRole = expectedRole === 'admin' ? 'Admin' : 'Cashier';
        const actualRole = staffProfile.role === 'admin' ? 'Admin' : 'Cashier';
        throw new Error(`${selectedRole} sign in does not match this account. This account is registered as ${actualRole}; use ${actualRole} sign in.`);
      }
    } catch (roleError) {
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) throw new Error(`${roleError.message} Sign out failed: ${signOutError.message}`);
      throw roleError;
    }

    setRole(staffProfile.role);
    setStaffIdentity({ name: staffProfile.name, email: staffProfile.email });
    setMode(staffProfile.role);
    setLoadError('');
    try {
      const [loadedProducts, loadedOrders] = await Promise.all([
        refreshProducts(true),
        refreshOrders(),
      ]);
      setProducts(loadedProducts);
      setOrders(loadedOrders);
    } catch (error) {
      setLoadError(error.message || 'Staff data could not be loaded.');
    }
  };

  const logout = async () => {
    if (supabase) {
      const { error } = await supabase.auth.signOut();
      if (error) setLoadError(error.message);
    }
    setOrders([]);
    setStaffIdentity({ name: '', email: '' });
    setMode('login');
  };

  const openCashier = () => {
    if (role !== 'admin') {
      window.alert('kamu bukan admin');
      return;
    }
    setMode('cashier');
  };
  const backToAdmin = () => {
    if (role !== 'admin') {
      window.alert('kamu bukan admin');
      return;
    }
    setMode('admin');
  };

  const submitOrder = async (payload) => {
    if (!supabase) throw new Error('Supabase is not configured.');
    const order = await createOrder(supabase, payload);
    setOrders((old) => [order, ...old.filter((current) => current.transactionId !== order.transactionId)]);
    if (payload.channel === 'customer') {
      try {
        await refreshProducts(false);
      } catch (error) {
        setLoadError(`Order saved, but the menu could not be refreshed: ${error.message}`);
      }
    }
    return order;
  };

  const sendOrderReceipt = async (order, email) => {
    if (!supabase) throw new Error('Supabase is not configured.');
    const { data, error } = await supabase.functions.invoke('send-receipt', {
      body: { transactionId: order.transactionId, email },
    });
    if (error) throw new Error(error.message || 'Email delivery failed.');
    if (data?.sent !== true) throw new Error('The email service did not confirm delivery.');
  };

  const changeOrderState = async (transactionId, changes) => {
    if (!supabase) throw new Error('Supabase is not configured.');
    await updateOrderState(supabase, transactionId, changes);
    const updatedOrders = orders.map((order) => order.transactionId === transactionId
      ? applyOrderChanges(order, changes)
      : order);
    setOrders(updatedOrders);
    try {
      return await refreshOrders();
    } catch (error) {
      setLoadError(`Order updated, but the latest transaction list could not be loaded: ${error.message}`);
      return updatedOrders;
    }
  };

  const persistProduct = async (product) => {
    if (!supabase) throw new Error('Supabase is not configured.');
    await saveProduct(supabase, product);
  };

  const adjustProductStock = async (productId, stock) => {
    if (!supabase) throw new Error('Supabase is not configured.');
    await setProductStock(supabase, productId, stock);
  };

  const removeProduct = async (productId) => {
    if (!supabase) throw new Error('Supabase is not configured.');
    await deleteProduct(supabase, productId);
  };

  const changeCategoryName = async (previousName, nextName) => {
    if (!supabase) throw new Error('Supabase is not configured.');
    await renameProductCategory(supabase, previousName, nextName);
  };

  const addToCart = (product) => setCart((old) => {
    if (!product.available || product.stock < 1) return old;
    const existing = old.find((item) => item.product.id === product.id);
    if (existing) return old.map((item) => item.product.id === product.id ? { ...item, quantity: Math.min(product.stock, item.quantity + 1) } : item);
    return [...old, { product, quantity: 1 }];
  });
  const changeQuantity = (product, amount) => setCart((old) => old.map((item) => {
    if (item.product.id !== product.id) return item;
    const quantity = item.quantity + amount;
    return { ...item, quantity: amount > 0 ? Math.min(product.stock, quantity) : quantity };
  }).filter((item) => item.quantity > 0));
  const clearCart = () => setCart([]);

  if (authLoading) return <main className="customer-site app-loading">Connecting to TROPOSICAL…</main>;
  if (mode === 'login') return <LoginPage role={role} setRole={setRole} onLogin={login} onMenu={() => setMode('customer')} />;
  if (mode === 'admin' || mode === 'cashier') {
    return (
      <StaffApp
        role={mode}
        staffName={staffIdentity.name}
        staffEmail={staffIdentity.email}
        onLogout={logout}
        onMenu={() => setMode('customer')}
        onOpenCashier={openCashier}
        onBackToAdmin={backToAdmin}
        products={products}
        orders={orders}
        cart={cart}
        addToCart={addToCart}
        changeQuantity={changeQuantity}
        clearCart={clearCart}
        cashiers={cashiers}
        setCashiers={setCashiers}
        customCategories={customCategories}
        setCustomCategories={setCustomCategories}
        qrisImage={storeSettings.qrisImageUrl}
        loadError={loadError}
        onCreateOrder={submitOrder}
        onRefreshProducts={refreshProducts}
        onRefreshOrders={refreshOrders}
        onUpdateOrder={changeOrderState}
        onSaveProduct={persistProduct}
        onSetProductStock={adjustProductStock}
        onDeleteProduct={removeProduct}
        onRenameCategory={changeCategoryName}
      />
    );
  }
  return (
    <CustomerSite
      products={products}
      cart={cart}
      addToCart={addToCart}
      changeQuantity={changeQuantity}
      clearCart={clearCart}
      onStaff={() => setMode('login')}
      onCreateOrder={submitOrder}
      onSendReceipt={sendOrderReceipt}
      loading={productsLoading}
      loadError={loadError}
      storeOpen={storeSettings.isOpen}
      storeSettingsConfigured={storeSettings.isConfigured}
      qrisImage={storeSettings.qrisImageUrl}
    />
  );
}
