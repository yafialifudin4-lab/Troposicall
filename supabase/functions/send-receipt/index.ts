import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function respond(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function escapeHtml(value: string) {
  const replacements: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return value.replace(/[&<>"']/g, (character) => replacements[character] || character);
}

function encodeBase64(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000));
  }
  return btoa(binary);
}

function encodeBase64Url(value: string) {
  return encodeBase64(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function money(value: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value);
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return respond({ error: 'Method not allowed.' }, 405);

  let transactionId: string;
  let email: string;
  try {
    const body = await request.json();
    transactionId = typeof body.transactionId === 'string' ? body.transactionId : '';
    email = typeof body.email === 'string' ? body.email.trim() : '';
  } catch {
    return respond({ error: 'Invalid request body.' }, 400);
  }

  if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(transactionId)
    || email.length > 254
    || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return respond({ error: 'A valid transaction and email address are required.' }, 400);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const gmailClientId = Deno.env.get('GMAIL_CLIENT_ID');
  const gmailClientSecret = Deno.env.get('GMAIL_CLIENT_SECRET');
  const gmailRefreshToken = Deno.env.get('GMAIL_REFRESH_TOKEN');
  const gmailSenderEmail = Deno.env.get('GMAIL_SENDER_EMAIL');

  if (!supabaseUrl || !serviceRoleKey || !gmailClientId || !gmailClientSecret || !gmailRefreshToken || !gmailSenderEmail) {
    console.error('Receipt email configuration is incomplete.');
    return respond({ error: 'Email delivery is not configured. Please contact the store.' }, 503);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  let claimed = false;
  let sent = false;

  try {
    const { data: order, error: orderError } = await admin
      .from('transactions')
      .select('id,receipt_number,customer_name,customer_email,receipt_email_sent_at,payment_method,total,status,created_at,cashier_id,transaction_items(product_name,quantity,unit_price,line_total)')
      .eq('id', transactionId)
      .is('cashier_id', null)
      .maybeSingle();

    if (orderError) throw orderError;
    if (!order) return respond({ error: 'Order not found.' }, 404);
    if (order.receipt_email_sent_at) return respond({ error: 'A receipt was already sent for this order.' }, 409);

    const orderCreatedAt = Date.parse(order.created_at);
    if (!Number.isFinite(orderCreatedAt) || Date.now() - orderCreatedAt > 30 * 60 * 1000) {
      return respond({ error: 'Receipt email requests are only available shortly after checkout.' }, 410);
    }

    const { data: claim, error: claimError } = await admin
      .from('transactions')
      .update({ customer_email: email, receipt_email_sent_at: new Date().toISOString() })
      .eq('id', transactionId)
      .is('receipt_email_sent_at', null)
      .select('id')
      .maybeSingle();

    if (claimError) throw claimError;
    if (!claim) return respond({ error: 'A receipt was already sent for this order.' }, 409);
    claimed = true;

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: gmailClientId,
        client_secret: gmailClientSecret,
        refresh_token: gmailRefreshToken,
        grant_type: 'refresh_token',
      }),
    });
    if (!tokenResponse.ok) throw new Error(`Google token request failed (${tokenResponse.status}).`);

    const token = await tokenResponse.json();
    if (typeof token.access_token !== 'string') throw new Error('Google did not return an access token.');

    const items = (order.transaction_items || []).map((item) => (
      `<tr><td>${escapeHtml(item.product_name)} × ${item.quantity}</td><td style="text-align:right">${money(Number(item.line_total))}</td></tr>`
    )).join('');
    const html = `<main style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#29251f">
      <h1>TROPOSICAL receipt</h1>
      <p>Order <strong>${escapeHtml(order.receipt_number)}</strong></p>
      <p>${escapeHtml(order.customer_name || 'Customer')} · ${new Date(order.created_at).toLocaleString('id-ID')}</p>
      <table style="width:100%;border-collapse:collapse"><tbody>${items}</tbody>
      <tfoot><tr><th style="text-align:left;padding-top:12px">Total</th><th style="text-align:right;padding-top:12px">${money(Number(order.total))}</th></tr></tfoot></table>
      <p>Payment: ${escapeHtml(order.payment_method)} (${escapeHtml(order.status)})</p>
      <p>Thank you! See you by the shore.</p>
    </main>`;
    const mimeMessage = [
      `From: ${gmailSenderEmail}`,
      `To: ${email}`,
      `Subject: TROPOSICAL receipt ${order.receipt_number}`,
      'MIME-Version: 1.0',
      'Content-Type: text/html; charset=UTF-8',
      'Content-Transfer-Encoding: base64',
      '',
      encodeBase64(html).replace(/.{76}/g, '$&\r\n'),
    ].join('\r\n');

    const gmailResponse = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw: encodeBase64Url(mimeMessage) }),
    });
    if (!gmailResponse.ok) throw new Error(`Gmail send request failed (${gmailResponse.status}).`);

    sent = true;
    return respond({ sent: true });
  } catch (error) {
    console.error('Receipt email delivery failed:', error);
    if (claimed && !sent) {
      const { error: releaseError } = await admin
        .from('transactions')
        .update({ receipt_email_sent_at: null })
        .eq('id', transactionId);
      if (releaseError) console.error('Could not release receipt email claim:', releaseError);
    }
    return respond({ error: 'The order was saved, but its receipt email could not be sent.' }, 502);
  }
});
