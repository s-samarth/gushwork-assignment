# Rollout, Edge Cases, Future Plans and Troubleshooting Guide

## 1. Rollout Strategy: A Tale of 3 Customers
We have designed the system to be "Universal," meaning the core `lead-capture.js` remains the same, but the deployment method adapts to the customer's tech stack. Here is how we would roll this out to three distinct archetypes:

### Customer A: "The Local Service Business" (WordPress/Wix)
*   **Profile**: Low technical expertise, standard CMS, simple contact form.
*   **Rollout Plan**:
    1.  **Configuration**: Generate a `CLIENT_ID` (`gw_local_bakery_001`) and hardcode it into a customer-specific version of the script hosted on our CDN.
    2.  **Deployment**: Provide a simple copy-paste snippet to place in the footer (e.g., using a "Header and Footer Scripts" plugin).
    3.  **Verification**: Submit a test lead and check the "New Leads" view in Airtable.
*   **Why**: Zero maintenance for them. We control the script version remotely.

### Customer B: "The Growth Marketing Agency" (Unbounce/Webflow + GTM)
*   **Profile**: Tech-savvy marketers, frequent landing page changes, uses Google Tag Manager.
*   **Rollout Plan**:
    1.  **Configuration**: Provide the raw `lead-capture.js` code wrapped in a `<script>` tag.
    2.  **Deployment**: Instruct them to create a **Custom HTML Tag** in GTM, firing on "All Pages" or specific Campaigns.
    3.  **Advanced Setup**: Ask them to configure the `CLIENT_ID` variable in GTM to dynamically swap IDs for different sub-brands if needed.
*   **Why**: Gives them control over *when* and *where* the script fires without needing valid code deploys.

### Customer C: "The Enterprise SaaS" (React/Next.js + Shadow DOM)
*   **Profile**: Custom web app, multiple subdomains, strict security (CSP), encapsulated widgets (chatbots).
*   **Rollout Plan**:
    1.  **Configuration**: Provide the npm package or module (if we package it) or a `useEffect` hook snippet.
    2.  **Security**: Work with their DevSecOps to whitelist `https://webhooks.gushwork.ai` in their Content Security Policy (CSP).
    3.  **Integration**: Rely on our **Shadow DOM Piercing** tech to auto-detect their isolated forms without them needing to add `id` attributes to every input.
*   **Why**: Seamless integration into complex apps where standard scripts fail due to component encapsulation.

---

## 2. Scenarios Accounted For
We anticipated the chaos of the open web. Here are the specific "Edge Cases" we engineered against:

### 🛡️ The "Protective" Shadow DOM
*   **Scenario**: A modern chatbot or popup form is built using Web Components, hiding its inputs from `document.querySelectorAll`.
*   **Defense**: The script uses recursive `pierceShadows(node)` to traverse open Shadow Roots and attaches listeners effectively.

### 🏃 The "Race Condition" (Page Navigation)
*   **Scenario**: A user clicks "Submit" and the page immediately redirects to `/thank-you`. Standard `fetch` requests often get cancelled by the browser.
*   **Defense**: We use `keepalive: true` in the fetch options and `navigator.sendBeacon` as a fallback, ensuring the request survives the page unload.

### 🤖 The "Dumb" Bot
*   **Scenario**: Simple scripts scanning for forms and filling every input.
*   **Defense**: We inject a hidden `_gw_bot_trap` field. If filled, the N8N workflow silently discards the lead, saving our AI quota.

### 🌪️ The "Analytic" Noise
*   **Scenario**: Forms have messy field names like `input_14_xq`, `details_v2`, or `user_comment`.
*   **Defense**: Our **Regex Heuristics** (`DataExtractor`) normalize these into a clean `{ name, email, phone, message }` schema before saving, so the CRM data is uniform.

---

## 3. The "Next 2 Weeks" Roadmap
If we had 14 more days, here is where we would invest engineering time to turn this from a "Tool" into a "Platform":

### 1. Server-Side Rate Limiting (Redis)
*   **Why**: Currently, a malicious actor could loop a curl request and drain our N8N/AI credits.
*   **Build**: A Redis layer in N8N (or a pre-filter worker) to rate-limit requests by IP (`MAX 5 requests / minute`).

### 2. Dashboard for Clients
*   **Why**: Clients currently rely on us to see their leads (via Airtable).
*   **Build**: A simple "Partner Portal" (React + Supabase) where they can login, see their `CLIENT_ID`, view real-time lead stats, and configure their own webhooks (e.g., "Send to my Slack").

### 3. Smart "Failover" Routing
*   **Why**: What if Airtable goes down?
*   **Build**: A "Dead Letter Queue" in N8N. If the primary destination fails, save the JSON payload to a resilient S3 bucket or Postgres row, to be replayed later.

### 4. Privacy Compliance Mode (GDPR/CCPA)
*   **Why**: Enterprise clients demand compliance.
*   **Build**: Use `navigator.doNotTrack` and a "Consent Cookie" check before capturing any PII or fingerprinting the user.

### 5. Transition to Airtable Automations
*   **Current State**: We currently poll Airtable because we are restricted to a strict schema match and cannot add helper fields.
*   **Future State**: With permission to add additional fields, we will switch to **Airtable Automations** to trigger webhooks immediately upon status changes, eliminating the latency and inefficiency of polling.

---

## 4. Troubleshooting Guide: "Where is my Lead?"
When a client screams "It's not working!", follow this checklist:

### Step 1: Client-Side (The Browser)
1.  **Open Console**: Is `DEBUG: true`? Look for `[LeadCapture] Delivery Success!`.
2.  **Check Network Tab**: Filter for `capture-lead`.
    *   **Status (cancelled)**: The page navigated too fast (check `keepalive`).
    *   **Status 403**: The `AUTH_TOKEN` is wrong or the CSP blocked the request.
    *   **Status 200**: The script sent it. The problem is on the Server.

### Step 2: The "Pipe" (N8N)
1.  **Execution Logs**: Search for the `requestId` or timestamp in N8N.
2.  **"Stop" Node**: Did the **Honeypot Filter** catch it? (Check `isBot` value).
3.  **Validation**: Did the **Heuristic Mapping** fail to find an Email or Phone? (We currently require at least *one* contact method).

### Step 3: The Destination (Airtable)
1.  **View Filters**: Is the "Default View" filtering out `Status = 'Spam'`?
2.  **Field Mapping**: Did the client change their form field names? (e.g., `user_email` -> `contact_mail`). Update the Regex in `DataExtractor.getMAPPINGS()` if needed.
