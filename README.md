<div align="center">
  <h1 align="center">Papermark</h1>
  <h3>The open-source DocSend alternative.</h3>

<a target="_blank" href="https://www.producthunt.com/posts/papermark-3?utm_source=badge-top-post-badge&amp;utm_medium=badge&amp;utm_souce=badge-papermark"><img src="https://api.producthunt.com/widgets/embed-image/v1/top-post-badge.svg?post_id=411605&amp;theme=light&amp;period=daily" alt="Papermark - The open-source DocSend alternative | Product Hunt" style="width:250px;height:40px"></a>

</div>

<div align="center">
  <a href="https://www.papermark.com">papermark.com</a>
</div>

<br/>

<div align="center">
  <a href="https://github.com/mfts/papermark/stargazers"><img alt="GitHub Repo stars" src="https://img.shields.io/github/stars/mfts/papermark"></a>
  <a href="https://twitter.com/papermarkio"><img alt="Twitter Follow" src="https://img.shields.io/twitter/follow/papermarkio"></a>
  <a href="https://github.com/mfts/papermark/blob/main/LICENSE"><img alt="License" src="https://img.shields.io/badge/license-AGPLv3-purple"></a>
</div>

<br/>

Papermark is the open-source document-sharing alternative to DocSend, featuring built-in analytics and custom domains.

## Features

- **Shareable Links:** Share your documents securely by sending a custom link.
- **Custom Branding:** Add a custom domain and your own branding.
- **Analytics:** Gain insights through document tracking and soon page-by-page analytics.
- **Self-hosted, Open-source:** Host it yourself and customize it as needed.

## Demo

![Papermark Welcome GIF](.github/images/papermark-welcome.gif)

## Deployment

