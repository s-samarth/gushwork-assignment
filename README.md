# Gushwork - Intelligent Lead Capture & Qualification System

This repository contains the complete source code, documentation, and workflow definitions for Gushwork's AI-powered lead generation system. It is designed to capture leads from fragmented customer websites (across various CMSs), normalize the data, qualify leads using a hybrid AI spam filter, and manage notifications via N8N and Airtable.

---

## 📂 Repository Structure

| Directory | Description |
| :--- | :--- |
| `/scripts` | Contains the `lead-capture.js` snippet—a universal, headless JavaScript solution for capturing form submissions. |
| `/mock-site` | A testbed environment simulating complex scenarios (Shadow DOM, multi-step forms) to validate script reliability. |
| `/workflow` | JSON definitions and assets for the N8N backend automation that processes incoming leads. |
| `/docs` | detailed strategy documents, including rollout plans and the spam filtering logic. |

---

## 🧩 Key Components

### 1. Universal Lead Capture Script (`/scripts`)
A robust, copy-paste JavaScript snippet that works on any website (WordPress, Webflow, custom React apps).

**Core Features:**
- **Universal Compatibility**: Works with standard HTML forms, AJAX submissions, and dynamic SPAs.
- **Shadow DOM Piercing**: Recursively traverses shadow roots to capture leads from embedded widgets (e.g., HubSpot, Chatbots).
- **Resilient Delivery**: Uses `fetch(keepalive: true)` and `navigator.sendBeacon()` to ensure data delivery even if the user closes the tab immediately.
- **Offline Queueing**: Stores leads in `localStorage` if the network fails and retries automatically.
- **Fingerprinting**: Generates a unique `sess_id` and captures device metrics to detect bot farms.

**Quick Install:**
Add this before the closing `</body>` tag:
```html
<script src="https://your-cdn.com/lead-capture.js" defer></script>
```

### 2. Mock Testing Site (`/mock-site`)
A sandbox environment illustrating the "stress tests" the script must pass.

**Scenarios Tested:**
1.  **Multi-Step Forms**: Verifies that fragmented data inputs across pages are unified into a single lead record.
2.  **Shadow DOM Widgets**: Simulates modern web component encapsulation to prove deep piercing capabilities.
3.  **Standard Forms**: Functions as a control group for baseline performance testing.

### 3. N8N Automation Workflows (`/workflow`)
The backend logic is split into two distinct workflows to handle ingestion and monitoring separately.

#### Workflow A: Lead Capture & Qualification (`lead_capturing_workflow.json`)
This workflow processes incoming webhooks in real-time.

**Logic Flow:**
1.  **Webhook Reception**: Accepts JSON payload with lead data securely via Header Auth (`x-gushwork-auth`).
2.  **Honeypot Check**: Instantly drops requests where hidden bot fields (`_gw_bot_trap`) are filled.
3.  **AI Smart Mapper**: Uses a lightweight LLM to normalize messy input data (e.g., extracting "John Doe" from "Name: John Doe") into a clean schema.
4.  **Heuristic Spam Filter (Layer 1)**:
    -   Checks for "shouting" (caps lock), gibberish, multiple URLs, or known spam keywords (crypto, seo).
    -   **If Spam Detected**: Marks as `Possible Spam` and **SKIPS** the expensive AI analysis.
5.  **AI Analysis (Layer 2)**:
    -   Only runs if Layer 1 is clean.
    -   Uses a more advanced LLM to analyze the *intent* of the message (e.g., distinguishes a "sales pitch" from a "purchase inquiry").
6.  **Routing & Storage**:
    -   Adds the lead to **Airtable**.
    -   **If Status = 'New Lead'**: Sends an immediate email notification via Gmail.

#### Workflow B: Lead Status Monitoring (`lead_monitoring_workflow.json`)
This workflow acts as a safety creating a "Human-in-the-Loop" system.

**Logic Flow:**
1.  **Polls Airtable**: Checks the base every minute for records where `Status` is `New Lead`.
2.  **Change Detection**: Compares `Updated at` vs `Created at` timestamps to identify *only* leads that were manually changed from "Possible Spam" to "New Lead" by a human reviewer.
3.  **Notification**: Triggers a "New Verified Lead" email to the team, ensuring no rescued leads are missed.

---

## 📊 Data Schema & Configuration

### Airtable Database Schema
The system requires an Airtable Base with the following specific fields:

| Field Name | Type | Description |
| :--- | :--- | :--- |
| **Name** | Single Line Text | The lead's full name. |
| **Phone Number** | Phone Number | Normalized phone number. |
| **Email Address** | Email | The lead's contact email. |
| **Lead Details** | Long Text | The raw message or inquiry text. |
| **Status** | Single Select | Options: `New Lead`, `Possible Spam`. |
| **Submission URL** | URL | The specific page where the form was submitted. |
| **Lead Source** | Single Line Text | The originating campaign or referrer. |
| **Customer name** | Single Line Text | Name of the client website. |
| **Created at** | Created Time | Timestamp of improved record creation. |
| **Updated at** | Last Modified Time | Timestamp of last modification to Status Field. |

### Notification Logic
- **Immediate Alert**: Triggered when a lead is classified as `New Lead` by the workflow.
- **Manual Rescue**: If a human updates a record from `Possible Spam` → `New Lead` in Airtable, the workflow detects the change and sends the notification.

---

## 📚 Documentation Library

We maintain comprehensive documentation for every layer of the system:
### 🛠️ Technical Implementation
| Document | Description |
| :--- | :--- |
| **[Universal Script Guide](/scripts/README.md)** | Deep dive into `lead-capture.js` logic, installation (GTM/Manual), and configuration. |
| **[N8N Workflow Architecture](/workflow/README.md)** | Explanation of the logic behind the Capture and Monitoring workflows. |
| **[Mock Site Usage](/mock-site/README.md)** | How to run the local testbed and validate Shadow DOM scenarios. |

### 🧠 Strategy & Security
| Document | Description |
| :--- | :--- |
| **[Rollout & Roadmap](/docs/Rollout_Edge_Cases_and_Future_Plan.md)** | Deployment strategies for 3 customer archetypes and the 2-week technical roadmap. |
| **[Spam Defense Matrix](/docs/spam_filtering.md)** | Detailed breakdown of the Heuristic (Regex) and AI (LLM) spam layers + System Prompts. |
| **[Additional Architecture](/docs/additional_notes.md)** | Specs on payload schema, tech stack comparisons (n8n vs Zapier), and advanced security. |
| **[Database Decision](/docs/airtable_vs_sheets.md)** | A comparative analysis of why we chose Airtable over Google Sheets. |

---

## 🚀 Getting Started

1.  **Deploy the Script**: Host the `/scripts/lead-capture.js` file on your CDN.
2.  **Import Workflows**: Import both `/workflow/lead_capturing_workflow.json` and `/workflow/lead_monitoring_workflow.json` into your N8N instance.
3.  **Configure Environment**:
    -   Set your `WEBHOOK_URL`, `AUTH_TOKEN` and `CUSTOMER_NAME` in the script `CONFIG` object.
    -   Add your N8N Header Auth token (`x-gushwork-auth`) to the script.
    -   Connect your Airtable credentials in N8N.
4.  **Test**: Use the form in `/mock-site` to submit test leads and verify they appear in Airtable.

For detailed deployment strategies (GTM vs Manual) and spam logic specifics, refer to the documents in `/docs`.
