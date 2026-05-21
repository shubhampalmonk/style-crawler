# Crawler — AWS deployment guide

Deploy the **Shop Style Crawler API** on **Amazon Lightsail** (~$10/month) and run the **React frontend on your Mac**, pointed at the remote API.

### Repo layout

```text
Crawler/
├── frontend/     # React + Vite (local dev only for AWS deploy)
├── backend/      # Express API, Playwright crawler, Dockerfile
└── package.json  # npm workspaces — run scripts from repo root
```

---

## Overview

| Piece | Where it runs | Purpose |
|-------|----------------|---------|
| **API** (`backend/server/index.js` + `backend/crawler.js`) | Lightsail in Docker | Playwright crawls Shopify PDPs, returns JSON styles |
| **Frontend** (`frontend/`) | Your Mac (`npm run dev:client`) | UI preview; calls the API over HTTP |

```text
Mac (localhost:5173)  ──POST /api/crawl──►  Lightsail (PUBLIC_IP:8080)  ──►  Shopify store
```

**API base URL after deploy:**

```text
http://YOUR_LIGHTSAIL_PUBLIC_IP:8080
```

Endpoints:

- `GET /health` — liveness check
- `POST /api/crawl` — crawl a store (body: `shopUrl`, optional `storefrontPassword`)

Use the **Public IPv4** from the Lightsail console (four numbers, e.g. `52.14.89.88`). Do not use the private `172.x.x.x` address shown in SSH.

---

## How Docker, the API, and Playwright fit together

`docker run` does **not** mention Playwright because Playwright is baked in at **build** time, not at run time.

### 1. The Dockerfile starts from a Playwright image

The first line of `Dockerfile` is the whole Playwright + Chromium stack:

```dockerfile
FROM mcr.microsoft.com/playwright:v1.59.1-jammy
```

That image is maintained by Microsoft. It is Ubuntu + Node + a matching Chromium build under `/ms-playwright/`. You are not installing Chrome yourself — the base image already has it.

Then the Dockerfile copies your app and runs `npm ci`, which installs the **Node** package `playwright` (must match the image tag, e.g. `1.59.1`). The npm package is the API that drives the browser; the image supplies the actual browser binary.

### 2. `docker build` layers your code on top

```text
mcr.microsoft.com/playwright:v1.59.1-jammy   ← Chromium + OS
        +
backend/package.json + server/ + crawler.js   ← your API + crawl logic
        =
shop-crawler-api image
```

### 3. `docker run` only starts Node

Your `docker run` sets env vars and maps port `8080`. The container entrypoint is:

```dockerfile
CMD ["node", "server/index.js"]
```

So at runtime you get a normal **Express API**. No separate “Playwright container.”

### 4. A crawl request triggers Playwright inside that process

```text
Browser (your Mac)
    POST /api/crawl
        ↓
server/index.js  →  runCrawler() in crawler.js
        ↓
chromium.launch()  →  opens Chromium from /ms-playwright/...
        ↓
visits Shopify, extracts styles, returns JSON
```

Relevant wiring:

- `server/index.js` imports `runCrawler` from `crawler.js` and calls it on `POST /api/crawl`.
- `crawler.js` does `const { chromium } = require("playwright")` and `chromium.launch({ headless: true, ... })`.

Playwright only runs when someone hits `/api/crawl`, not when the container starts.

### 5. What is *not* in the container

The React UI (`frontend/`) is **not** built into this image when `API_ONLY=true`. You run the frontend locally and talk to the API over the network.

---

## Why Lightsail (not Lambda)

- The crawler uses **Playwright + Chromium** and can take **30–90 seconds** per request.
- Lambda has tight timeouts and image size limits.
- Lightsail gives a **fixed ~$10/mo** Linux VM with a simple firewall and SSH — enough for 2 GB RAM + Docker.

---

## Prerequisites

- AWS account
- This repository on your Mac
- Lightsail **$10** plan (2 GB RAM) — avoid the $5 plan (OOM risk with Chromium)
- Optional: GitHub repo for `git clone` on the server

---

## 1. Create the Lightsail instance

