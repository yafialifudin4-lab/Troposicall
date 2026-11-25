import React, { useState } from 'react';
import {
  ArrowRight,
  Banknote,
  CircleCheck,
  CircleDollarSign,
  Clock3,
  ClipboardList,
  Minus,
  Plus,
  QrCode,
  Search,
  ShoppingCart,
  Trash2,
} from 'lucide-react';

export const categories = ['All', 'Makanan', 'Minuman', 'Makanan Tradisional', 'Bundling'];
export const cashierCategories = [
  { value: 'All', label: 'All' },
  { value: 'Makanan Tradisional', label: 'Traditional Food' },
  { value: 'Makanan', label: 'Food' },
  { value: 'Minuman', label: 'Drinks' },
  { value: 'Bundling', label: 'Bundling' },
];

export const money = (amount) => `Rp${Number(amount || 0).toLocaleString('id-ID')}`;

export const dateKey = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

export const orderRevenue = (list) => list.reduce((sum, order) => sum + (order.paymentStatus === 'Lunas' ? order.total : 0), 0);

export function statusTone(status) {
  if (status === 'Completed' || status === 'Ready') return 'green';
  if (status === 'Preparing') return 'yellow';
  if (status === 'Waiting for Payment') return 'orange';
  if (status === 'Cancelled') return 'red';
  return 'blue';
}

export function Pill({ children, tone = 'neutral' }) {
  return <span className={`pill pill-${tone}`}>{children}</span>;
}

export function CartItems({ cart, onChange, onRemove }) {
  return (
    <div className="cart-items">
      {cart.map(({ product, quantity }) => (
        <div className="cart-line" key={product.id}>
          <img src={product.image} alt="" />
          <div className="cart-line-copy">
            <strong>{product.name}</strong>
            <span>{money(product.price)} each</span>
            <div className="quantity-control">
              <button aria-label={`Remove one ${product.name}`} onClick={() => onChange(product, -1)}><Minus size={15} /></button>
              <span>{quantity}</span>
              <button aria-label={`Add one ${product.name}`} onClick={() => onChange(product, 1)}><Plus size={15} /></button>
            </div>
          </div>
          <strong className="cart-line-total">{money(product.price * quantity)}</strong>
          {onRemove && <button className="icon-button remove-line" aria-label={`Remove ${product.name}`} onClick={() => onRemove(product)}><Trash2 size={15} /></button>}
        </div>
      ))}
    </div>
  );
}

export function StaffHeading({ eyebrow, title, action }) {
  return (
    <header className="staff-heading">
      <div className="heading-stripes" />
      <div className="staff-heading-content">
        <div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1></div>
        {action}
      </div>
    </header>
  );
}

export function StatCard({ icon: Icon, label, value, note, color = 'red' }) {
  return (
    <article className={`stat-card stat-${color}`}>
      <span className="stat-icon"><Icon size={17} /></span>
      <div><small>{label}</small><strong>{value}</strong>{note && <span>{note}</span>}</div>
    </article>
  );
}

export function CashierDashboard({ orders, setPage }) {
  const latest = orders.slice(0, 4);
  const count = (status) => orders.filter((order) => order.status === status).length;
  const todayKey = dateKey(new Date());
  const todayOrders = orders.filter((order) => order.createdAt && dateKey(order.createdAt) === todayKey);
  const paidToday = todayOrders.filter((order) => order.paymentStatus === 'Lunas');
  const cashRevenue = orderRevenue(paidToday.filter((order) => order.payment === 'Cash'));
  const qrisRevenue = orderRevenue(paidToday.filter((order) => order.payment === 'QRIS'));
  const incomingCount = orders.filter((order) => ['Waiting for Payment', 'Confirmed', 'Preparing', 'Ready'].includes(order.status)).length;
  return (
    <>
      <StaffHeading eyebrow="HELLO, RAYYA" title="Today at the booth" />
      <div className="staff-page-content">
        <div className="stats-grid cashier-stats">
          <StatCard icon={ShoppingCart} label="NEW ORDERS" value={count('Confirmed')} color="blue" />
          <StatCard icon={CircleDollarSign} label="PENDING PAYMENTS" value={count('Waiting for Payment')} color="red" />
          <StatCard icon={Clock3} label="PREPARING" value={count('Preparing')} color="yellow" />
          <StatCard icon={CircleCheck} label="COMPLETED" value={count('Completed')} color="green" />
        </div>
        <div className="cashier-quick-actions">
          <section className="sales-today"><span>TODAY'S SALES</span><strong>{money(orderRevenue(paidToday))}</strong><small>{paidToday.length} successful transaction(s)</small><div><span>Cash <b>{money(cashRevenue)}</b></span><span>QRIS <b>{money(qrisRevenue)}</b></span></div></section>
          <button className="quick-action" onClick={() => setPage('New Transaction')}><Plus size={23} /><strong>New transaction</strong><span>Ring up a walk-in customer</span></button>
          <button className="quick-action" onClick={() => setPage('Incoming Orders')}><ClipboardList size={23} /><strong>Incoming orders</strong><span>{incomingCount} order(s) waiting or in preparation</span></button>
        </div>
        <section className="panel latest-orders"><h2>Latest orders <button className="text-button" onClick={() => setPage('All Orders')}>See all</button></h2>{latest.map((order) => <button className="latest-row" key={order.id} onClick={() => setPage('All Orders')}><span>{order.time}</span><strong>{order.id}</strong><span>{order.customer}</span><Pill tone="blue">{order.payment}</Pill><Pill tone={statusTone(order.status)}>{order.status}</Pill><strong>{money(order.total)}</strong></button>)}</section>
      </div>
    </>
  );
}

