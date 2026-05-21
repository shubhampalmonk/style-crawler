import { useState } from "react";

const defaultUrl = "https://shubhammonktest.myshopify.com";

function textSnapToStyle(s) {
  if (!s) return {};
  return {
    color: s.color,
    backgroundColor: s.background,
    backgroundImage:
      s.backgroundImage &&
      s.backgroundImage !== "none" &&
      s.backgroundImage !== "initial"
        ? s.backgroundImage
        : undefined,
    fontFamily: s.fontFamily,
    fontSize: s.fontSize,
    fontStyle: s.fontStyle,
    fontWeight: s.fontWeight,
    lineHeight: s.lineHeight,
    letterSpacing: s.letterSpacing,
    textAlign: s.textAlign,
    textTransform: s.textTransform,
    textDecoration: s.textDecoration,
    margin: s.margin,
    padding: s.padding,
  };
}

function productAreaStyle(s) {
  if (!s) {
    return {
      padding: 20,
      background: "#f4f4f2",
      borderRadius: 12,
      border: "1px solid #e5e5e0",
    };
  }
  return {
    backgroundColor: s.background,
    backgroundImage:
      s.backgroundImage &&
      s.backgroundImage !== "none" &&
      s.backgroundImage !== "initial"
        ? s.backgroundImage
        : undefined,
    color: s.color,
    fontFamily: s.fontFamily,
    padding: s.padding,
    borderRadius: s.borderRadius,
    border: s.border,
    boxShadow: s.boxShadow,
  };
}

function atcToStyle(a) {
  if (!a) {
    return {
      padding: "12px 24px",
      background: "#1a1a1a",
      color: "#fff",
      border: "none",
      borderRadius: 4,
    };
  }
  return {
    color: a.color,
    backgroundColor: a.background,
    fontFamily: a.fontFamily,
    fontSize: a.fontSize,
    fontStyle: a.fontStyle,
    fontWeight: a.fontWeight,
    lineHeight: a.lineHeight,
    letterSpacing: a.letterSpacing,
    textTransform: a.textTransform,
    textDecoration: a.textDecoration,
    padding: a.padding,
    margin: a.margin,
    border: a.border,
    borderRadius: a.borderRadius,
    boxShadow: a.boxShadow,
    outline: a.outline,
    minWidth: a.minWidth,
    minHeight: a.minHeight,
    cursor: "default",
  };
}

function DomValue({ value }) {
  if (value == null || value === "") {
    return <span className="dom-empty">—</span>;
  }
  return <code className="dom-str">{value}</code>;
}

export default function App() {
  const [url, setUrl] = useState(defaultUrl);
  const [storefrontPassword, setStorefrontPassword] = useState("shubhammonktest");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function run() {
    setErr("");
    setData(null);
    if (!url.trim()) {
      setErr("Enter a store URL.");
      return;
    }
    setLoading(true);
    try {
      const apiBase = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");
      const res = await fetch(`${apiBase}/api/crawl`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopUrl: url.trim(),
          storefrontPassword: storefrontPassword.trim() || undefined,
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        setErr(j.error || res.statusText);
        return;
      }
      setData(j);
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }

  const pdp = data?.pdp;
  const atc = data?.atc?.atcStyles;
  const titleText = pdp?.title?.text ?? null;
  const priceText = pdp?.price?.text ?? null;
  const atcText = atc?.text ?? null;

  return (
    <div className="app">
      <header className="app-header">
        <h1>PDP copy vs store styles</h1>
        <p>
          Main block:{" "}
          <code className="inline">
            [id^=&quot;shopify-section&quot;][id*=&quot;main&quot;]
          </code>
          . Inside: <code className="inline">h1</code>, price (first{" "}
          <code className="inline">.price .money</code> /{" "}
          <code className="inline">span.money</code> / …),{" "}
          <code className="inline">form[action*=&quot;/cart/add&quot;]</code> +{" "}
          <code className="inline">button|input[type=submit]</code>.
        </p>
        <div className="form-row">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && run()}
            placeholder="https://store.myshopify.com"
            aria-label="Store URL"
          />
          <input
            type="text"
            value={storefrontPassword}
            onChange={(e) => setStorefrontPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && run()}
            placeholder="Storefront password (optional)"
            aria-label="Storefront password"
          />
          <button type="button" onClick={run} disabled={loading}>
            {loading ? "Loading…" : "Load"}
          </button>
        </div>
        {err ? <p className="status err">{err}</p> : null}
        {data && !err && !loading ? (
          <p className="status">
            {data.pdpUrl && (
              <>
                <span className="status-label">Page</span> {data.pdpUrl}
              </>
            )}
            {data.collectionFallbackUrl ? (
              <span className="status-note">
                {" "}
                · Via collection: {data.collectionFallbackUrl}
              </span>
            ) : null}
            {data.note ? (
              <span className="status-note"> — {data.note}</span>
            ) : null}
          </p>
        ) : null}
      </header>

      <main className="pdp-wrap">
        {pdp ? (
          <div className="compare">
            <section className="compare-panel compare-plain">
              <h2>Strings from the DOM</h2>
              <p className="compare-hint">
                Use this to check we read the same text the page shows.
              </p>
              <dl className="dom-dl">
                <dt>Title (h1)</dt>
                <dd>
                  <DomValue value={titleText} />
                </dd>
                <dt>Price</dt>
                <dd>
                  <DomValue value={priceText} />
                </dd>
                <dt>ATC (submit)</dt>
                <dd>
                  <DomValue value={atcText} />
                </dd>
              </dl>
            </section>

            <section className="compare-panel compare-styled">
              <h2>Same strings + captured computed styles</h2>
              <p className="compare-hint">
                This block uses only the JSON values below — compare to the live
                product page.
              </p>
              <div
                className="styled-box"
                style={productAreaStyle(pdp.productArea)}
              >
                {pdp.title && (
                  <h1 className="preview-h1" style={textSnapToStyle(pdp.title)}>
                    {titleText || ""}
                  </h1>
                )}
                {!pdp.title && (
                  <p className="compare-miss">No h1 in main block</p>
                )}

                {pdp.price && (
                  <p
                    className="preview-price"
                    style={textSnapToStyle(pdp.price)}
                  >
                    {priceText || ""}
                  </p>
                )}
                {!pdp.price && (
                  <p className="compare-miss">No price node matched</p>
                )}

                {atc && (
                  <div className="preview-cta">
                    <button
                      type="button"
                      className="preview-atc"
                      style={atcToStyle(atc)}
                      disabled={atc.disabled}
                    >
                      {atcText}
                    </button>
                  </div>
                )}
                {!atc && (
                  <p className="compare-miss">
                    No add-to-cart submit in main block
                  </p>
                )}
              </div>
            </section>
          </div>
        ) : data && !pdp ? (
          <p className="pdp-empty">{data.note || "No PDP data."}</p>
        ) : (
          <p className="pdp-empty">
            Run a load to pull text and styles from the first product page we
            can open.
          </p>
        )}

        {data?.logs?.length ? (
          <details className="raw crawl-logs">
            <summary>Crawl log (server)</summary>
            <pre>{data.logs.join("\n")}</pre>
          </details>
        ) : null}

        {data ? (
          <details className="raw">
            <summary>API response</summary>
            <pre>{JSON.stringify(data, null, 2)}</pre>
          </details>
        ) : null}
      </main>
    </div>
  );
}