1. Open [AWS Lightsail](https://lightsail.aws.amazon.com/).
2. **Create instance**
   - Platform: **Linux/Unix**
   - Blueprint: **OS only** → **Ubuntu 22.04 LTS**
   - Plan: **$10 USD** (2 GB RAM, 1 vCPU)
   - Name: e.g. `shop-crawler-api`
3. Wait until status is **Running**.
4. **Networking** → **IPv4 firewall** → **Add rule**
   - Protocol: **TCP**
   - Port: **8080**
5. Copy the instance **Public IPv4** — you will use it for `curl`, Docker tests, and `frontend/.env.local`.

---

## 2. Install Docker on the server

In Lightsail → **Connect using SSH**:

```bash
sudo apt-get update
sudo apt-get install -y docker.io docker-compose-v2 git
sudo usermod -aG docker ubuntu
```

**Important:** Close the SSH tab completely, then open **Connect using SSH** again. Group membership only applies in a new session.

Verify:

```bash
docker --version
docker ps
```

If you see `permission denied` on `docker.sock`, you skipped the reconnect — run `newgrp docker` or use `sudo docker` until you reconnect.

---

## 3. Put the code on the server

### Option A — Git

```bash
cd ~
git clone YOUR_REPO_URL style-crawler
cd style-crawler
```

### Option B — Copy from your Mac

Download the Lightsail SSH key (Account → **SSH keys**), then:

```bash
cd "/Users/shubhampal/Desktop/untitled folder"
scp -i ~/Downloads/LightsailDefaultKey-*.pem -r Crawler ubuntu@YOUR_LIGHTSAIL_IP:~/style-crawler
```

On the server:

```bash
cd ~/style-crawler
```

The repo root folder name does not matter. Run `docker build` from **`backend/`** (where the `Dockerfile` lives).

---

## 4. Build and run the API container

The `Dockerfile` uses Microsoft’s Playwright image (Chromium included). **`playwright` in `package.json` must match the image tag** (currently `1.59.1` / `v1.59.1-jammy`).

On the server:

```bash
cd ~/style-crawler/backend   # or ~/Crawler/backend

docker build -t shop-crawler-api .

docker stop shop-crawler-api 2>/dev/null || true
docker rm shop-crawler-api 2>/dev/null || true

docker run -d \
  --name shop-crawler-api \
  --restart unless-stopped \
  -p 8080:8080 \
  -e NODE_ENV=production \
  -e API_ONLY=true \
  -e PORT=8080 \
  shop-crawler-api
```

Check logs:

```bash
docker logs -f shop-crawler-api
```

Expected output:

```text
API listening on http://0.0.0.0:8080
  POST http://0.0.0.0:8080/api/crawl
  GET  http://0.0.0.0:8080/health
```

Press `Ctrl+C` to leave log follow mode.

### What the container does

- **`NODE_ENV=production`** — production mode for Express
- **`API_ONLY=true`** — serves API only (no static frontend build)
- **`PORT=8080`** — listen port (mapped to host `8080`)
- **Playwright** runs **headless** in `crawler.js` (required in Docker — no display server)

---

## 5. Test the API from your Mac

Replace `YOUR_LIGHTSAIL_PUBLIC_IP`:

```bash
curl -s http://YOUR_LIGHTSAIL_PUBLIC_IP:8080/health
```

Expected: `{"ok":true}`

Crawl example (first run may take 30–90 seconds):

```bash
curl -s -X POST http://YOUR_LIGHTSAIL_PUBLIC_IP:8080/api/crawl \
  -H "Content-Type: application/json" \
  -d '{"shopUrl":"https://your-store.myshopify.com","storefrontPassword":"optional"}'
```

---

## 6. Connect the local frontend to AWS

On your Mac, from the repo root:

1. Create or edit `frontend/.env.local`:

```env
VITE_API_BASE_URL=http://YOUR_LIGHTSAIL_PUBLIC_IP:8080
```

Use the **full** Public IPv4 (four dot-separated numbers). Do not leave placeholders like `your_lightsail_public_ip` or partial values.

2. **Restart** the dev server (Vite only reads env at startup):

```bash
cd "/Users/shubhampal/Desktop/untitled folder/Crawler"
npm run dev:client
```

3. Open **http://localhost:5173**

The header should show **Backend:** `http://YOUR_IP:8080`. Click **Load** to crawl via Lightsail.

You do **not** need `npm run dev` (local API) when using the remote backend.

### Local vs remote API

| `frontend/.env.local` | Behavior |
|---------------------|----------|
| `VITE_API_BASE_URL=http://IP:8080` | Browser calls Lightsail directly |
| Empty / unset | Vite proxies `/api` to local server on port `3456` |

---

## Updating after code changes

SSH to the server, pull or copy new files, then rebuild:

```bash
cd ~/style-crawler
git pull   # if using Git
cd backend

docker build -t shop-crawler-api .
docker stop shop-crawler-api && docker rm shop-crawler-api
docker run -d \
  --name shop-crawler-api \
  --restart unless-stopped \
  -p 8080:8080 \
  -e NODE_ENV=production \
  -e API_ONLY=true \
  -e PORT=8080 \
  shop-crawler-api
```

---

## Optional configuration

### Restrict CORS

By default all origins are allowed. For a fixed frontend URL:

```bash
docker run -d \
  --name shop-crawler-api \
  --restart unless-stopped \
  -p 8080:8080 \
  -e NODE_ENV=production \
  -e API_ONLY=true \
  -e PORT=8080 \
  -e CORS_ORIGIN=https://your-frontend.com,http://localhost:5173 \
  shop-crawler-api
```

### HTTPS (later)

`http://IP:8080` is fine for local Vite. For a public HTTPS frontend, browsers block mixed content (`https` page → `http` API). Options:

- Lightsail load balancer + TLS certificate
- Cloudflare in front of the instance
- Host the frontend on HTTP for internal testing only

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|--------|-----|
| `permission denied` on `docker.sock` | User not in `docker` group | `sudo usermod -aG docker ubuntu`, **reconnect SSH**, or use `sudo docker` |
| `curl` hangs from Mac | Port **8080** not open | Lightsail → Networking → firewall rule for TCP **8080** |
| Frontend calls placeholder URL | Bad `frontend/.env.local` | Set full Public IPv4; restart `npm run dev:client` |
| `Executable doesn't exist` at `/ms-playwright/...` | Playwright npm version ≠ Docker image | Align `backend/Dockerfile` (`v1.59.1-jammy`) with `backend/package.json` (`playwright": "1.59.1"`), rebuild image |
| `Missing X server` / headed browser | Headed Chrome in container | Ensure `crawler.js` uses `headless: true`, rebuild image |
| Container exits / OOM | Too little RAM | Use **$10** (2 GB) plan, check `docker logs shop-crawler-api` |
| Crawl lands on Google / blocked | Store bot protection | Try another store/network; some guards block datacenter IPs |
| CORS error in browser | Origin not allowed | Set `CORS_ORIGIN` on `docker run` |
| Slow first `docker build` | Large Playwright base image | Normal (~1–2 GB download) |

---

## Commands cheat sheet

```bash
# Follow logs
docker logs -f shop-crawler-api

# Restart container (same image)
docker restart shop-crawler-api

# Shell into running container (debug)
docker exec -it shop-crawler-api sh

# Remove and rebuild from scratch
docker stop shop-crawler-api && docker rm shop-crawler-api
docker build -t shop-crawler-api . && docker run -d \
  --name shop-crawler-api --restart unless-stopped -p 8080:8080 \
  -e NODE_ENV=production -e API_ONLY=true -e PORT=8080 shop-crawler-api
```

---

## Cost

| Item | Approx. monthly |
|------|------------------|
| Lightsail 2 GB instance | **~$10** |
| Data transfer | Usually negligible for API + crawl traffic |

Stop or delete the instance when you are done experimenting to avoid charges.

---

## Project files reference

| File | Role |
|------|------|
| `backend/Dockerfile` | Playwright base image + `npm ci` + API entrypoint |
| `backend/crawler.js` | Playwright crawl logic (headless in production) |
| `backend/server/index.js` | Express API (`/health`, `/api/crawl`) |
| `frontend/.env.local` | `VITE_API_BASE_URL` for local UI → AWS API |
| `backend/package.json` | `playwright` version must match `backend/Dockerfile` tag |

For API request/response shape, see **CLAUDE.md** in the repo root.
