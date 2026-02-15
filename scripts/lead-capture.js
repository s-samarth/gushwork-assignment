/**
 * GUSHWORK ENTERPRISE LEAD CAPTURE
 * 
 * WHAT IS THIS?
 * Think of this as a digital "security camera" and "courier service" for your website's forms.
 * Its only job is to notice when someone fills out a form, package that info up, and 
 * send it safely to your n8n workflow and Google Sheet/Airtable.
 */

(function () {
    'use strict';

    // 1. SETTINGS: This is where we tell the script where to send the data.
    const CONFIG = {
        // This is the "address" (URL) of your n8n workflow.
        WEBHOOK_URL: 'http://localhost:5678/webhook-test/capture-lead',

        // CLIENT ID & CUSTOMER NAME: Unique identifiers for this Gushwork customer.
        CLIENT_ID: 'gw_client_default_001',
        CUSTOMER_NAME: 'Enterprise Intelligence',

        // These are internal labels used to remember technical details about the user's session.
        SESSION_KEY: 'gw_session_id',
        JOURNEY_KEY: 'gw_user_journey',
        QUEUE_KEY: 'gw_delivery_queue',
        HONEYPOT_NAME: '_gw_bot_trap',

        // AUTHENTICATION: This is a "Secret Password" that n8n checks.
        // It ensures only YOUR website can send leads to your spreadsheet.
        AUTH_TOKEN: 'gw_prod_secret_2024',

        // Settings for how many retries we should do if the internet is slow.
        MAX_JOURNEY_LEN: 5,
        MAX_RETRIES: 5,
        DEBUG: true // When "true", it will print helpful notes in the browser's secret menu (Console).
    };

    /**
     * IDENTITY MANAGER
     * This section helps us tell different visitors apart.
     */
    class IdentityManager {
        // Gives each visitor a unique "ID number" so we know all submissions came from the same person.
        static getSessionId() {
            let id = sessionStorage.getItem(CONFIG.SESSION_KEY);
            if (!id) {
                id = 'sess_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
                sessionStorage.setItem(CONFIG.SESSION_KEY, id);
            }
            return id;
        }

        // Collects basic info about the user's computer (Screen size, Timezone) to help marketing.
        static getFingerprint() {
            return {
                res: `${window.screen.width}x${window.screen.height}`,
                lang: navigator.language,
                tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
                cores: navigator.hardwareConcurrency || 'unknown',
                mem: navigator.deviceMemory || 'unknown'
            };
        }

        // Remembers which pages the user looked at before they decided to sign up.
        static trackJourney() {
            let journey = JSON.parse(sessionStorage.getItem(CONFIG.JOURNEY_KEY) || '[]');
            const current = window.location.href;
            if (journey[journey.length - 1] !== current) {
                journey.push(current);
                if (journey.length > CONFIG.MAX_JOURNEY_LEN) journey.shift();
                sessionStorage.setItem(CONFIG.JOURNEY_KEY, JSON.stringify(journey));
            }
            return journey;
        }
    }

    /**
     * HONEYPOT MANAGER (Active Defense)
     */
    class HoneypotManager {
        // Injects a hidden field that human users won't see but bots will fill.
        static inject(form) {
            if (form.querySelector(`[name="${CONFIG.HONEYPOT_NAME}"]`)) return;

            const trap = document.createElement('input');
            trap.type = 'text';
            trap.name = CONFIG.HONEYPOT_NAME;
            trap.style.display = 'none'; // Hidden from humans
            trap.tabIndex = -1; // Skip in keyboard navigation
            trap.autocomplete = 'off';

            form.appendChild(trap);
            if (CONFIG.DEBUG) console.log(`[LeadCapture] Honeypot injected into form:`, form.id || form.className);
        }
    }

    /**
     * DATA EXTRACTOR
     * This section "reads" the form fields like a human would.
     */
    class DataExtractor {
        // These are the keywords we look for to detect and normalize fields.
        static getMAPPINGS() {
            return {
                // HONEYPOT: This is a "Bot Trap."
                honeypot: [/honeypot/i, /b_honey/i, /hidden_field/i, /hs_field_guid/i, new RegExp(CONFIG.HONEYPOT_NAME)],

                // NORMALIZATION MAPPINGS: Helping downstream AI by providing "best guesses"
                name: [/name/i, /fname/i, /lname/i, /contact/i, /user/i],
                email: [/email/i, /e-mail/i, /addr/i],
                phone: [/phone/i, /tel/i, /mobile/i, /cell/i, /whatsapp/i],
                message: [/message/i, /msg/i, /details/i, /requirement/i, /note/i, /desc/i, /comment/i]
            };
        }

        // Validates email format and returns null if invalid
        static normalizeEmail(email) {
            if (!email) return null;
            const raw = email.toString().trim();
            // Robust Email Regex: ensures basic address@domain.com structure
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            return emailRegex.test(raw) ? raw : null;
        }

        /**
         * Standardizes phone numbers to E.164 format (e.g., +14155551234)
         * 
         * HOW IT HANDLES TEXT:
         * 1. If it's pure text (e.g., "TBD"), it returns null.
         * 2. If it's mixed (e.g., "Phone: 9876543210"), it strips the text and keeps the digits.
         * 3. It intelligently defaults to +91 (India) or +1 (US) based on the browser's locale.
         */
        static normalizePhone(phone) {
            if (!phone) return null;

            const raw = phone.toString().trim();
            // Remove all non-numeric characters
            let cleaned = raw.replace(/\D/g, '');
            if (!cleaned) return null;

            // Detect user's region for intelligent defaulting
            const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
            const lang = navigator.language;
            const isIndia = tz.includes('Kolkata') || tz.includes('Calcutta') || lang.includes('IN');

            // 1. Handle "00" prefix (common international exit code for +)
            if (raw.startsWith('00')) {
                return '+' + cleaned.substring(2);
            }

            // 2. Handle 10-digit numbers (Intelligent Defaulting)
            if (cleaned.length === 10) {
                // If the user's browser suggests they are in India, use +91, otherwise +1 (US)
                return (isIndia ? '+91' : '+1') + cleaned;
            }

            // 3. If it already starts with +, just clean and return
            if (raw.startsWith('+')) {
                return '+' + cleaned;
            }

            // 4. Default: Try to keep it as is but prepended with + if it looks like a full number
            if (cleaned.length > 5 && cleaned.length <= 15) {
                return '+' + cleaned;
            }

            return cleaned; // Fallback to cleaned but no + if it's too short/weird
        }

        // This converts a messy form into a clean JSON object for the AI to process.
        static extract(form) {
            const formData = new FormData(form);
            const raw = {};
            const normalized = {
                name: null,
                email: null,
                phone: null,
                message: null,
                isBot: false
            };

            const mappings = this.getMAPPINGS();

            for (const [key, value] of formData.entries()) {
                // 1. Build RAW object (handling Multi-select/Checkboxes)
                if (raw.hasOwnProperty(key)) {
                    if (Array.isArray(raw[key])) {
                        raw[key].push(value);
                    } else {
                        raw[key] = [raw[key], value];
                    }
                } else {
                    raw[key] = value;
                }

                // 2. Build NORMALIZED object based on heuristics
                const lowKey = key.toLowerCase();

                // Check for Bot/Honeypot
                if (mappings.honeypot.some(r => r.test(lowKey)) && value) {
                    normalized.isBot = true;
                }

                // Map standard fields
                if (!normalized.name && mappings.name.some(r => r.test(lowKey))) normalized.name = value;
                if (!normalized.email && mappings.email.some(r => r.test(lowKey))) normalized.email = this.normalizeEmail(value);
                if (!normalized.phone && mappings.phone.some(r => r.test(lowKey))) normalized.phone = this.normalizePhone(value);
                if (!normalized.message && mappings.message.some(r => r.test(lowKey))) normalized.message = value;
            }

            return { raw, normalized };
        }
    }

    /**
     * DELIVERY ENGINE
     * This is the "Courier" that drives the data from the website to your database.
     */
    class DeliveryEngine {
        // Actually sends the data over the internet.
        static async deliver(payload, attempt = 1) {
            if (CONFIG.DEBUG) console.log(`[LeadCapture] Delivery attempt ${attempt}`, payload);

            try {
                if (CONFIG.DEBUG) console.log('[LeadCapture] Sending data to n8n...');
                const response = await fetch(CONFIG.WEBHOOK_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-gushwork-auth': CONFIG.AUTH_TOKEN // The "Identification Badge" n8n looks for.
                    },
                    body: JSON.stringify(payload),
                    keepalive: true // "Keep sending this even if the user closes the tab immediately!"
                });

                if (!response.ok && attempt < CONFIG.MAX_RETRIES) {
                    throw new Error(`Technical Glitch: ${response.status}`);
                }

                if (CONFIG.DEBUG) console.log('[LeadCapture] Delivery Success! Data is now in n8n.');
                this.processQueue(); // Check if there are any old leads waiting to be sent.
            } catch (err) {
                // If the internet cut out, we'll try again in a few seconds.
                if (attempt < CONFIG.MAX_RETRIES) {
                    const delay = Math.pow(2, attempt) * 1000;
                    if (CONFIG.DEBUG) console.warn(`[LeadCapture] Network busy... Retrying in ${delay / 1000} seconds...`);
                    setTimeout(() => this.deliver(payload, attempt + 1), delay);
                } else {
                    // If we give up, we save it to the "Emergency Storage" (localStorage) to try later.
                    console.error('[LeadCapture] Could not send. Saving for later.');
                    this.addToQueue(payload);
                    this.fallbackBeacon(payload);
                }
            }
        }

        // A secret "alternate route" browsers provide to send data when the page is closing.
        static fallbackBeacon(payload) {
            if (navigator.sendBeacon) {
                navigator.sendBeacon(CONFIG.WEBHOOK_URL, JSON.stringify(payload));
            }
        }

        // Adds a lead to the "Wait List" if the internet is down.
        static addToQueue(payload) {
            let queue = JSON.parse(localStorage.getItem(CONFIG.QUEUE_KEY) || '[]');
            queue.push({ payload, ts: Date.now() });
            localStorage.setItem(CONFIG.QUEUE_KEY, JSON.stringify(queue.slice(-10))); // We only keep the last 10 leads.
        }

        // Tries to send any leads that were saved earlier when the internet was down.
        static async processQueue() {
            let queue = JSON.parse(localStorage.getItem(CONFIG.QUEUE_KEY) || '[]');
            if (queue.length === 0) return;

            if (CONFIG.DEBUG) console.log(`[LeadCapture] Sending ${queue.length} previously saved leads...`);
            const item = queue.shift();
            localStorage.setItem(CONFIG.QUEUE_KEY, JSON.stringify(queue));
            this.deliver(item.payload);
        }
    }

    /**
     * CORE BRAIN
     * This is the logic that runs when someone clicks a "Submit" button.
     */
    const handleCapture = (event) => {
        // Universal Interception: Find the form even across the Shadow DOM barrier.
        const path = event.composedPath ? event.composedPath() : [event.target];
        const form = path.find(el => el.tagName === 'FORM');

        if (!form) return;

        // "Whoops, don't send twice!" - This stops double-clicks from creating duplicate leads.
        if (form._gwProcessed) return;
        form._gwProcessed = true;
        setTimeout(() => form._gwProcessed = false, 500);

        // Package all the info together into the standardized "Meta Envelope".
        const { raw, normalized } = DataExtractor.extract(form);
        const payload = {
            data: raw, // The raw form fields.
            normalized: normalized, // The "Best Guess" mapped fields.
            meta: {
                clientId: CONFIG.CLIENT_ID,
                customerName: CONFIG.CUSTOMER_NAME,
                sourceUrl: window.location.href,
                referrer: document.referrer || 'direct',
                userAgent: navigator.userAgent,
                timestamp: new Date().toISOString()
            },
            // Legacy/Extension fields
            identity: {
                sessionId: IdentityManager.getSessionId(),
                fingerprint: IdentityManager.getFingerprint()
            },
            journey: IdentityManager.trackJourney(),
            version: 'enterprise'
        };

        if (CONFIG.DEBUG) {
            console.log('🚀 Gushwork Capture Started!');
            console.table(payload.normalized);
        }

        // Hand the package to the Delivery Engine.
        DeliveryEngine.deliver(payload);
    };

    /**
     * DOM INTERCEPTION
     * This allows the script to "find" forms even if they are hidden or added later.
     */
    const setupInterceptors = (root) => {
        // Initial honeypot injection
        if (root.tagName === 'FORM') HoneypotManager.inject(root);

        // Safety: Ensure querySelectorAll exists (it doesn't on 'window')
        if (root.querySelectorAll) {
            root.querySelectorAll('form').forEach(f => HoneypotManager.inject(f));
        }

        // We "listen" for any form submission on the whole page.
        root.addEventListener('submit', handleCapture, true);
        if (CONFIG.DEBUG) console.log('[LeadCapture] Monitoring forms in:', root);
    };

    // Deep Search: Finds forms hidden inside modern web components (Shadow DOM).
    const pierceShadows = (node) => {
        if (node.shadowRoot) {
            setupInterceptors(node.shadowRoot);
            node.shadowRoot.querySelectorAll('*').forEach(pierceShadows);
        }
    };

    // "Watchdog": If your website adds a new form (like a popup), this script notices immediately.
    const observer = new MutationObserver((mutations) => {
        mutations.forEach(mutation => {
            mutation.addedNodes.forEach(node => {
                if (node.nodeType === 1) {
                    if (node.tagName === 'FORM') {
                        setupInterceptors(node);
                        HoneypotManager.inject(node);
                    }
                    node.querySelectorAll('form').forEach(f => HoneypotManager.inject(f));
                    pierceShadows(node);
                }
            });
        });
    });

    /**
     * INITIALIZE
     * The starting point of the whole script.
     */
    const init = () => {
        IdentityManager.trackJourney();
        setupInterceptors(document);

        // Look for any existing forms.
        document.querySelectorAll('*').forEach(pierceShadows);

        // Start the Watchdog to look for new forms.
        observer.observe(document.documentElement, { childList: true, subtree: true });

        // Check if there are any leads we forgot to send yesterday.
        setTimeout(() => DeliveryEngine.processQueue(), 2000);

        if (CONFIG.DEBUG) console.log('[LeadCapture] Script is Active and Watching.');
    };

    // Start everything as soon as the page is ready.
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
