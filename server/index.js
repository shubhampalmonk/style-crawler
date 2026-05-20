const path = require("path");
const express = require("express");
const cors = require("cors");
const { runCrawler } = require("../crawler");

const app = express();
const PORT = process.env.PORT || 3456;
const isProd = process.env.NODE_ENV === "production";

app.use(cors());
app.use(express.json({ limit: "2mb" }));

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

if (isProd) {
  const dist = path.join(__dirname, "../client/dist");
  app.use(express.static(dist));
  app.get("*", (req, res) => {
    if (req.path.startsWith("/api")) return res.status(404).json({ error: "Not found" });
    return res.sendFile(path.join(dist, "index.html"));
  });
}

app.listen(PORT, () => {
  if (!isProd) {
    console.log(`API: http://127.0.0.1:${PORT}/api/crawl`);
  } else {
    console.log(`App: http://127.0.0.1:${PORT}/`);
  }
});