export function PosPage({ products, cart, addToCart, changeQuantity, openOrder, clearCart, onCreateOrder }) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [payment, setPayment] = useState('Cash');
  const [customer, setCustomer] = useState('');
  const [paid, setPaid] = useState('');
  const [cashInput, setCashInput] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const total = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const filtered = products.filter((product) => product.name.toLowerCase().includes(search.toLowerCase()) && (category === 'All' || product.category === category));
  const place = async () => {
    if (!cart.length || submitting) return;
    if (!customer.trim()) {
      setError('Customer name is required.');
      return;
    }
    if (payment === 'Cash' && Number(paid) < total) {
      setError('Received cash must cover the transaction total.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const order = await onCreateOrder({
        channel: 'pos',
        customerName: customer.trim(),
        payment,
        amountReceived: payment === 'Cash' ? Number(paid) : 0,
        items: cart,
      });
      openOrder(order);
      clearCart();
      setPaid('');
      setCashInput('');
      setCustomer('');
    } catch (createError) {
      setError(createError.message || 'Transaction could not be saved.');
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <>
      <StaffHeading eyebrow="WALK-IN CUSTOMER" title="New transaction" />
      <div className="pos-layout staff-page-content">
        <section className="pos-menu">
          <div className="pos-tools">
            <label className="search-field"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search products" /></label>
            <div className="category-pills">{cashierCategories.map((item) => <button key={item.value} className={`category-pill${category === item.value ? ' selected' : ''}`} onClick={() => setCategory(item.value)}>{item.label}</button>)}</div>
          </div>
          <div className="pos-product-grid">
            {filtered.map((product) => {
              const quantity = cart.find((item) => item.product.id === product.id)?.quantity || 0;
              const soldOut = !product.available || product.stock < 1;
              const categoryLabel = cashierCategories.find((item) => item.value === product.category)?.label || product.category;
              return (
                <button className={`pos-product${quantity ? ' selected' : ''}${soldOut ? ' sold-out' : ''}`} key={product.id} disabled={soldOut} onClick={() => addToCart(product)}>
                  <div className="pos-product-photo">
                    <img src={product.image} alt="" />
                    <span>{categoryLabel.toUpperCase()}</span>
                    {soldOut && <strong>Sold out</strong>}
                    {quantity > 0 && <b>{quantity}</b>}
                  </div>
                  <strong>{product.name}</strong>
                  <div><b>{money(product.price)}</b><small>{soldOut ? 'Sold out' : `Stock ${product.stock}`}</small></div>
                </button>
              );
            })}
          </div>
        </section>
        <aside className="pos-order panel">
          <div className="pos-order-head"><h2>Order</h2><button className="text-button" onClick={() => cart.forEach((item) => changeQuantity(item.product, -999))}><Trash2 size={13} /> Clear</button></div>
          <input
            value={customer}
            onChange={(event) => setCustomer(event.target.value)}
            placeholder="Customer name (required)"
            aria-label="Customer name"
            required
          />
          {cart.length ? <CartItems cart={cart} onChange={(product, amount) => amount > 0 ? addToCart(product) : changeQuantity(product, -1)} onRemove={(product) => changeQuantity(product, -999)} /> : <div className="empty-pos"><span>☼</span><strong>No items yet</strong><small>Tap a product to add it.</small></div>}
          <div className="pos-total"><div><span>Subtotal</span><span>{money(total)}</span></div><div className="checkout-total"><span>Total</span><strong>{money(total)}</strong></div></div>
          <div className="pos-payment-options">{['Cash', 'QRIS'].map((item) => <button key={item} className={`payment-option${payment === item ? ' selected' : ''}`} onClick={() => setPayment(item)}>{item === 'Cash' ? <Banknote size={16} /> : <QrCode size={16} />}{item}</button>)}</div>
          {payment === 'Cash' && cart.length > 0 && (
            <div className="cash-panel">
              <div className="checkout-total"><span>TOTAL TAGIHAN</span><strong>{money(total)}</strong></div>
              <div className="cash-panel-heading">
                <p>Uang diterima: <strong className="cash-received-value" aria-live="polite">{money(Number(paid) || 0)}</strong></p>
                <button type="button" onClick={() => { setPaid(''); setCashInput(''); }}>↻ Reset</button>
              </div>
              <div className="cash-chips">
                {[1000, 2000, 5000, 10000, 20000, 50000].map((amount) => (
                  <button key={amount} type="button" onClick={() => setPaid(String(Number(paid || 0) + amount))}>{money(amount)}</button>
                ))}
              </div>
              <button type="button" className="exact-cash-button" onClick={() => setPaid(String(total))}>
                Uang Pas ({money(total)})
              </button>
              <label className="cash-custom-label" htmlFor="cash-custom">Input nominal lainnya</label>
              <div className="cash-custom-row">
                <input id="cash-custom" value={cashInput} onChange={(event) => setCashInput(event.target.value)} type="number" min="0" placeholder="Masukkan nominal..." />
                <button type="button" onClick={() => {
                  if (Number(cashInput) > 0) {
                    setPaid(String(Number(paid || 0) + Number(cashInput)));
                    setCashInput('');
                  }
                }}>
                  + Tambah
                </button>
              </div>
            </div>
          )}
          {error && <p className="inline-error" role="alert">{error}</p>}
          <button className="button button-red complete-transaction" disabled={!cart.length || submitting} onClick={place}>{submitting ? 'Saving…' : `${payment === 'QRIS' ? 'Create QRIS order' : 'Complete'} · ${money(total)}`}</button>
          {payment === 'QRIS' && <small className="preview-note">A QRIS code for the exact order amount will be shown after the order is created. Confirm payment after checking the customer’s proof.</small>}
        </aside>
      </div>
    </>
  );
}

