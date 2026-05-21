# Shop style crawler

Monorepo with separate **frontend** and **backend** packages.

## Project layout

```text
Crawler/
├── frontend/          # React + Vite UI
├── backend/           # Express API + Playwright crawler
│   ├── server/
│   ├── crawler.js
│   └── Dockerfile     # AWS / Docker deploy
└── package.json       # workspace scripts
```

## Local development

**API + UI together:**

```bash
npm install
npm run dev
```

**Frontend only** (API on AWS or elsewhere):

```bash
# frontend/.env.local → VITE_API_BASE_URL=http://YOUR_IP:8080
npm run dev:client
```

**Backend only:**

```bash
npm run dev:server
```

## AWS deploy

See **[DEPLOYMENT-GUIDE.md](./DEPLOYMENT-GUIDE.md)** (~$10/mo Lightsail).

```bash
npm run docker:build   # builds from ./backend
```

## CLI crawl (no server)

```bash
npm run crawl -- https://your-store.myshopify.com
```
