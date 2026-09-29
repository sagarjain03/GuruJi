# GuruJi

A personal DSA training system. It tracks what you are weak at and tells you what
to practise next.

```
apps/api           NestJS · REST + one WebSocket namespace · the only DB writer
apps/code-runner   BullMQ worker · runs user code in Docker sandboxes
apps/web           Next.js App Router · Monaco editor
packages/types     Zod schemas shared by all three
packages/database  Prisma schema, client, migrations, seed
docs/              Design docs — start at docs/README.md
```

---

## Local setup

**Prerequisites:** Node ≥ 22, pnpm ≥ 10, Docker Desktop **running**.

```bash
git clone https://github.com/sagarjain03/GuruJi.git
cd GuruJi
pnpm install
cp .env.example .env                              # fill in the values
pnpm infra:up                                     # Postgres + Redis
pnpm db:migrate
pnpm db:seed
pnpm --filter @guruji/code-runner images:build    # sandbox images, one per language
pnpm dev                                          # web on :3000, api on :4000
```

More commands and the rules for contributing: [docs/contributing.md](docs/contributing.md).

---

## Deploying for free

Only `apps/web` can run on Vercel. The API needs a long-running process for its
WebSocket, and the code runner needs a Docker daemon, which Vercel does not
provide. Those two, plus Postgres and Redis, run on one free VM.

| Part | Where | Cost |
|---|---|---|
| `apps/web` | Vercel Hobby | Free, non-commercial use only |
| API, runner, Postgres, Redis | Oracle Cloud Always Free VM (ARM) | Free, card verification at signup |
| HTTPS hostname | DuckDNS subdomain + Caddy | Free |
| AI | Groq free tier | Free, rate-limited |

Free-tier limits change. Check each provider's pricing page before you sign up.

> **Status:** step 7 below (the Vercel rewrite and `NEXT_PUBLIC_WS_URL`) is not
> in the code yet. Until it lands, the free setup cannot keep users logged in.

### 1. Create the VM

- Oracle Cloud → **Compute → Create Instance**
- Image **Ubuntu 24.04**, shape **VM.Standard.A1.Flex**, 2–4 OCPU, 12–24 GB RAM
- In the VCN's Security List, open ports **80** and **443**

Oracle's Ubuntu image also runs its own iptables firewall. Open the ports there too:

```bash
sudo iptables -I INPUT 6 -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save
```

### 2. Point a hostname at it

On [duckdns.org](https://www.duckdns.org), claim a subdomain (for example
`guruji.duckdns.org`) and set it to the VM's public IP.

### 3. Install the tools

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER                 # log out and back in
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs caddy
sudo npm i -g pnpm@10 pm2
```

### 4. Configure

```bash
git clone https://github.com/sagarjain03/GuruJi.git && cd GuruJi
cp .env.example .env
```

Change at least these values in `.env`:

```
NODE_ENV=production
POSTGRES_PASSWORD=<strong password — use the same one in DATABASE_URL>
JWT_ACCESS_SECRET=<openssl rand -base64 48>
JWT_REFRESH_SECRET=<a different one>
CODE_RUNNER_SHARED_SECRET=<a different one>
CORS_ORIGINS=https://<your-project>.vercel.app
GROQ_API_KEY=<your key>
```

Do not leave any secret at its `.env.example` value, and never commit `.env`.
`NODE_ENV=production` is required: it is what marks the refresh cookie `Secure`.

### 5. Build, migrate, start

```bash
pnpm install
pnpm infra:up
pnpm --filter @guruji/database exec prisma migrate deploy
pnpm db:seed
pnpm build
pnpm --filter @guruji/code-runner images:build   # built on the VM, so arm64

pm2 start "pnpm --filter @guruji/api start" --name api
pm2 start "pnpm --filter @guruji/code-runner start" --name runner
pm2 save && pm2 startup
```

Use `prisma migrate deploy` here, not `pnpm db:migrate`. The latter runs
`prisma migrate dev`, which is for development only.

### 6. HTTPS with Caddy

`/etc/caddy/Caddyfile`:

```
guruji.duckdns.org {
    reverse_proxy localhost:4000
}
```

```bash
sudo systemctl reload caddy
```

Caddy gets the certificate itself and passes WebSocket upgrades through.
`https://guruji.duckdns.org/api/health` should now respond.

### 7. Why the web app proxies the API

The refresh token is an `httpOnly` cookie with `SameSite=Strict`.
`*.vercel.app` and `*.duckdns.org` are different sites, so the browser would
never send that cookie to the API, and users would be logged out when the
15-minute access token expires.

The fix is to keep REST on the web app's own origin:

- `apps/web/vercel.json` rewrites `/api/*` to `https://guruji.duckdns.org/api/*`,
  so the browser only ever talks to the Vercel origin and the cookie is first-party.
- The WebSocket connects straight to the VM through `NEXT_PUBLIC_WS_URL`.
  Rewrites do not carry WebSockets, and the socket does not need the cookie:
  it authenticates with the access token in its handshake.

If you own a domain, you do not need this step. Put the web app on
`app.example.com` and the API on `api.example.com`. They are the same site, so
the strict cookie works as-is.

### 8. Deploy the web app on Vercel

**Add New → Project**, import the repository, then:

| Setting | Value |
|---|---|
| Root Directory | `apps/web` |
| Build Command | `cd ../.. && pnpm --filter "@guruji/web..." build` |
| Node.js Version | 22.x |

The build command builds `@guruji/types` and `@guruji/algorithms` first. Both
export from `dist/`, so the web build fails without them.

Environment variables:

```
NEXT_PUBLIC_API_URL=https://<your-project>.vercel.app/api
NEXT_PUBLIC_WS_URL=https://guruji.duckdns.org
NEXT_PUBLIC_SITE_URL=https://<your-project>.vercel.app
NEXT_PUBLIC_APP_NAME=GuruJi
```

`NEXT_PUBLIC_*` values are compiled into the bundle, and the Content Security
Policy is built from them. Redeploy after changing any of them. Never put
`GROQ_API_KEY` or any other secret in Vercel.

### 9. Check it works

- Sign up, log in, wait more than 15 minutes, then reload. You should still be logged in.
- Submit a solution. The verdict should arrive live.
- The browser console should show no CSP or CORS errors.
