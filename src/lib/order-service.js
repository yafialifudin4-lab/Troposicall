const productColumns = 'id,name,category,description,price,stock,minimum_stock,image_url,is_active,preparation_type';
const transactionColumns = 'id,receipt_number,customer_name,cashier_id,payment_method,subtotal,tax,total,amount_received,status,order_status,created_at,transaction_items(id,product_name,quantity,unit_price,line_total)';

const orderStageLabels = {
  Baru: 'Confirmed',
  Diproses: 'Preparing',
  Siap: 'Ready',
  Selesai: 'Completed',
};

function displayStatus(paymentStatus, orderStage) {
  if (paymentStatus === 'Dibatalkan') return 'Cancelled';
  if (paymentStatus !== 'Lunas') return 'Waiting for Payment';
  return orderStageLabels[orderStage] || 'Confirmed';
}

function assertNoError(error) {
  if (error) throw error;
}

function requireRows(data, source) {
  if (!Array.isArray(data)) throw new Error(`${source} returned an invalid response.`);
  return data;
}

export function mapProduct(row) {
  return {
    id: row.id,
    name: row.name,
    category: row.category || 'Other',
    description: row.description || '',
    price: Number(row.price),
    stock: Number(row.stock),
    minimumStock: Number(row.minimum_stock ?? 10),
    image: row.image_url || '/assets/gethuk.jpeg',
    imageUrl: row.image_url || '',
    available: Boolean(row.is_active),
    preparationType: row.preparation_type || 'ready',
  };
}

export function mapTransaction(row) {
  const lines = (row.transaction_items || []).map((item) => ({
    id: item.id,
    name: item.product_name,
    quantity: Number(item.quantity),
    unitPrice: Number(item.unit_price),
    total: Number(item.line_total),
  }));
  const paymentStatus = row.status;
  const orderStage = row.order_status || 'Baru';
  const createdAt = row.created_at ? new Date(row.created_at) : null;

  return {
    id: row.receipt_number,
    transactionId: row.id,
    channel: row.cashier_id ? 'pos' : 'customer',
    time: createdAt && !Number.isNaN(createdAt.getTime())
      ? createdAt.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
      : '—',
    createdAt: row.created_at,
    customer: row.customer_name || 'Walk-in',
    items: lines.map((item) => `${item.name} × ${item.quantity}`).join(', '),
    lines,
    total: Number(row.total),
    payment: row.payment_method === 'Tunai' ? 'Cash' : row.payment_method,
    paymentStatus,
    orderStage,
    status: displayStatus(paymentStatus, orderStage),
  };
}

export function applyOrderChanges(order, changes) {
  const paymentStatus = changes.paymentStatus || order.paymentStatus;
  const orderStage = changes.orderStatus || order.orderStage;
  return {
    ...order,
    paymentStatus,
    orderStage,
    status: displayStatus(paymentStatus, orderStage),
  };
}

export async function fetchProducts(client, { includeInactive = false } = {}) {
  let query = client.from('products').select(productColumns).order('name');
  if (!includeInactive) query = query.eq('is_active', true);
  const { data, error } = await query;
  assertNoError(error);
  return requireRows(data, 'Product query').map(mapProduct);
}

export async function fetchStoreSettings(client) {
  const { data, error } = await client
    .from('store_settings')
    .select('is_open,qris_image_url')
    .order('id')
    .limit(1)
    .maybeSingle();
  assertNoError(error);
  return {
    isOpen: data ? Boolean(data.is_open) : true,
    isConfigured: Boolean(data),
    qrisImageUrl: data?.qris_image_url || '/assets/qris-pembayaran.jpeg',
  };
}

export async function fetchTransactions(client) {
  const { data, error } = await client
    .from('transactions')
    .select(transactionColumns)
    .order('created_at', { ascending: false });
  assertNoError(error);
  return requireRows(data, 'Transaction query').map(mapTransaction);
}

export async function createOrder(client, {
  channel,
  customerName,
  payment,
  amountReceived = 0,
  items,
}) {
  if (!items?.length) throw new Error('Keranjang masih kosong.');

  const { data, error } = await client.rpc('create_order', {
    p_channel: channel,
    p_customer_name: customerName?.trim() || null,
    p_service_type: 'Bawa pulang',
    p_payment_method: payment === 'Cash' ? 'Tunai' : payment,
    p_amount_received: channel === 'pos' ? Number(amountReceived) : 0,
    p_items: items.map(({ product, quantity }) => ({
      product_id: product.id,
      quantity,
    })),
  });
  assertNoError(error);
  if (!data || Array.isArray(data) || typeof data !== 'object') {
    throw new Error('Supabase tidak mengembalikan transaksi yang dibuat.');
  }
  return { ...mapTransaction(data), channel };
}

export async function updateOrderState(client, transactionId, changes) {
  const { data, error } = await client.rpc('update_order_state', {
    p_transaction_id: transactionId,
    p_payment_status: changes.paymentStatus || null,
    p_order_status: changes.orderStatus || null,
  });
  assertNoError(error);
  if (!data || Array.isArray(data) || typeof data !== 'object') {
    throw new Error('Supabase tidak mengembalikan status transaksi yang diperbarui.');
  }
  return data;
}

export async function saveProduct(client, product) {
  let imageUrl = product.imageUrl?.trim() || null;
  if (product.imageFile) {
    const file = product.imageFile;
    const extension = file.name.split('.').pop()?.toLowerCase();
    const supportedExtensions = {
      'image/jpeg': ['jpg', 'jpeg'],
      'image/png': ['png'],
    };
    if (!supportedExtensions[file.type]?.includes(extension)) {
      throw new Error('Pilih gambar dengan format JPEG, JPG, atau PNG.');
    }

    const path = `products/${crypto.randomUUID()}.${extension}`;
    const bucket = client.storage.from('product-images');
    const { data: uploaded, error: uploadError } = await bucket.upload(path, file, {
      contentType: file.type,
      upsert: false,
    });
    assertNoError(uploadError);
    imageUrl = bucket.getPublicUrl(uploaded.path).data.publicUrl;
  }

  const payload = {
    name: product.name.trim(),
    category: product.category.trim() || null,
    description: product.description?.trim() || '',
    price: Number(product.price),
    stock: Number(product.stock),
    minimum_stock: Number(product.minimumStock ?? 10),
    image_url: imageUrl,
    is_active: Boolean(product.available),
    preparation_type: product.preparationType || 'ready',
  };
  const query = product.id
    ? client.from('products').update(payload).eq('id', product.id)
    : client.from('products').insert(payload);
  const { error } = await query.select('id').single();
  assertNoError(error);
}

export async function setProductStock(client, productId, stock) {
  const { error } = await client
    .from('products')
    .update({ stock })
    .eq('id', productId)
    .select('id')
    .single();
  assertNoError(error);
}

export async function renameProductCategory(client, previousName, nextName) {
  const { error } = await client
    .from('products')
    .update({ category: nextName.trim() || null })
    .eq('category', previousName)
    .select('id');
  assertNoError(error);
}

export async function deleteProduct(client, productId) {
  const { error } = await client
    .from('products')
    .delete()
    .eq('id', productId)
    .select('id')
    .single();
  assertNoError(error);
}
