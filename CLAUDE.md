# Papermark — Self-Hosted Fork

This is a self-hosted fork of Papermark deployed at `dataroom.syntaxia.com`.

## Architecture Decisions

### Services replaced from upstream Papermark

| Upstream | Self-Hosted Replacement | Why |
|---|---|---|
| Vercel hosting | DigitalOcean droplet + Kamal 2 | Self-host compute |
| Vercel Blob | AWS S3 (`NEXT_PUBLIC_UPLOAD_TRANSPORT=s3`) | Already have AWS account |
| Upstash Redis | Self-hosted Redis + SRH (Upstash-compatible REST proxy) | Zero code changes needed |
| Upstash QStash | `node-cron` in-process scheduler + direct fetch for webhooks | Cron routes already skip QStash verification when `VERCEL !== "1"` |
| Resend | Nodemailer SMTP via AWS SES | Single-file swap in `lib/resend.ts`, nodemailer was already a dependency |
| Stripe billing | Disabled — all teams default to `datarooms-premium` plan | Self-hosted = unlimited access for all users |

### Services kept as SaaS

| Service | Why kept |
|---|---|
| Tinybird | Deeply integrated (5 ingest endpoints, 18 query pipes, 15+ API routes). Migration to PostHog planned as follow-up. |
| Trigger.dev | Critical for document processing pipeline (21+ tasks). No viable self-host alternative without major refactoring. |
| Google OAuth | Standard OAuth provider |
| OpenAI | AI document indexing for dataroom agents |

### Key code changes from upstream

- **`next.config.mjs`**: Added `output: "standalone"`, removed `VERCEL_ENV` dependencies, conditional host-based rules
- **`middleware.ts`**: Added `NEXT_PUBLIC_APP_BASE_HOST` to domain exclusion list
- **`lib/resend.ts`**: Rewritten from Resend SDK to Nodemailer SMTP. `subscribe()`/`unsubscribe()` are no-ops.
- **`lib/webhook/send-webhooks.ts`**: Replaced QStash with direct fetch + exponential backoff retry
- **`lib/cron/index.ts`**: Removed QStash client export, kept receiver/limiter
- **`lib/cron/scheduler.ts`** + **`instrumentation.ts`**: node-cron scheduler started via Next.js instrumentation hook when `SELF_HOSTED=1`
- **`ee/limits/server.ts`**: Returns unlimited access when `SELF_HOSTED=1`
- **`prisma/schema/team.prisma`**: Default plan changed to `datarooms-premium`
- **`lib/hanko.ts`**: Made optional (returns null without env vars)
- **`lib/integrations/slack/env.ts`**: Returns null instead of throwing when Slack env vars missing
- **`lib/tinybird/pipes.ts` + `publish.ts`**: Added `TINYBIRD_BASE_URL` for regional endpoint support
- **`pages/api/auth/[...nextauth].ts`**: Fixed secure cookies for HTTPS, added `ALLOWED_EMAIL_DOMAIN` restriction, conditional passkey provider
- **`app/(auth)/login/page-client.tsx`**: Info banner showing allowed email domain
- **`trigger.config.ts`**: Project ID from env var, prisma extension with `mode: "legacy"` for v4

### Docker build

- `Dockerfile` uses multi-stage build (deps → builder → runner)
- OpenSSL installed in all stages (Prisma requirement)
- Prisma schema copied before `npm ci` (postinstall hook runs `prisma generate`)
- `NEXT_PUBLIC_*` vars passed as build args (baked into client bundle)
- Dummy env vars set during build to prevent module-level SDK throws during Next.js page data collection
- `CMD` uses `node node_modules/prisma/build/index.js migrate deploy` (npx not available in standalone)

### Important env vars

- `SELF_HOSTED=1` — enables unlimited plan bypass and cron scheduler
- `ALLOWED_EMAIL_DOMAIN=syntaxia.com` — restricts sign-in to @syntaxia.com
- `NEXT_PUBLIC_ALLOWED_EMAIL_DOMAIN=syntaxia.com` — shows domain restriction on login page
- `TRIGGER_VERSION` — must match the deployed Trigger.dev version (stored in 1Password, update after each `npx trigger.dev deploy`)

### Deployment flow

1. Push to `main` triggers GitHub Actions workflow
2. Workflow boots Kamal accessories (db, redis, redis-locker, srh, srh-locker) first
3. Then runs `kamal deploy` which builds Docker image, pushes to local registry, deploys to droplet
4. Kamal proxy health-checks `/api/health` on port 3000
5. Container runs `prisma migrate deploy` then `node server.js`

### Trigger.dev task deployment (separate from app deploy)

Tasks must be deployed separately when files in `lib/trigger/` or `ee/features/ai/lib/trigger/` change:

```bash
TRIGGER_PROJECT_ID=$(op read "op://shxzhyefse7nv2aq4ckrtlqxte/Trigger.dev/PROJECT_ID") \
OPENAI_API_KEY=$(op read "op://shxzhyefse7nv2aq4ckrtlqxte/OpenAI Key/credential") \
npx trigger.dev@latest deploy --env production
```

Then update 1Password: `op item edit "Trigger.dev" --vault "Papermark" "VERSION=<new-version>"`

### Gotchas

- SRH listens on port 80 (not 8079) — Redis URLs must use port 80
- S3 bucket needs CORS configured for `https://dataroom.syntaxia.com` (PUT, POST, GET, HEAD)
- Postgres port 5432 is exposed publicly for Trigger.dev cloud tasks (auth via strong password)
- `extractEmailDomain()` returns domain with `@` prefix — strip it when comparing
- Many upstream modules throw at import time without env vars — dummy build-time values in Dockerfile prevent this
- `resend` export in `lib/resend.ts` is now `true | null` (truthy check for SMTP configured)
- Year-in-review `resend.batch.send()` replaced with sequential `sendEmail()` calls
