# Mock Site / Lead Generation Testbed

## 📌 Overview
The `/mock-site` directory contains a minimal, vanilla HTML/CSS "Testbed" designed to rigorously stress-test the `lead-capture.js` script.

It simulates the three most common and difficult integration scenarios encountered in enterprise web environments:
1.  **Standard Implementation**: Simple, static forms.
2.  **Shadow DOM Encapsulation**: Modern web components and widgets (e.g., chatbots, embedded forms) that usually block standard scripts.
3.  **Multi-Step Flows**: Complex B2B forms that collect data across multiple screens without page reloads.

---

## 🧪 Test Scenarios

### 1. Classic Basic Form
*   **Description**: A standard HTML `<form>` with `input` and `textarea` fields.
*   **Purpose**: Verifies that the script can capture basic fields (Name, Email, Phone, Requirements) and correctly map them using the `DataExtractor` normalization logic.
*   **Key Test**: Ensure `_gw_bot_trap` (honeypot) is injected and the `submit` event is intercepted.

### 2. Deep Shadow DOM (The "Widget" Test)
*   **Description**: A form nested inside **two layers** of Shadow DOM roots (`#deep-shadow-host` -> `ShadowRoot` -> `#host2` -> `ShadowRoot` -> `<form>`).
*   **Purpose**: This simulates third-party widgets or modern frameworks (like Lit or Web Components) that encapsulate their styles and markup.
*   **Key Test**: The script's `pierceShadows` function must traverse the shadow roots to find the form and attach the listener. `event.composedPath()` is used to identify the form during submission.

### 3. Multi-Step Lead Flow
*   **Description**: A single form split into two visual steps using JavaScript to toggle visibility (`display: none`).
    *   **Step 1**: Contact Info (Name, Email)
    *   **Step 2**: Qualification (Company Size, Budget)
*   **Purpose**: Tests the script's ability to handle forms that are present in the DOM but partially hidden. It also verifies that data from *all* fields (even hidden ones) is captured upon final submission.
*   **Key Test**: Ensure the final payload contains fields from both Step 1 and Step 2.

---

## 🚀 How to Run
Since this site is just static HTML, CSS, and JS, you can run it using any simple local server.

### Option 1: VS Code Live Server (Recommended)
1.  Right-click `index.html` in VS Code.
2.  Select **"Open with Live Server"**.

### Option 2: Python Simple HTTP Server
```bash
# Run from the root of the repository
python3 -m http.server 8000
```
Then navigate to: `http://localhost:8000/mock-site/`

---

## 🎨 Styling
The site uses `styles.css` to provide a modern, "Enterprise SaaS" aesthetic with:
*   **Glassmorphism**: Translucent card backgrounds.
*   **Gradients**: For text and buttons.
*   **CSS Variables**: For consistent theming (`--primary`, `--bg-dark`).
*   **Animations**: Slight hover effects and entrance animations to mimic a real production site.
