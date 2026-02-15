# Hybrid Spam Filtering Architecture

This document details the multi-layered spam defense system implemented in our N8N workflows. The system uses a "Swiss Cheese" model: cheap, fast layers block the majority of junk, while expensive, intelligent layers handle the edge cases.

---

## 🛡️ Layer 1: The Heuristic Filter (Deterministic)

**Goal**: Block bots and low-effort spam *before* incurring LLM costs.
**Implementation**: `Regex and Keyword Spam Filter` (Code Node).
**Cost**: $0.00.
**Speed**: < 10ms.

### Rules Logic
The system flags a lead if it violates specific rules. If **2 or more** checks fail, or if a critical check (Gibberish or Keyword Blacklist) fails, the lead is marked as `Possible Spam` and **skips** the AI layer.

| Check | Condition | Logic |
| :--- | :--- | :--- |
| **Excessive Shouting** | `capsCount / length > 0.4` | >40% of the message is UPPERCASE. Checks only if length > 20 chars. |
| **Gibberish** | `/[bcdfghjklmnpqrstvwxyz]{15,}/i` | 15+ consecutive consonants (e.g., `zxcrqvbnmlkhjgfd`). |
| **Name Pattern** | `Name == Surname` | Bots often fill "First Name" and "Last Name" with the same random string. |
| **URL Overload** | `urlsFound.length >= 2` | More than 2 links in a message. |
| **Suspicious TLD** | `.(ru|xyz|top|info|click|biz|zip)$` | Links ending in high-spam top-level domains. |
| **Burner Email** | `email.includes(domain)` | Checks against: `mailinator.com`, `guerrillamail.com`, `temp-mail.org`, `10minutemail`. |
| **Keyword Blacklist** | `message.includes(keyword)` | **Finance**: "crypto", "bitcoin", "forex". <br>**Marketing**: "seo services", "backlinks". <br>**Urgency**: "winner", "prize". |

---

## 🧠 Layer 2: The AI Spam Filter (Semantic)

**Goal**: Understand *intent*. Distinguish between a legit customer asking "Do you do SEO?" vs a vendor selling "SEO Services".
**Implementation**: Google Gemini Flash (LLM Node).
**Cost**: ~Low (Flash model).

### The System Prompt
The following prompt is strictly enforced in the N8N `AI Spam Filter` node:

```markdown
# ROLE
You are a Lead Quality Assurance Expert at Gushwork. Your job is to filter incoming website inquiries for our clients (Industrial Manufacturers and Local Service Businesses). Your goal is to ensure only potential *buyers* reach the sales team, blocking vendors, solicitors, and bots.

Here are the details of the message:
Name: {{ $('Regex and Keyword Spam Filter').item.json.Name }}
Phone: {{ $('Regex and Keyword Spam Filter').item.json.Phone }}
Email: {{ $('Regex and Keyword Spam Filter').item.json.Email }}
Message: {{ $('Regex and Keyword Spam Filter').item.json.Message }}

# CLASSIFICATION GUIDELINES

## MARK AS SPAM (is_spam: true) if the message is:
1. **B2B Solicitation:** Someone trying to *sell* services (SEO, Web Design, Staffing, Raw Materials, Lead Lists) rather than *buy* them.
2. **Scam/Phishing:** Mentions of "Domain Expiration," "Urgent Invoice," "Crypto," or "Inheritance."
3. **Irrelevant:** Job applications, student research surveys, or "wrong number" type messages.
4. **Incoherent/Low Effort:** Gibberish strings, or single-word messages like "Hi" or "Test" with no follow-up intent.

## MARK AS LEGITIMATE (is_spam: false) if the message is:
1. **Service/Product Inquiry:** Asking about pricing, availability, specs, or quotes.
2. **General Contact:** "Can someone call me?" or "Where are you located?"
3. **Imperfect English:** Do not penalize poor grammar if the *intent to buy* is clear.

You must respond strictly according to the provided schema. Do not include any conversational text or markdown formatting outside the JSON.
"Analyze the message. For the is_spam field, you must only return the JSON boolean true or false. Do not use 'Yes', 'No', or any other string."
```

### JSON Schema Output
The AI returns a structured object to ensure the workflow can parse it reliably:
```json
{
  "is_spam": boolean,
  "reason": "string (explanation of decision)"
}
```

---

## 🕸️ Layer 3: The "Human-in-the-Loop" Safety Net

**Goal**: Correct AI mistakes (False Positives).
**Implementation**: Airtable + Polling Workflow.

1.  **Storage**: ALL leads (Spam or Legit) are saved to Airtable.
2.  **Review**: A human reviews the `Possible Spam` view weekly.
3.  **Correction**: If a lead is actually good, the human changes Status to `New Lead`.
4.  **Recovery**: The `Lead Monitoring Workflow` detects this change and triggers the email alert that was originally suppressed.
