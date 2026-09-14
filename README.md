# Uber Ads API — Example App

A small, complete Next.js application you can clone and point at your own Uber
ad account to explore the [Uber Ads API](https://developer.uber.com/docs/ads/introduction).

It implements the full OAuth 2.0 authorization code flow, wraps all 
documented endpoints in a typed client, and ships a dashboard for browsing
campaigns, ad groups, ads, stores, products, and performance reports. Types are
generated from Uber's official OpenAPI specification.

> This is example code intended for learning and local experimentation. It is
> not an officially supported Uber product.

## Requirements

- Node.js 20.9 or newer
- An app registered at [developer.uber.com/dashboard](https://developer.uber.com/dashboard)
  with the Ads API scopes enabled
- `jq` and `curl`, only if you want to run `scripts/uber-ads-api.sh`

## Quick start

```bash
git clone https://github.com/ekim197/uber-ads-api-example
cd uber-ads-api-example
npm install
cp .env.example .env.local
```

Open `.env.local` and fill in the two required values:

```bash
UBER_CLIENT_ID=your_client_id
UBER_CLIENT_SECRET=your_client_secret
```

Register `http://localhost:3000/auth/callback` as a redirect URI on your Uber
app — it must match exactly, including the scheme and port. Then:

```bash
npm run dev
```

## Security notes

If you fork this repository, keep these in place:

- Never commit `.env.local`. Only `.env.example` is tracked, and it contains no
  values.
- Keep `UBER_CLIENT_SECRET` server-side. Any variable prefixed with
  `NEXT_PUBLIC_` is inlined into the browser bundle, which is why the secret
  deliberately has no such prefix.
- Tokens are stored in `httpOnly` cookies and attached by the server-side
  proxy, so they never reach client JavaScript.
- The OAuth `state` parameter is generated, stored in an `httpOnly` cookie, and
  verified on the callback. A mismatch aborts the login.
- The proxy restricts forwarding to `/v1/ads/*` so a session token cannot be
  used against unrelated Uber APIs.
- Cookies are marked `secure` automatically when `NODE_ENV=production`.

## License

Apache-2.0 — see [LICENSE](LICENSE).
