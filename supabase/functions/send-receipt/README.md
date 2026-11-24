# Gmail receipt delivery

The checkout sends a receipt only when the customer provides an email address. Deploy the migration in `supabase/migrations` before deploying this function.

Configure a Google Cloud OAuth client for the Gmail account that will send receipts, enable the Gmail API, and obtain an offline refresh token with the `https://www.googleapis.com/auth/gmail.send` scope. Keep all credentials private; do not put them in the frontend `.env` file or commit them.

Set these Supabase Edge Function secrets:

- `GMAIL_CLIENT_ID`
- `GMAIL_CLIENT_SECRET`
- `GMAIL_REFRESH_TOKEN`
- `GMAIL_SENDER_EMAIL` (must match the Google account that authorized the refresh token)

Supabase provides `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to deployed Edge Functions. Apply the migration and deploy with:

```powershell
supabase db push
supabase secrets set GMAIL_CLIENT_ID=... GMAIL_CLIENT_SECRET=... GMAIL_REFRESH_TOKEN=... GMAIL_SENDER_EMAIL=...
supabase functions deploy send-receipt
```

Google OAuth consent screen settings may require publishing the app to avoid refresh tokens expiring in testing mode.