This fork is deployed to a DigitalOcean droplet at `dataroom.syntaxia.com` using [Kamal 2](https://kamal-deploy.org/) for Docker deployment, [1Password](https://1password.com/) for secret management, and GitHub Actions for CI/CD.

### Self-Hosted Infrastructure

| Component | How |
|---|---|
| Compute | DigitalOcean droplet (4 vCPU / 8GB RAM recommended), Docker via Kamal |
| Database | PostgreSQL 17 (Kamal accessory, port 5432 exposed for Trigger.dev) |
| Redis | Self-hosted Redis x2 (main + locker) + [SRH](https://github.com/hiett/serverless-redis-http) x2 (Upstash-compatible REST proxy) |
| Email | SMTP via AWS SES / Nodemailer (replaced Resend) |
| File Storage | AWS S3 (private bucket `dataroom.syntaxia.com`, presigned URLs, CORS configured) |
| Cron Jobs | `node-cron` in-process scheduler via Next.js instrumentation hook (replaced QStash) |
| SSL | Auto-provisioned via Kamal proxy (Let's Encrypt) |
| Billing | Disabled — all users default to `datarooms-premium` plan with unlimited access |
| Auth | Google OAuth only, restricted to `@syntaxia.com` email domain |

### External Dependencies (SaaS)

| Service | Purpose | Required |
|---|---|---|
| [Tinybird](https://tinybird.co) | Document view analytics (page duration, video, clicks). US-East region, base URL configured via `TINYBIRD_BASE_URL`. | Yes |
| [Trigger.dev](https://trigger.dev) | Background jobs (doc conversion, PDF-to-images, bulk downloads, video optimization, AI indexing). Tasks deployed separately via CLI. | Yes |
| [OpenAI](https://platform.openai.com) | AI document processing and indexing for dataroom agents | Optional |
| [Google Cloud](https://console.cloud.google.com) | OAuth credentials for login | Yes |

### Secrets

All secrets are stored in the **1Password vault "Papermark"** and fetched at deploy time via the 1Password CLI. The GitHub Actions workflow uses a service account token (`OP_SERVICE_ACCOUNT_TOKEN` repo secret) to authenticate.

| Vault Item | Fields |
|---|---|
| Server IP | `ip` |
| Deploy SSH Key | `private key` |
| Database Credentials | `DB_USERNAME`, `DB_PASSWORD`, `POSTGRES_DB` |
| Auth Credentials | `NEXTAUTH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| SMTP Credentials | `SMTP_SERVER`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `MAILER_FROM` |
| Redis SRH | `SRH_TOKEN`, `SRH_LOCKER_TOKEN` |
| Tinybird | `credential`, `url` |
| Trigger.dev | `SECRET_KEY`, `PROJECT_ID`, `VERSION` |
| OpenAI Key | `credential` |
| AWS S3 | `ACCESS_KEY_ID`, `SECRET_ACCESS_KEY`, `BUCKET_NAME`, `REGION`, `DISTRIBUTION_HOST` |
| App Secrets | `DOCUMENT_PASSWORD_KEY`, `VERIFICATION_SECRET`, `INTERNAL_API_KEY` |

### Trigger.dev Task Deployment

Trigger.dev tasks run on their cloud, not on the droplet. They must be deployed separately after code changes to task files in `lib/trigger/` or `ee/features/ai/lib/trigger/`.

```bash
# Deploy tasks to production
TRIGGER_PROJECT_ID=$(op read "op://shxzhyefse7nv2aq4ckrtlqxte/Trigger.dev/PROJECT_ID") \
OPENAI_API_KEY=$(op read "op://shxzhyefse7nv2aq4ckrtlqxte/OpenAI Key/credential") \
npx trigger.dev@latest deploy --env production
```

After deploying, update the version in 1Password so the app locks runs to the correct deployment:

```bash
op item edit "Trigger.dev" --vault "Papermark" "VERSION=<new-version>"
```

Then redeploy the app to pick up the new version.

**Trigger.dev environment variables** (set in Trigger.dev dashboard > Settings > Environment Variables > Production):

| Variable | Value |
|---|---|
| `DATABASE_URL` | `postgresql://papermark:<password>@<droplet-ip>:5432/papermark` |
| `OPENAI_API_KEY` | from 1Password |
| `INTERNAL_API_KEY` | from 1Password |
| `NEXT_PUBLIC_BASE_URL` | `https://dataroom.syntaxia.com` |
| `NEXT_PRIVATE_UPLOAD_BUCKET` | `dataroom.syntaxia.com` |
| `NEXT_PRIVATE_UPLOAD_ACCESS_KEY_ID` | from 1Password |
| `NEXT_PRIVATE_UPLOAD_SECRET_ACCESS_KEY` | from 1Password |
| `NEXT_PRIVATE_UPLOAD_REGION` | `us-east-1` |
| `NEXT_PUBLIC_UPLOAD_TRANSPORT` | `s3` |

### S3 Bucket Configuration

- **Bucket**: `dataroom.syntaxia.com` in `us-east-1`
- **Access**: Private (files served via presigned URLs, not public)
- **CORS**: Configured to allow uploads from `https://dataroom.syntaxia.com`
- **IAM User**: `papermark-s3` with scoped policy (GetObject, PutObject, DeleteObject, multipart)

### Droplet Setup

- **SSH**: `deploy` user with key-based auth (`ssh papermark` via ~/.ssh/config)
- **Docker**: Installed, `deploy` user in docker group
- **Firewall (ufw)**: Ports 22 (SSH), 80 (HTTP), 443 (HTTPS), 5432 (Postgres for Trigger.dev)

## Tech Stack

- [Next.js](https://nextjs.org/) – Framework
- [TypeScript](https://www.typescriptlang.org/) – Language
- [Tailwind](https://tailwindcss.com/) – CSS
- [shadcn/ui](https://ui.shadcn.com) - UI Components
- [Prisma](https://prisma.io) - ORM [![Made with Prisma](https://made-with.prisma.io/dark.svg)](https://prisma.io)
- [PostgreSQL](https://www.postgresql.org/) - Database
- [NextAuth.js](https://next-auth.js.org/) – Authentication
- [Tinybird](https://tinybird.co) – Analytics
- [Trigger.dev](https://trigger.dev) – Background Jobs
- [AWS S3](https://aws.amazon.com/s3/) – File Storage
- [AWS SES](https://aws.amazon.com/ses/) – Email (SMTP)

## Local Development

### Prerequisites

- Node.js (version >= 18.17.0)
- PostgreSQL Database
- SMTP credentials (for sending emails)

### 1. Clone the repository

```shell
git clone https://github.com/mfts/papermark.git
cd papermark
```

### 2. Install npm dependencies

```shell
npm install
```

### 3. Copy the environment variables to `.env` and change the values

```shell
cp .env.example .env
```

### 4. Initialize the database

```shell
npm run dev:prisma
```

### 5. Run the dev server

```shell
npm run dev
```

### 6. Open the app in your browser

Visit [http://localhost:3000](http://localhost:3000) in your browser.

## Tinybird Instructions

To prepare the Tinybird database, follow these steps:

0. We use `pipenv` to manage our Python dependencies. If you don't have it installed, you can install it using the following command:
   ```sh
   pkgx pipenv
   ```
1. Download the Tinybird CLI from [here](https://www.tinybird.co/docs/cli.html) and install it on your system.
2. After authenticating with the Tinybird CLI, navigate to the `lib/tinybird` directory:
   ```sh
   cd lib/tinybird
   ```
3. Push the necessary data sources using the following command:
   ```sh
   tb push datasources/*
   tb push endpoints/get_*
   ```
4. Don't forget to set the `TINYBIRD_TOKEN` with the appropriate rights in your `.env` file.

#### Updating Tinybird

```sh
pipenv shell
## start: pkgx-specific
cd ..
cd papermark
## end: pkgx-specific
pipenv update tinybird-cli
```

## Contributing

Papermark is an open-source project, and we welcome contributions from the community.

If you'd like to contribute, please fork the repository and make any changes you'd like. Pull requests are warmly welcome.

### Our Contributors

<a href="https://github.com/mfts/papermark/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=mfts/papermark" />
</a>
