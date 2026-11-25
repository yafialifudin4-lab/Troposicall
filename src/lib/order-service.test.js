import test from 'node:test';
import assert from 'node:assert/strict';
import { applyOrderChanges, createOrder, mapProduct, mapTransaction, saveProduct, updateOrderState } from './order-service.js';

test('maps database transaction and separate payment/preparation states', () => {
  const order = mapTransaction({
    id: 'transaction-1',
    cashier_id: 'staff-1',
    receipt_number: 'TRP-001',
    customer_name: 'Ayu',
    payment_method: 'QRIS',
    total: '24000',
    status: 'Lunas',
    order_status: 'Siap',
    created_at: '2026-11-23T07:00:00.000Z',
    transaction_items: [
      { id: 'item-1', product_name: 'Gethuk', quantity: 3, unit_price: '8000', line_total: '24000' },
    ],
  });

  assert.equal(order.id, 'TRP-001');
  assert.equal(order.transactionId, 'transaction-1');
  assert.equal(order.channel, 'pos');
  assert.equal(order.payment, 'QRIS');
  assert.equal(order.paymentStatus, 'Lunas');
  assert.equal(order.orderStage, 'Siap');
  assert.equal(order.status, 'Ready');
  assert.equal(order.total, 24000);
  assert.deepEqual(order.lines[0], {
    id: 'item-1',
    name: 'Gethuk',
    quantity: 3,
    unitPrice: 8000,
    total: 24000,
  });
});

test('maps waiting and cancelled payment statuses without conflating preparation', () => {
  const waiting = mapTransaction({
    receipt_number: 'TRP-002',
    payment_method: 'Tunai',
    status: 'Menunggu',
    order_status: 'Baru',
    total: 5000,
  });
  const cancelled = mapTransaction({
    receipt_number: 'TRP-003',
    payment_method: 'Tunai',
    status: 'Dibatalkan',
    order_status: 'Baru',
    total: 5000,
  });

  assert.equal(waiting.status, 'Waiting for Payment');
  assert.equal(waiting.channel, 'customer');
  assert.equal(waiting.payment, 'Cash');
  assert.equal(cancelled.status, 'Cancelled');
});

test('maps product fields and provides safe display defaults', () => {
  const product = mapProduct({
    id: 'product-1',
    name: 'Mango',
    category: null,
    price: '12000',
    stock: 5,
    is_active: true,
  });

  assert.equal(product.price, 12000);
  assert.equal(product.stock, 5);
  assert.equal(product.available, true);
  assert.equal(product.category, 'Other');
  assert.equal(product.description, '');
  assert.equal(product.image, '/assets/gethuk.jpeg');
});

test('creates customer orders with authoritative product IDs and no received cash', async () => {
  let request;
  const client = {
    rpc: async (name, params) => {
      request = { name, params };
      return {
        data: {
          id: 'transaction-1',
          receipt_number: 'TRP-001',
          payment_method: 'QRIS',
          status: 'Menunggu',
          order_status: 'Baru',
          total: 8000,
          transaction_items: [],
        },
        error: null,
      };
    },
  };

  const order = await createOrder(client, {
    channel: 'customer',
    customerName: '  Ayu  ',
    payment: 'QRIS',
    amountReceived: 50000,
    items: [{ product: { id: 'product-1' }, quantity: 1 }],
  });

  assert.equal(request.name, 'create_order');
  assert.equal(request.params.p_customer_name, 'Ayu');
  assert.equal(request.params.p_service_type, 'Bawa pulang');
  assert.equal(request.params.p_payment_method, 'QRIS');
  assert.equal(request.params.p_amount_received, 0);
  assert.deepEqual(request.params.p_items, [{ product_id: 'product-1', quantity: 1 }]);
  assert.equal(order.id, 'TRP-001');
});

test('rejects empty order and surfaces RPC errors', async () => {
  await assert.rejects(
    createOrder({ rpc() {} }, { channel: 'customer', payment: 'Cash', items: [] }),
    /keranjang masih kosong/i,
  );

  const databaseError = new Error('permission denied');
  await assert.rejects(
    createOrder({
      rpc: async () => ({ data: null, error: databaseError }),
    }, {
      channel: 'customer',
      payment: 'Cash',
      items: [{ product: { id: 'product-1' }, quantity: 1 }],
    }),
    /permission denied/,
  );
});

