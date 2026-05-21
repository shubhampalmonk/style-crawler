const fs = require("fs");
const path = require("path");
const express = require("express");
const cors = require("cors");
const { runCrawler } = require("../crawler");

const app = express();
const isProd = process.env.NODE_ENV === "production";
const apiOnly = process.env.API_ONLY === "true" || process.env.API_ONLY === "1";
const PORT = Number(process.env.PORT) || (isProd ? 8080 : 3456);

const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map(s => s.trim()).filter(Boolean)
  : true;
app.use(cors({ origin: corsOrigins }));
app.use(express.json({ limit: "2mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/crawl", async (req, res) => {
  const shopUrl = req.body?.shopUrl || req.body?.url;
  const storefrontPassword = req.body?.storefrontPassword || req.body?.password;
  if (!shopUrl || !String(shopUrl).trim()) {
    return res.status(400).json({ ok: false, error: "Missing shopUrl" });
  }
  try {
    const data = await runCrawler(shopUrl, { storefrontPassword });
    if (data && data.ok === false) {
      return res.status(400).json(data);
    }
    return res.json(data);
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message || String(e) });
  }
});

const dist = path.join(__dirname, "../../frontend/dist");
const serveClient =
  !apiOnly && isProd && fs.existsSync(path.join(dist, "index.html"));
if (serveClient) {
  app.use(express.static(dist));
  app.get("*", (req, res) => {
    if (req.path.startsWith("/api")) return res.status(404).json({ error: "Not found" });
    return res.sendFile(path.join(dist, "index.html"));
  });
}

app.listen(PORT, "0.0.0.0", () => {
  const base = `http://0.0.0.0:${PORT}`;
  if (serveClient) {
    console.log(`App: ${base}/`);
  } else {
    console.log(`API listening on ${base}`);
    console.log(`  POST ${base}/api/crawl`);
    console.log(`  GET  ${base}/health`);
  }
});
