# Putting Nerox on nerox.cc

## Where things stand

- **Nerox isn't hosted anywhere yet.** It runs on your computer (`npm run dev`), and the database is your Supabase project.
- **`nerox.cc` hasn't been bought or connected.** Nothing here changes DNS or any live settings.
- **The code is ready for a custom domain:**
  - Canonical links, the sitemap (`/sitemap.xml`), `robots.txt` and social preview images all use `NEXT_PUBLIC_SITE_URL`.
  - Invitation links and sign-in emails use `NEXT_PUBLIC_SITE_URL`.
  - Stripe checkout return addresses use `NEXT_PUBLIC_SITE_URL`.
  - When `NEXT_PUBLIC_SITE_URL` is set, visitors to the old `*.vercel.app` production address are redirected (308) to your domain. Preview deployments and `/api/` routes are left alone, so Stripe webhooks keep working.

The steps below use **Vercel**, the simplest host for a Next.js app with a free Hobby plan. Check Vercel's terms if you start charging customers: commercial use may need the Pro plan.

## 1. Buy the domain

`.cc` domains are sold by most registrars, for example Namecheap, Porkbun or Vercel itself (**Domains → Buy**). Before you buy:

- Compare the **renewal** price, not just the first year.
- Turn on WHOIS privacy and auto-renew.

If you buy it through Vercel, it's connected for you: skip the DNS records in step 3.

## 2. Put Nerox on Vercel

1. Push the code to a GitHub repository. `.env.local` is already ignored, so your keys won't be uploaded.
2. On vercel.com, choose **Add New → Project** and import the repository. Vercel detects Next.js.
3. Under **Environment Variables**, add everything from your `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_SITE_URL=https://nerox.cc`
   - optionally `ANTHROPIC_API_KEY`
   - the Stripe values from `docs/payments.md`
4. Press **Deploy**. You'll get a `something.vercel.app` address. Check that it works there first.

## 3. Connect nerox.cc

1. In the Vercel project, go to **Settings → Domains → Add** and enter `nerox.cc`. Vercel offers to add `www.nerox.cc` too: accept.
2. Choose which address is the main one, `nerox.cc`, and set `www.nerox.cc` to **redirect** to it (308).
3. At your registrar's DNS settings, add the records Vercel shows on the domain card. They usually look like this:

   | Type | Name | Value |
   | --- | --- | --- |
   | A | `@` | `76.76.21.21` (or the value on your domain card) |
   | CNAME | `www` | the project-specific value shown, e.g. `xxxx.vercel-dns-017.com` |

   - Remove any other A, AAAA or CNAME records for `@` and `www` that point elsewhere. A registrar's "parking" page is a common one.
   - Leave MX records (email) alone.
4. **Verification:** if Vercel asks for a `TXT` record at `_vercel`, add it. This only happens when the domain was used in another Vercel account before.
5. **HTTPS:** once DNS is correct, Vercel issues and renews the certificate automatically. The domain card turns green. DNS changes can take from a few minutes to a few hours.

## 4. Update Supabase sign-in settings

In Supabase, go to **Authentication → URL Configuration**:

- **Site URL:** `https://nerox.cc`
- **Redirect URLs:** add `https://nerox.cc/auth/callback`. Keep `http://localhost:3000/auth/callback` for local development.

Without this, password-reset and confirmation emails would link to the wrong place.

## 5. Update Stripe

If payments are on:

- Change the webhook endpoint to `https://nerox.cc/api/stripe/webhook`. If you make a new endpoint instead, copy its new signing secret into `STRIPE_WEBHOOK_SECRET`.
- Under **Settings → Business → Public details**, set the website to `https://nerox.cc`.

## 6. Redeploy and check

After changing `NEXT_PUBLIC_SITE_URL`, redeploy (Vercel: **Deployments → … → Redeploy**). Then check:

- [ ] `https://nerox.cc` loads with a padlock, and `www.nerox.cc` redirects to it.
- [ ] The old `….vercel.app` address redirects to `https://nerox.cc`.
- [ ] Sign up, confirm your email, sign in, and sign out.
- [ ] Request a password reset. The email link opens `nerox.cc`.
- [ ] Create an invitation. The link starts with `https://nerox.cc/invite/`.
- [ ] `https://nerox.cc/sitemap.xml` and `/robots.txt` list `nerox.cc` addresses.
- [ ] Share the link in a private message. The preview card shows the Nerox image.
- [ ] If payments are on: a test checkout returns to `nerox.cc`, and Stripe's webhook log shows `200` responses.

## Optional: email at your domain

To send and receive mail as `hello@nerox.cc` instead of `getnerox@gmail.com`:

1. Set up a mail provider. Zoho Mail, Google Workspace or a forwarding service like ImprovMX all work.
2. Add their MX and TXT records at your registrar.
3. Change `contact.email` in `src/config/site.ts`.

If you switch to Vercel's nameservers later, copy these records across first.
