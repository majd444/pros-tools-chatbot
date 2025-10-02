# Frontend Deployment to Vercel + Backend Wiring

This document captures the exact steps and environment variables required to deploy the Next.js app in `kk/` to Vercel and wire it to your backend service.

## 1) Prerequisites
- Vercel account and CLI installed: `npm i -g vercel`
- Convex CLI installed: `npm i -g convex`
- Backend HTTPS URL available (set CORS to allow your Vercel domain)
- Clerk project keys if using Clerk

## 2) Environment variables
Configure these in your Vercel Project (Settings → Environment Variables). Use the same names.

- NEXT_PUBLIC_API_BASE_URL = https://YOUR-BACKEND-DOMAIN
- NEXT_PUBLIC_CONVEX_URL = https://YOUR-CONVEX-DEPLOYMENT (from step 3)
- NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = <your Clerk publishable key>
- CLERK_WEBHOOK_SECRET = <your Clerk webhook secret>

Optional (if you add others later):
- NODE_ENV = production

## 3) Create a production Convex deployment
Run from `kk/`:

```
# Log in if needed
npx convex login

# Deploy to Convex (creates or updates your prod deployment)
npx convex deploy

# Output will show a URL similar to:
# https://YOUR-CONVEX-DEPLOYMENT.convex.cloud
# Use that as NEXT_PUBLIC_CONVEX_URL in Vercel
```

## 4) Deploy to Vercel
Run from `kk/`:

```
# Log in and link project
vercel login
vercel link  # follow prompts to create/select a project

# First deploy (Preview)
vercel

# Production deploy
vercel --prod
```

After linking, push environment variables in Vercel UI or via `vercel env`.

## 5) Backend wiring
- The frontend fetches your backend via `NEXT_PUBLIC_API_BASE_URL` (see `lib/api/client.ts`).
- Ensure your backend supports CORS for your Vercel domain(s):
  - Access-Control-Allow-Origin: https://<your-vercel-domain>
  - Access-Control-Allow-Headers: Content-Type, Authorization
  - Access-Control-Allow-Methods: GET, POST, OPTIONS
- The Convex widget endpoints in `convex/chatWidget.ts` already send permissive CORS headers for cross-origin usage.

## 6) Post-deploy checks
- Visit the Vercel URL of the app and exercise a full chat flow.
- Verify network requests target your backend domain (not localhost) in DevTools.
- If Clerk is enabled, confirm auth flows.
- If you see "model unreachable" errors from your AI provider, check API key quotas/connectivity and add retry/backoff.

## 7) Local dev env sample
Create `kk/.env.local` with entries like:

```
NEXT_PUBLIC_API_BASE_URL=http://localhost:8005
NEXT_PUBLIC_CONVEX_URL=http://localhost:ConvexWillSetThis
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_WEBHOOK_SECRET=
```

Note: `.env.local` is not committed by default.

---
If you want, we can automate `vercel link` and `vercel --prod` here once you confirm your Vercel org/team and desired project name.
