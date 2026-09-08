// GY Summit 2026 — notifications (email + SMS + WhatsApp)
//
// Wired to real providers now:
//   - Email: Nodemailer, if SMTP_HOST/USER/PASS are set.
//   - SMS: Africa's Talking (the standard Kenya-market SMS gateway — pairs
//     naturally with the M-Pesa integration already in this app), if
//     AT_API_KEY/AT_USERNAME are set.
//   - WhatsApp: Meta's official WhatsApp Cloud API, if
//     WHATSAPP_PHONE_NUMBER_ID/WHATSAPP_ACCESS_TOKEN are set. This sends a
//     free-form text message, which Meta only allows within a 24-hour
//     customer-initiated session OR via a pre-approved message template —
//     see the note on sendWhatsapp() below.
//
// Any channel left unconfigured logs a clear one-line notice instead of
// silently doing nothing or crashing the request it's attached to — every
// call here is fire-and-forget from the caller's point of view.

const axios = require("axios");
const { getForm } = require("./settingsService");
const { normalizePhone } = require("./mpesaService");

// ---------------- Email ----------------

let transporter = null;
function getTransporter() {
  if (transporter) return transporter;
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  const nodemailer = require("nodemailer");
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: Number(SMTP_PORT) === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  return transporter;
}

async function sendEmail({ to, subject, body, emailConfig }) {
  const senderName = emailConfig.emailSenderName || "GY Summit 2026";
  const senderEmail = emailConfig.senderEmail;
  const t = getTransporter();
  if (!t || !senderEmail || !to) {
    console.log(`[notify:email:not-configured] would send to ${to}: "${subject}" — ${body}`);
    return;
  }
  await t.sendMail({
    from: `"${senderName}" <${senderEmail}>`,
    replyTo: emailConfig.replyEmail || senderEmail,
    to,
    subject,
    text: body,
  });
}

/**
 * For account-security emails (password reset, etc.) that must always go
 * out regardless of the admin's Announcements > Notification Channels
 * toggles — those toggles are meant to govern optional/marketing-style
 * notifications, not core account recovery. Uses whatever SMTP sender
 * name/address is configured, but never checks channels.enableEmail or
 * autoMessages first.
 */
async function sendTransactionalEmail(to, subject, body) {
  if (!to) return;
  try {
    const emailConfig = await getForm("emailConfigForm");
    await sendEmail({ to, subject, body, emailConfig });
  } catch (err) {
    console.error("[notify:transactional:error]", err.message);
    throw err; // callers of transactional email (e.g. password reset) need to know if it failed
  }
}

// ---------------- SMS (Africa's Talking) ----------------