const incomingStages = [
  { status: 'Waiting for Payment', title: 'WAITING FOR PAYMENT', action: 'Verify payment' },
  { status: 'Confirmed', title: 'CONFIRMED', action: 'Preparing', next: 'Diproses' },
  { status: 'Preparing', title: 'PREPARING', action: 'Ready', next: 'Siap' },
  { status: 'Ready', title: 'READY FOR PICKUP', action: 'Completed', next: 'Selesai' },
];

function orderAge(createdAt) {
  if (!createdAt) return '';
  const timestamp = new Date(createdAt).getTime();
  if (Number.isNaN(timestamp)) return '';
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
  return minutes < 1 ? 'Just now' : `${minutes}m ago`;
}

export function IncomingOrdersPage({ orders, openOrder, onUpdateOrder }) {
  const [source, setSource] = useState('qr');
  const [updating, setUpdating] = useState('');
  const [error, setError] = useState('');
  const visibleOrders = orders.filter((order) => source === 'all' || order.channel !== 'pos');
  const advance = async (order, nextStatus) => {
    if (!nextStatus) {
      openOrder(order);
      return;
    }
    setUpdating(order.transactionId);
    setError('');
    try {
      await onUpdateOrder(order.transactionId, { orderStatus: nextStatus });
    } catch (updateError) {
      setError(updateError.message || 'Order status could not be updated.');
    } finally {
      setUpdating('');
    }
  };
  return (
    <>
      <StaffHeading
        eyebrow="LIVE"
        title="Incoming orders"
        action={
          <div className="incoming-order-actions" role="group" aria-label="Order source">
            <button className={source === 'qr' ? 'selected' : ''} onClick={() => setSource('qr')}>QR orders</button>
            <button className={source === 'all' ? 'selected' : ''} onClick={() => setSource('all')}>All orders</button>
          </div>
        }
      />
      <div className="staff-page-content">
        {error && <p className="inline-error" role="alert">{error}</p>}
        <div className="incoming-order-board">
          {incomingStages.map((stage) => {
            const stageOrders = visibleOrders.filter((order) => order.status === stage.status);
            return (
              <section className={`incoming-order-column incoming-${stage.status.toLowerCase().replaceAll(' ', '-')}`} key={stage.status}>
                <header><strong>{stage.title}</strong><span>{stageOrders.length}</span></header>
                <div className="incoming-order-cards">
                  {stageOrders.map((order) => (
                    <article className="incoming-order-card" key={order.transactionId}>
                      <button className="incoming-order-open" onClick={() => openOrder(order)} aria-label={`Open order ${order.id}`}>
                        <span className="incoming-order-card-head"><strong>{order.id}</strong><small>{order.time}</small></span>
                        <span className="incoming-order-age">{orderAge(order.createdAt)}</span>
                        <span className="incoming-order-customer">{order.customer || 'Walk-in'}</span>
                        <span className="incoming-order-lines">{(order.lines || []).map((line) => <span key={line.id || line.name}>{line.quantity}x {line.name}</span>)}</span>
                      </button>
                      <div className="incoming-order-card-footer">
                        <Pill tone={order.payment === 'QRIS' ? 'blue' : 'neutral'}>{order.payment}</Pill>
                        <Pill tone={order.paymentStatus === 'Lunas' ? 'green' : 'orange'}>{order.paymentStatus === 'Lunas' ? 'Paid' : 'Unpaid'}</Pill>
                        <strong>{money(order.total)}</strong>
                      </div>
                      <button className="incoming-order-action" disabled={updating === order.transactionId} onClick={() => advance(order, stage.next)}>
                        <ArrowRight size={13} /> {updating === order.transactionId ? 'Saving…' : stage.action}
                      </button>
                    </article>
                  ))}
                  {stageOrders.length === 0 && <div className="incoming-order-empty">—</div>}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </>
  );
}

const cashierStatuses = ['All statuses', 'Unpaid', 'Waiting for Payment', 'Confirmed', 'Preparing', 'Ready', 'Completed', 'Cancelled'];

export function CashierOrdersPage({ orders, openOrder, view = 'all' }) {
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [payment, setPayment] = useState('All payments');
  const [source, setSource] = useState('All sources');
  const [status, setStatus] = useState('All statuses');
  const title = view === 'history' ? 'Transaction history' : 'All orders';
  const filtered = orders.filter((order) => {
    const query = search.trim().toLowerCase();
    const orderDate = order.createdAt ? dateKey(order.createdAt) : '';
    const matchesSearch = !query || [order.id, order.customer, order.items].some((value) => String(value || '').toLowerCase().includes(query));
    const matchesDate = (!fromDate || orderDate >= fromDate) && (!toDate || orderDate <= toDate);
    const matchesPayment = payment === 'All payments' || order.payment === payment;
    const matchesSource = source === 'All sources' || (source === 'Walk-in' ? order.channel === 'pos' : order.channel !== 'pos');
    const matchesStatus = status === 'All statuses'
      || (status === 'Unpaid' ? order.paymentStatus === 'Menunggu' : order.status === status);
    return matchesSearch && matchesDate && matchesPayment && matchesSource && matchesStatus;
  });
  return (
    <>
      <StaffHeading eyebrow="CASHIER" title={title} />
      <div className="staff-page-content cashier-orders-page">
        <div className="cashier-order-tools">
          <label className="search-field"><Search size={14} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Order no. or customer" /></label>
          <input type="date" aria-label="From date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
          <input type="date" aria-label="To date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
          <select aria-label="Payment filter" value={payment} onChange={(event) => setPayment(event.target.value)}><option>All payments</option><option>Cash</option><option>QRIS</option></select>
          <select aria-label="Source filter" value={source} onChange={(event) => setSource(event.target.value)}><option>All sources</option><option>QR orders</option><option>Walk-in</option></select>
        </div>
        <div className="order-filters cashier-status-filters" role="group" aria-label="Order status">
          {cashierStatuses.map((item) => <button className={`category-pill${status === item ? ' selected' : ''}`} onClick={() => setStatus(item)} key={item}>{item}</button>)}
        </div>
        <section className="panel table-panel cashier-orders-panel">
          <div className="table-scroll">
            <table>
              <thead><tr><th>Order</th><th>Customer</th><th>Time</th><th>Source</th><th>Payment</th><th>Status</th><th>Total</th></tr></thead>
              <tbody>
                {filtered.map((order) => (
                  <tr key={order.transactionId}>
                    <td><button className="cashier-order-link" onClick={() => openOrder(order)}>{order.id}</button></td>
                    <td>{order.customer || '—'}</td>
                    <td>{order.time}</td>
                    <td><Pill tone={order.channel === 'pos' ? 'orange' : 'blue'}>{order.channel === 'pos' ? 'Walk-in' : 'QR order'}</Pill></td>
                    <td><Pill tone={order.payment === 'QRIS' ? 'blue' : 'neutral'}>{order.payment}</Pill></td>
                    <td><Pill tone={statusTone(order.status)}>{order.status}</Pill></td>
                    <td><strong>{money(order.total)}</strong></td>
                  </tr>
                ))}
                {filtered.length === 0 && <tr><td colSpan="7" className="empty-table">No transactions found.</td></tr>}
              </tbody>
            </table>
          </div>
          <footer className="cashier-order-summary"><span>{filtered.length} transaction(s)</span><span>Paid total <strong>{money(orderRevenue(filtered))}</strong></span></footer>
        </section>
      </div>
    </>
  );
}

function paymentDateLabel(order) {
  const date = order.createdAt ? new Date(order.createdAt) : null;
  if (!date || Number.isNaN(date.getTime())) return order.time;
  return date.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function PaymentVerificationPage({ orders, onUpdateOrder }) {
  const [processingOrder, setProcessingOrder] = useState('');
  const [error, setError] = useState('');
  const awaiting = orders.filter((order) => order.paymentStatus === 'Menunggu');
  const recentlyVerified = orders.filter((order) => order.paymentStatus === 'Lunas').slice(0, 7);
  const receiveCash = async (order) => {
    setProcessingOrder(order.transactionId);
    setError('');
    try {
      await onUpdateOrder(order.transactionId, { paymentStatus: 'Lunas' });
    } catch (updateError) {
      setError(updateError.message || 'Payment could not be verified.');
    } finally {
      setProcessingOrder('');
    }
  };

  return (
    <>
      <StaffHeading eyebrow="CASH & QRIS" title="Payment verification" />
      <div className="staff-page-content">
        {error && <p className="inline-error" role="alert">{error}</p>}
        <div className="payment-verification-layout">
          <section className="panel payment-verification-panel payment-awaiting-panel">
            <h2>Awaiting payment</h2>
            <p className="payment-verification-warning"><span aria-hidden="true">!</span> Confirm cash only after the money is in your hand. QRIS is confirmed by the gateway — never by a customer screenshot.</p>
            <div className="payment-awaiting-list">
              {awaiting.map((order) => {
                const isCash = order.payment === 'Cash';
                return (
                  <article className="payment-awaiting-card" key={order.transactionId}>
                    <div className="payment-awaiting-main">
                      <strong>{order.id}</strong>
                      <span>{order.customer} · {paymentDateLabel(order)}</span>
                      <div className="payment-awaiting-tags">
                        <Pill tone="orange">{order.channel === 'pos' ? 'Walk-in' : 'QR order'}</Pill>
                        <Pill tone={isCash ? 'neutral' : 'blue'}>{order.payment}</Pill>
                        <Pill tone="orange">Unpaid</Pill>
                      </div>
                    </div>
                    <strong className="payment-awaiting-total">{money(order.total)}</strong>
                    {isCash ? (
                      <button className="receive-cash-button" disabled={processingOrder === order.transactionId} onClick={() => receiveCash(order)}>
                        <Banknote size={13} /> {processingOrder === order.transactionId ? 'Saving…' : 'Receive cash'}
                      </button>
                    ) : (
                      <span className="payment-gateway-pending"><QrCode size={13} /> Awaiting gateway</span>
                    )}
                  </article>
                );
              })}
              {awaiting.length === 0 && <p className="payment-verification-empty">No payments are waiting for verification.</p>}
            </div>
          </section>
          <section className="panel payment-verification-panel payment-recent-panel">
            <h2>Recently verified</h2>
            <div className="payment-recent-list">
              {recentlyVerified.map((order) => (
                <article className="payment-recent-item" key={order.transactionId}>
                  <div><strong>{order.id}</strong><strong>{money(order.total)}</strong></div>
                  <p>{order.payment === 'QRIS' ? 'Simulated gateway (prototype — not real money)' : 'Cash confirmed by cashier'} · {paymentDateLabel(order)}</p>
                </article>
              ))}
              {recentlyVerified.length === 0 && <p className="payment-verification-empty">No verified payments yet.</p>}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