test('creates cashier POS transactions with the actual received cash', async () => {
  let request;
  const client = {
    rpc: async (name, params) => {
      request = { name, params };
      return {
        data: {
          id: 'transaction-2',
          receipt_number: 'TRP-002',
          payment_method: 'Tunai',
          status: 'Lunas',
          order_status: 'Baru',
          total: 8000,
          transaction_items: [],
        },
        error: null,
      };
    },
  };

  const order = await createOrder(client, {
    channel: 'pos',
    customerName: 'Walk-in',
    payment: 'Cash',
    amountReceived: 10000,
    items: [{ product: { id: 'product-1' }, quantity: 1 }],
  });

  assert.equal(request.params.p_channel, 'pos');
  assert.equal(request.params.p_payment_method, 'Tunai');
  assert.equal(request.params.p_amount_received, 10000);
  assert.equal(order.paymentStatus, 'Lunas');
  assert.equal(order.status, 'Confirmed');
  assert.equal(order.channel, 'pos');
});

test('updates payment and preparation statuses through the guarded RPC', async () => {
  let request;
  await updateOrderState({
    rpc: async (name, params) => {
      request = { name, params };
      return { data: { id: 'transaction-1', status: 'Lunas', order_status: 'Baru' }, error: null };
    },
  }, 'transaction-1', { paymentStatus: 'Lunas' });

  assert.equal(request.name, 'update_order_state');
  assert.equal(request.params.p_transaction_id, 'transaction-1');
  assert.equal(request.params.p_payment_status, 'Lunas');
  assert.equal(request.params.p_order_status, null);
});

test('sends order cancellation through the guarded RPC', async () => {
  let request;
  await updateOrderState({
    rpc: async (name, params) => {
      request = { name, params };
      return { data: { id: 'transaction-1', status: 'Dibatalkan', order_status: 'Baru' }, error: null };
    },
  }, 'transaction-1', { paymentStatus: 'Dibatalkan' });

  assert.equal(request.name, 'update_order_state');
  assert.equal(request.params.p_transaction_id, 'transaction-1');
  assert.equal(request.params.p_payment_status, 'Dibatalkan');
  assert.equal(request.params.p_order_status, null);
});

test('applies payment confirmation without prematurely advancing preparation', () => {
  const updated = applyOrderChanges({
    paymentStatus: 'Menunggu',
    orderStage: 'Baru',
    status: 'Waiting for Payment',
  }, { paymentStatus: 'Lunas' });

  assert.equal(updated.paymentStatus, 'Lunas');
  assert.equal(updated.orderStage, 'Baru');
  assert.equal(updated.status, 'Confirmed');
});

test('uploads supported product images to Storage and saves their public URL', async () => {
  let uploadedFile;
  let savedPayload;
  const client = {
    storage: {
      from: (bucketName) => ({
        upload: async (path, file, options) => {
          uploadedFile = { bucketName, path, file, options };
          return { data: { path }, error: null };
        },
        getPublicUrl: (path) => ({ data: { publicUrl: `https://storage.example/${path}` } }),
      }),
    },
    from: () => ({
      insert: (payload) => {
        savedPayload = payload;
        return { select: () => ({ single: async () => ({ data: { id: 'product-1' }, error: null }) }) };
      },
    }),
  };

  await saveProduct(client, {
    name: 'Mango',
    category: 'Food',
    price: 12000,
    stock: 5,
    available: true,
    imageFile: { name: 'mango.jpg', type: 'image/jpeg' },
  });

  assert.equal(uploadedFile.bucketName, 'product-images');
  assert.match(uploadedFile.path, /^products\/.+\.jpg$/);
  assert.equal(uploadedFile.options.contentType, 'image/jpeg');
  assert.equal(savedPayload.image_url, `https://storage.example/${uploadedFile.path}`);
});

test('rejects unsupported product image formats before upload', async () => {
  await assert.rejects(
    saveProduct({
      storage: { from: () => assert.fail('Unsupported image must not be uploaded') },
    }, {
      name: 'Mango',
      imageFile: { name: 'mango.gif', type: 'image/gif' },
    }),
    /JPEG, JPG, atau PNG/,
  );
});