async function sendSms(phone, message) {
  const { AT_API_KEY, AT_USERNAME, AT_SENDER_ID } = process.env;
  if (!phone) return;
  if (!AT_API_KEY || !AT_USERNAME) {
    console.log(`[notify:sms:not-configured] would SMS +${normalizePhone(phone)}: "${message}"`);
    return;
  }
  const params = new URLSearchParams({
    username: AT_USERNAME,
    to: `+${normalizePhone(phone)}`,
    message,
  });
  if (AT_SENDER_ID) params.append("from", AT_SENDER_ID);

  const host = AT_USERNAME === "sandbox" ? "api.sandbox.africastalking.com" : "api.africastalking.com";
  await axios.post(`https://${host}/version1/messaging`, params, {
    headers: {
      apiKey: AT_API_KEY,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
  });
}

/**
 * Sends the same SMS to many numbers in one Africa's Talking call (it
 * natively accepts a comma-separated `to` list), instead of one HTTP
 * request per recipient — this is what makes an announcement "bulk SMS"
 * rather than a slow loop of individual sends.
 */
async function sendBulkSms(phones, message) {
  const { AT_API_KEY, AT_USERNAME, AT_SENDER_ID } = process.env;
  const numbers = [...new Set(phones.filter(Boolean).map((p) => `+${normalizePhone(p)}`))];
  if (!numbers.length) return { sent: 0 };
  if (!AT_API_KEY || !AT_USERNAME) {
    console.log(`[notify:sms:not-configured] would bulk-SMS ${numbers.length} recipient(s): "${message}"`);
    return { sent: 0, skipped: numbers.length };
  }

  const host = AT_USERNAME === "sandbox" ? "api.sandbox.africastalking.com" : "api.africastalking.com";
  // Africa's Talking caps recipients per request — chunk to stay safe.
  const CHUNK = 500;
  let sent = 0;
  for (let i = 0; i < numbers.length; i += CHUNK) {
    const chunk = numbers.slice(i, i + CHUNK);
    const params = new URLSearchParams({ username: AT_USERNAME, to: chunk.join(","), message });
    if (AT_SENDER_ID) params.append("from", AT_SENDER_ID);
    await axios.post(`https://${host}/version1/messaging`, params, {
      headers: { apiKey: AT_API_KEY, "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    });
    sent += chunk.length;
  }
  return { sent };
}

// ---------------- WhatsApp (Meta Cloud API) ----------------

// Meta only allows a free-form text message like this within a 24-hour
// window after the customer last messaged the business number, or via a
// pre-approved message *template* outside that window. Since participants
// here haven't necessarily messaged the summit's WhatsApp number first,
// production use for cold outreach (e.g. "your registration is confirmed"
// as the very first contact) will actually need an approved template set
// up in the Meta Business dashboard — this sends the plain-text form,
// which works immediately for testing and for any participant who has
// messaged in first.
async function sendWhatsapp(phone, message) {
  const { WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_ACCESS_TOKEN } = process.env;
  if (!phone) return;
  if (!WHATSAPP_PHONE_NUMBER_ID || !WHATSAPP_ACCESS_TOKEN) {
    console.log(`[notify:whatsapp:not-configured] would WhatsApp +${normalizePhone(phone)}: "${message}"`);
    return;
  }
  await axios.post(
    `https://graph.facebook.com/v20.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
    {
      messaging_product: "whatsapp",
      to: normalizePhone(phone),
      type: "text",
      text: { body: message },
    },
    { headers: { Authorization: `Bearer ${WHATSAPP_ACCESS_TOKEN}`, "Content-Type": "application/json" } }
  );
}

// ---------------- Template filling ----------------

function fillTemplate(template, vars) {
  if (!template) return null;
  return String(template).replace(/\{\{(\w+)\}\}/g, (_, key) => (vars[key] !== undefined ? vars[key] : ""));
}

/**
 * @param eventKey one of "notifyRegistration" | "notifyPayment" | "notifyAdmission" | "notifyAnnouncements" | "notifyCertificates"
 * @param templateKey one of "registrationTemplate" | "paymentTemplate" | "admissionTemplate" | "certificateTemplate" | null
 * @param to { email, phone } — either can be omitted
 * @param subjectFallback used as the email subject, and as the SMS/WhatsApp body if no template/vars.body is set
 * @param vars values available to the template as {{placeholders}}
 */
async function notify(eventKey, templateKey, to, subjectFallback, vars = {}) {
  const recipient = typeof to === "string" ? { email: to } : (to || {});
  try {
    const [channels, autoMessages, emailConfig, templates, whatsappConfig] = await Promise.all([
      getForm("notificationChannelsForm"),
      getForm("autoMessagesForm"),
      getForm("emailConfigForm"),
      getForm("notificationTemplatesForm"),
      getForm("whatsappConfigForm"),
    ]);

    if (autoMessages[eventKey] === false) return;

    const body = fillTemplate(templates[templateKey], vars) || vars.body || subjectFallback;

    if (channels.enableEmail !== false && recipient.email) {
      await sendEmail({ to: recipient.email, subject: subjectFallback, body, emailConfig });
    }
    if (channels.enableSms === true && recipient.phone) {
      await sendSms(recipient.phone, body);
    }
    if (channels.enableWhatsapp === true && recipient.phone) {
      const footer = whatsappConfig.whatsappFooter ? `\n\n${whatsappConfig.whatsappFooter}` : "";
      await sendWhatsapp(recipient.phone, body + footer);
    }
  } catch (err) {
    // Never let a notification failure break the caller's request.
    console.error(`[notify:error] ${eventKey}:`, err.response?.data ? JSON.stringify(err.response.data) : err.message);
  }
}

module.exports = { notify, sendBulkSms, sendSms, sendWhatsapp, sendTransactionalEmail };
