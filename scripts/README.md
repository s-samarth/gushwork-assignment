# Universal Lead Capture Script (`lead-capture.js`)

## 📌 Overview
This script is a framework-agnostic "digital courier" designed to intercept, normalize, and securely transmit form submissions from any website to the Gushwork N8N ingestion pipeline.

It is built to solve the **"Fragmentation Problem"**—capturing high-quality data from diverse environments (WordPress, Shopify, Custom React Apps, Shadow DOM widgets) without requiring backend code changes.

---

## 🚀 Implementation Guide

### 1. Basic Installation (Global Footer)
For 90% of sites, simply add this snippet before the closing `</body>` tag. This ensures the DOM is fully loaded before the script attaches its listeners.

```html
<script src="https://cdn.your-domain.com/lead-capture.js" defer></script>
```

### 2. Advanced: Google Tag Manager (GTM)
To deploy without touching the codebase:
1.  Create a **Custom HTML Tag**.
2.  Paste the script code (or the CDN link).
3.  Set Trigger to **All Pages** (or specific landing pages).
4.  **Important**: Ensure "Support document.write" is unchecked.

### 3. SPA / React / Next.js
For Single Page Applications where pages change without refreshing:
```javascript
useEffect(() => {
  const script = document.createElement('script');
  script.src = "https://cdn.your-domain.com/lead-capture.js";
  script.defer = true;
  document.body.appendChild(script);
  
  // Optional: Clean up on unmount if needed
  return () => document.body.removeChild(script);
}, []);
```

---

## ⚙️ Configuration
The script is designed to be "headless," but you must configure the top-level `CONFIG` object in `lead-capture.js` before minifying/deploying:

```javascript
const CONFIG = {
    WEBHOOK_URL: 'https://n8n.your-domain.com/webhook/capture-lead', // Your N8N Production URL
    AUTH_TOKEN: 'sec_prod_xyz', // Must match 'x-gushwork-auth' in N8N
    CLIENT_ID: 'client_001', // Unique ID for multi-tenant routing
    CUSTOMER_NAME: 'Gushwork Customer', // Name of the client website
    DEBUG: false // Set to true for console logs during dev
};
```

---

## 🔬 Technical Deep Dive (Research vs. Implementation)

This script implements the **"Universal Listener Pattern"** outlined in our architectural research. Here is how specific challenges are handled:

### 1. The "Capture Phase" Event Delegation
*   **Challenge**: Modern libraries (HubSpot, React Hook Form) often use `event.stopPropagation()`, killing events before they bubble up to the `document`.
*   **Solution**: We attach our listener with `useCapture: true`.
    ```javascript
    document.addEventListener('submit', handleCapture, true); // The 'true' is the magic sauce
    ```
    This ensures our script executes *first*, intercepting the event as it travels *down* the DOM tree, guaranteeing capture even if the target form later cancels the bubble.

### 2. Shadow DOM Piercing
*   **Challenge**: Chatbots and widgets inside Shadow Roots are invisible to standard `document.forms`.
*   **Solution**: The script uses a recursive `pierceShadows` function and inspects `event.composedPath()` to trace the true origin of an event, even if it's buried 3 layers deep in a Shadow DOM.

### 3. Reliability: The `keepalive` Flag
*   **Challenge**: If a form redirects to a "Thank You" page immediately, standard AJAX requests are often aborted by the browser.
*   **Solution**: We use the `keepalive: true` flag in the `fetch()` API. This tells the browser to treat the request as a background transaction that outlives the page lifecycle.

### 4. Data Normalization Strategy (`DataExtractor`)
*   **The Problem**: Field names are chaotic (`your-name`, `fname_732`, `email_addr`).
*   **The Solution**: We map fields using regex heuristics:
    *   **Phone**: Automatically stripped of non-numeric characters and formatted to E.164 (e.g., `(555) 123-4567` → `+15551234567`) based on the browser's timezone.
    *   **Email**: Validated against a strict regex structure.
    *   **Fields**: Mapped to a normalized schema (`name`, `email`, `phone`, `message`) regardless of the original `name` attribute.

### 5. Honeypot Logic (Active Defense)
*   **Mechanism**: The `HoneypotManager` injects a hidden input field named `_gw_bot_trap` into every form.
*   **Detection**: This field is invisible to humans (`display: none`, `tabIndex: -1`). If a bot autofills it, the `isBot` flag is set to true, and the N8N workflow instantly drops the request.

### 6. Data Serialization
*   **Implementation**: We use `new FormData(form)` to robustly handle text, radios, checkboxes, and even file inputs (metadata only), converting them to a standard JSON payload.

---

## 🔮 Roadmap & Missing Features (Next Steps)

While the current script is robust, the following features (identified in the Research Plan) are currently **NOT IMPLEMENTED** and should be prioritized for V2:

### 🔴 1. Content Security Policy (CSP) Headers
*   **Gap**: The script does not currently handle strict CSP environments.
*   **Requirement**: We need to provide clients with a standard CSP directive to allow-list our CDN and Webhook domains:
    ```text
    script-src 'self' 'nonce-xyz' https://cdn.gushwork.ai;
    connect-src 'self' https://webhooks.gushwork.ai;
    ```

### 🔴 2. Redis-Based Rate Limiting
*   **Gap**: The current N8N workflow processes every request.
*   **Risk**: A DDoS attack could spike our API costs.
*   **Plan**: Implement a Redis middleware layer (or N8N Redis node) to rate-limit requests by IP address *before* they trigger the LLM.

### 🔴 3. DoNotTrack Compliance
*   **Gap**: The `IdentityManager` currently generates a fingerprint for every user.
*   **Requirement**: Add a check for `navigator.doNotTrack`. If enabled, we should disable the `Fingerprint` and `Journey` tracking modules to respect user privacy (GDPR compliance).

### 🔴 4. Dynamic "Client Config" Loading
*   **Gap**: The configuration (`CLIENT_ID`) is currently hardcoded.
*   **Plan**: Fetch channel settings (Slack vs Email, CRM type) from Airtable based on `CLIENT_ID` at the N8N level, allowing for true multi-tenancy without redeploying the script.
