# Database Decision: Airtable vs. Google Sheets

## 📌 Executive Summary
While **Google Sheets** is the default choice for many businesses due to its ubiquity and zero cost, it is fundamentally a **spreadsheet**, not a database. For a mission-critical system like Lead Capture, where data integrity and automation reliability are paramount, **Airtable** is the superior architectural choice.

However, we acknowledge the trade-off: **Airtable costs money; Sheets is free.**

This document outlines why we default to Airtable for "System of Record" tasks while reserving Google Sheets for "Client Reporting" views.

---

## 🥊 Feature Showdown

| Feature | 🟢 Airtable (The Database) | 🔴 Google Sheets (The Spreadsheet) |
| :--- | :--- | :--- |
| **Data Integrity** | **Strict Schema**. A "Date" column *must* be a date. You cannot accidentally type text into a price field. | **Loose**. A user can type "TBD" into a `Price` column, breaking downstream reporting. |
| **API Limits** | **High & Predictable**. 5 requests/sec. Built for programmatic access. | **Low & Opaque**. ~60 writes/min per user. Frequent `429 Too Many Requests` errors under load. |
| **Concurrency** | **Transactional**. Multiple webhooks can write simultaneously without data loss. | **Race Conditions**. Two simultaneous writes often result in one over-writing the other. |
| **Relations** | **Native**. Link "Leads" to "Companies" table easily. | **Non-Existent**. Requires complex `VLOOKUP` formulas that break easily. |
| **Automations** | **Event-Driven**. "When Status changes to Qualified, send Slack DM" runs instantly. | **Polling Only**. "Check every 15 mins if row changed." Slow and wastes compute. |
| **Cost** | **$20/user/month** (Team Plan) | **Free** (mostly) |

---

## 🧐 The "Why Airtable?" Argument

### 1. The "Strict Schema" Advantage
In Google Sheets, a client can easily drag a cell and accidentally overwrite the `LeadID` column, or paste a note into the `Email` column.
*   **Airtable**: Fields are typed. You cannot put text in a Number field. This prevents "Garbage In, Garbage Out."
*   **Impact**: Our N8N workflows don't crash because of unexpected data types.

### 2. Relational Power (Lead Scoring)
Airtable allows us to build a `Companies` table and link multiple `Leads` to it.
*   **Scenario**: "Show me all leads from *Coca-Cola*."
*   **In Airtable**: One click.
*   **In Sheets**: A complex pivot table that requires manual refreshing.

### 3. Webhooks & Automations (The Future)
As mentioned in our **Roadmap**, we want to move away from "Polling" (checking every minute).
*   **Airtable**: Can fire a webhook *out* to N8N immediately when a record is updated.
*   **sheets**: Cannot do this natively without complex App Script triggers that are hard to maintain.

---

## 📉 The "Why Sheets?" Argument (Defense)

We are not abandoning Sheets. It has two massive advantages:
1.  **Ubiquity**: Everyone knows how to use it. No training required.
2.  **Cost**: It is free.

### 💡 Recommendation: The Hybrid Model
*   **Ingestion (System of Record)**: Use **Airtable** (or Postgres) to receive leads. This ensures safety, typing, and speed.
*   **Reporting (Client View)**: Sync data *from* Airtable *to* **Google Sheets** once an hour.
    *   Clients get their free, familiar spreadsheet.
    *   We get our robust, crash-proof database.
