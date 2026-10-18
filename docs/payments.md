# Taking payments with Stripe

Nerox has a complete Stripe subscription integration. It stays **switched off** until you add the Stripe settings below. While it's off:

- the pricing page shows Pro as "Coming soon" with a "Register interest" email button;
- nothing is limited, so everyone gets every feature ("early access").

When it's on:

- Free workspaces can hold up to 5 people (counting pending invitations);
- Pro adds unlimited people, full Nerox AI answers and CSV export;
- owners and admins upgrade from **Settings → Billing**.

## How it works

| Step | What happens | Where in the code |
| --- | --- | --- |
| 1. Upgrade | An owner or admin presses **Upgrade to Pro**. The server creates a Stripe Checkout session with one seat per active member and the workspace ID in the subscription's metadata. | `src/lib/actions/billing.ts` |
| 2. Pay | The person pays on Stripe's hosted checkout page. Card details never touch Nerox. | Stripe |
| 3. Return | Stripe sends them back to `/settings/billing?checkout=success`. This page **grants nothing**. It shows "Confirming your payment…" and re-checks the plan every few seconds. | `src/app/(app)/settings/billing/` |
| 4. Confirm | Stripe calls `POST /api/stripe/webhook`. Nerox verifies the signature against the raw request body, then records the subscription through a database function only the service role can run. | `src/app/api/stripe/webhook/route.ts`, `supabase/migrations/20261019000000_billing.sql` |
| 5. Access | Pro features check the stored subscription. `active`, `trialing` and `past_due` count as paid; everything else counts as Free. | `src/lib/billing/plan.ts` |
| 6. Changes | Seat counts follow your team: when someone joins or is removed, Nerox updates the subscription quantity (with proration). Card changes, invoices and cancelling happen in Stripe's customer portal (**Manage billing**). | `src/lib/billing/server.ts` |

Events that arrive out of order are handled: each update carries Stripe's event time, and older events never overwrite newer ones. When a workspace resubscribes, the end of its old subscription can't cancel the new one.

## What you need to set up

You'll need a Stripe account. Use **test mode** first: everything below works the same way with test keys.

### 1. Create the product and prices

In the Stripe Dashboard, go to **Product catalogue → Add product**:

- **Name:** Nerox Pro
- **Price 1:** £6.00, recurring, **monthly**. Use per-unit pricing; Nerox sets the quantity to the number of people.
- **Price 2 (optional):** £60.00, recurring, **yearly**, per unit.

Copy each price's ID (it starts with `price_`). If you change the prices, update `pricing` in `src/config/site.ts` too, so the website shows the same numbers.

### 2. Create the webhook

Go to **Developers → Webhooks → Add endpoint**:

- **Endpoint URL:** `https://YOUR-DOMAIN/api/stripe/webhook` (for example `https://nerox.cc/api/stripe/webhook`)
- **Events:**
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`

Copy the endpoint's **Signing secret** (it starts with `whsec_`).

### 3. Set up the customer portal

Go to **Settings → Billing → Customer portal**. Turn on:

- updating payment methods;
- viewing invoices;
- **cancelling subscriptions, at the end of the billing period**.

Leave **"customers can update quantities" turned off**, because Nerox manages seats itself. Only allow switching between prices if you created both the monthly and the yearly price.

### 4. Decide what happens when a renewal fails

Go to **Settings → Billing → Subscriptions and emails → Manage failed payments**:

- Turn on Smart Retries.
- Choose **cancel the subscription** (or mark it unpaid) after the final retry.

While Stripe is retrying, the subscription is `past_due`. Nerox keeps Pro on and shows the owner a "Your last payment failed" banner. When Stripe gives up, the workspace moves back to Free automatically.

### 5. Add the environment variables

Add these to `.env.local` (on your computer) and to your host's environment settings (Vercel: **Project → Settings → Environment Variables**):

```
STRIPE_SECRET_KEY=sk_test_...              # Developers → API keys → Secret key. Server only.
STRIPE_WEBHOOK_SECRET=whsec_...            # from step 2
STRIPE_PRICE_PRO_MONTHLY=price_...
STRIPE_PRICE_PRO_YEARLY=price_...          # optional
SUPABASE_SERVICE_ROLE_KEY=eyJ...           # Supabase → Project Settings → API keys → service_role. Server only.
```

- **Never** put any of these in a variable starting with `NEXT_PUBLIC_`. They must stay on the server.
- The service role key bypasses all security rules. Nerox uses it only in the webhook and for seat syncing, never in the browser.
- Payments switch on only when the first four Stripe values and the service role key are all set.

### 6. Run the database migration

In Supabase's **SQL Editor**, run `supabase/migrations/20261019000000_billing.sql` once.

If the webhook later logs `Could not find the function public.billing_apply_subscription … in the schema cache`, refresh Supabase's API cache by running this in the SQL Editor:

```sql
notify pgrst, 'reload schema';
```

### 7. Test it end to end (test mode)

1. Install the [Stripe CLI](https://docs.stripe.com/stripe-cli) and run:
   ```bash
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```
   It prints a `whsec_...` secret. Use that as `STRIPE_WEBHOOK_SECRET` while testing locally.
2. Run `npm run dev`. Sign in as a workspace owner and open **Settings → Billing → Upgrade to Pro**.
3. Pay with the test card `4242 4242 4242 4242`, any future expiry date and any CVC.
4. You land on the billing page. Within a few seconds it should say **"You're on Pro."** In the `stripe listen` window you'll see `customer.subscription.created` with a 200 response.
5. Press **Manage billing → Cancel**. Settings should show "Pro ends on …".
6. To test a failed renewal, use a [test clock](https://docs.stripe.com/billing/testing/test-clocks) with the card `4000 0000 0000 0341`.

When it all works, repeat steps 1–5 in the Dashboard with **live mode** turned on: new product, new prices, new webhook, live keys. Then put the live values in your production environment variables.

## Before you charge real customers

These aren't code, but you'll need them:

- **Stripe account activation:** your business details and a bank account for payouts.
- **Terms of service and a privacy policy** published on the site. Stripe and UK GDPR expect them. Get them written or checked properly, and link them in the footer.
- **VAT:** check with an accountant whether prices should include VAT, and whether to turn on Stripe Tax.

## Testing done in this repository

- Unit tests (`tests/unit/billing.test.ts`) cover:
  - plan rules;
  - mapping Stripe events to updates;
  - rejecting unsigned, wrongly signed, tampered or stale (old timestamp) webhook payloads;
  - the CSV export.
- Database tests (`tests/db/billing.test.ts`) cover:
  - signed-in users can't grant themselves a plan;
  - only the service role can write billing state;
  - members can read only their own workspace's plan;
  - stale and superseded events are ignored.
- The full flow was run locally against the real webhook route and database, using signed test events and a local stand-in for Stripe's API (see `README.md`).
- It has **not** yet been run against Stripe's real servers. Do step 7 in test mode before going live.
