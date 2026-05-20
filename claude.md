# How to Get Styles

To extract styles from a Shopify store's product page, send a POST request to `/api/crawl` with the following JSON body:

```json
{
  "shopUrl": "https://example.myshopify.com",
  "storefrontPassword": "optional_password_if_required"
}
```

The `storefrontPassword` is optional and only needed for password-protected Shopify storefronts.

## Response Format

The API returns a JSON object with the following structure:

```json
{
  "ok": true,
  "shopUrl": "https://example.myshopify.com",
  "pdpUrl": "https://example.myshopify.com/products/example-product",
  "pdp": {
    "form": {
      "action": "/cart/add",
      "found": true
    },
    "productArea": {
      "background": "rgb(255, 255, 255)",
      "backgroundImage": "none",
      "color": "rgb(0, 0, 0)",
      "fontFamily": "system-ui, sans-serif",
      "padding": "20px",
      "borderRadius": "0px",
      "border": "none",
      "boxShadow": "none"
    },
    "price": {
      "text": "$29.99",
      "color": "rgb(0, 0, 0)",
      "background": "rgba(0, 0, 0, 0)",
      "backgroundImage": "none",
      "fontFamily": "system-ui, sans-serif",
      "fontSize": "18px",
      "fontStyle": "normal",
      "fontWeight": "400",
      "lineHeight": "24px",
      "letterSpacing": "normal",
      "textAlign": "left",
      "textTransform": "none",
      "textDecoration": "none",
      "margin": "0px",
      "padding": "0px"
    },
    "title": {
      "text": "Example Product Title",
      "color": "rgb(0, 0, 0)",
      "background": "rgba(0, 0, 0, 0)",
      "backgroundImage": "none",
      "fontFamily": "system-ui, sans-serif",
      "fontSize": "24px",
      "fontStyle": "normal",
      "fontWeight": "600",
      "lineHeight": "32px",
      "letterSpacing": "-0.03em",
      "textAlign": "left",
      "textTransform": "none",
      "textDecoration": "none",
      "margin": "0px 0px 10px",
      "padding": "0px"
    }
  },
  "atc": {
    "atcStyles": {
      "text": "Add to Cart",
      "disabled": false,
      "color": "rgb(255, 255, 255)",
      "background": "rgb(26, 26, 26)",
      "fontFamily": "system-ui, sans-serif",
      "fontSize": "16px",
      "fontStyle": "normal",
      "fontWeight": "400",
      "lineHeight": "24px",
      "letterSpacing": "normal",
      "textTransform": "none",
      "textDecoration": "none",
      "padding": "12px 24px",
      "margin": "0px",
      "border": "none",
      "borderRadius": "4px",
      "boxShadow": "none",
      "outline": "none",
      "minWidth": "120px",
      "minHeight": "48px"
    }
  },
  "collectionFallbackUrl": "https://example.myshopify.com/collections/example-collection",
  "passwordGate": {
    "required": false,
    "unlocked": false,
    "url": "https://example.myshopify.com"
  }
}
```

### Key Fields:
- `ok`: Boolean indicating success
- `shopUrl`: The input store URL
- `pdpUrl`: The actual product page URL crawled
- `pdp`: Object containing styles for the product area, title, price, and form
- `atc`: Object containing styles for the add-to-cart button
- `collectionFallbackUrl`: If a collection page was used to find the product (optional)
- `passwordGate`: Information about password protection handling (optional)

All style values are computed CSS properties extracted directly from the DOM elements.