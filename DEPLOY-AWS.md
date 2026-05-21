# Deploy backend only on AWS (cheapest beginner path)

**Plan:** One small **Amazon Lightsail** Linux server (~**$10/month**, 2 GB RAM) running your API in Docker.

**Why this (and not Lambda / App Runner)?**

- Your API runs **Playwright + Chromium** and can take **up to ~90 seconds** per request.
- Lambda + API Gateway are a bad fit (size limits, 29s timeout).
- Lightsail is a **fixed price**, simple console, no VPC/ECS learning curve.

**Your API URL after deploy:**

```text
http://YOUR_LIGHTSAIL_IP:8080/api/crawl
```

Use that as `VITE_API_BASE_URL` when you run the React app locally or host the frontend elsewhere.

---

## What you need

- AWS account (card required; Lightsail has a free trial on some accounts)
- This repo on your Mac
- ~30 minutes first time

---

## Part 1 — Create the Lightsail server

1. Open [AWS Lightsail](https://lightsail.aws.amazon.com/).
2. **Create instance**
   - Platform: **Linux/Unix**
   - Blueprint: **OS only** → **Ubuntu 22.04 LTS**
   - Plan: **$10 USD** (2 GB RAM, 1 vCPU) — **do not use $5**; Playwright often needs more than 1 GB
   - Name: e.g. `shop-crawler-api`
3. **Create instance** and wait until status is **Running**.
4. Open the instance → tab **Networking** → **IPv4 firewall** → **Add rule**:
   - Application: **Custom**
   - Protocol: **TCP**
   - Port: **8080**
   - Save
5. Note the **Public IP** (e.g. `3.15.42.10`). That is your API host.

---

## Part 2 — Install Docker on the server (browser SSH)

1. In Lightsail, open your instance → **Connect using SSH** (browser terminal opens).
2. Run:

```bash
sudo apt-get update
sudo apt-get install -y docker.io docker-compose-v2 git
sudo usermod -aG docker ubuntu
```

3. **Close the SSH tab**, open **Connect using SSH** again (so `docker` group applies).

4. Verify:

```bash
docker --version
```

---

## Part 3 — Put your code on the server

**Option A — Git (if the repo is on GitHub)**

```bash
cd ~
git clone YOUR_REPO_URL Crawler
cd Crawler
```

**Option B — Copy from your Mac (no GitHub)**

On your Mac (replace `YOUR_LIGHTSAIL_IP`):

```bash
cd "/Users/shubhampal/Desktop/untitled folder"
scp -i ~/Downloads/LightsailDefaultKey-*.pem -r Crawler ubuntu@YOUR_LIGHTSAIL_IP:~/Crawler
```

Download the SSH key from Lightsail → Account → **SSH keys** if you use `scp`.

On the server:

```bash
cd ~/Crawler
```

---

## Part 4 — Build and run the API container

On the Lightsail SSH session:

```bash
cd ~/Crawler
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

You should see: `API listening on http://0.0.0.0:8080`

---

## Part 5 — Test the API

On your Mac:

```bash
curl -s http://YOUR_LIGHTSAIL_IP:8080/health
# {"ok":true}

curl -s -X POST http://YOUR_LIGHTSAIL_IP:8080/api/crawl \
  -H "Content-Type: application/json" \
  -d '{"shopUrl":"https://shubhammonktest.myshopify.com","storefrontPassword":"YOUR_PASSWORD"}'
```

First crawl may take 30–90 seconds.

---

## Part 6 — Point your local frontend at AWS

On your Mac, in `Crawler/client`:

```bash
echo 'VITE_API_BASE_URL=http://YOUR_LIGHTSAIL_IP:8080' > .env.local
cd ..
npm run dev:client
```

Open the Vite URL (usually `http://localhost:5173`) and run a crawl — requests go to Lightsail.

---

## Updating the API after code changes

SSH to the server:

```bash
cd ~/Crawler
git pull   # if using git
docker build -t shop-crawler-api .
docker stop shop-crawler-api && docker rm shop-crawler-api
docker run -d --name shop-crawler-api --restart unless-stopped -p 8080:8080 \
  -e NODE_ENV=production -e API_ONLY=true -e PORT=8080 shop-crawler-api
```

---

## Optional: HTTPS (later)

Browsers on **https** sites cannot call **http** APIs (mixed content). For production:

- Add a domain, point DNS to Lightsail static IP ($0 extra for static IP on Lightsail).
- Use [Lightsail load balancer + certificate](https://lightsail.aws.amazon.com/ls/docs/en_us/articles/amazon-lightsail-https-load-balancers) (~$18/mo extra), **or**
- Put **Cloudflare** in front with “Flexible” SSL and tunnel to port 8080.

For dev/testing, `http://IP:8080` from local Vite is fine.

---

## Optional: lock down CORS

By default the API allows all origins (fine for testing). When your frontend has a fixed URL:

```bash
docker run -d ... \
  -e CORS_ORIGIN=https://your-frontend.com,http://localhost:5173 \
  shop-crawler-api
```

---

## Cost summary

| Item | Approx. monthly |
|------|------------------|
| Lightsail 2 GB instance | **$10** |
| Outbound data | First 1 TB included in plan; crawls are small |
| **Total** | **~$10/mo** while the instance runs |

**Save money:** Stop the instance in Lightsail when not using it (you pay storage only while stopped on some plans — check current Lightsail billing). Delete the instance when done experimenting.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `permission denied` on `docker.sock` | Run `sudo usermod -aG docker $USER`, then **disconnect SSH completely** and reconnect (or run `newgrp docker`). Until then, prefix commands with `sudo` (e.g. `sudo docker build ...`). |
| `curl` hangs / times out | Firewall rule for **8080** missing on Lightsail networking |
| Container exits immediately | `docker logs shop-crawler-api` |
| `Browser closed` / OOM | Use **$10** plan (2 GB), not $5 |
| Playwright `Executable doesn't exist` / version mismatch | `Dockerfile` base image tag must match `playwright` in `package.json` (e.g. `v1.59.1-jammy`), then rebuild the image on the server |
| CORS error in browser | Set `CORS_ORIGIN` to your frontend origin |
| Build slow on server | Normal first time; image is ~1–2 GB |

---

## Commands cheat sheet

```bash
# Logs
docker logs -f shop-crawler-api

# Restart
docker restart shop-crawler-api

# Rebuild after pull
docker build -t shop-crawler-api . && docker restart shop-crawler-api
```
