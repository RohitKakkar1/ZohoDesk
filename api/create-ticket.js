import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

const ACCOUNTS_HOST = process.env.ZOHO_ACCOUNTS_HOST || "accounts.zoho.in";
const DESK_HOST = process.env.ZOHO_DESK_HOST || "desk.zoho.in";
const TOKEN_URL = `https://${ACCOUNTS_HOST}/oauth/v2/token`;
const TICKETS_URL = `https://${DESK_HOST}/api/v1/tickets`;

// Fixed department ID
const DEPARTMENT_ID = "1892000000006907"; // Replace with your actual department ID

function setCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*"); // adjust in production
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

async function getAccessToken() {
  const res = await axios.post(TOKEN_URL, null, {
    params: {
      refresh_token: process.env.REFRESH_TOKEN,
      client_id: process.env.CLIENT_ID,
      client_secret: process.env.CLIENT_SECRET,
      grant_type: "refresh_token",
    },
  });
  return res.data.access_token;
}

export default async function handler(req, res) {
  setCorsHeaders(res);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const body = req.body;

    // --- Validation ---
    if (!body.name) return res.status(400).json({ error: "Name is required." });
    if (!body.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
      return res.status(400).json({ error: "Valid email is required." });
    }
    if (!body.whatsapp_number || !/^\d+$/.test(body.whatsapp_number)) {
      return res.status(400).json({ error: "WhatsApp number must contain digits only." });
    }
    if (!body.whatsapp_country_code || !/^\+?\d+$/.test(body.whatsapp_country_code)) {
      return res.status(400).json({ error: "WhatsApp country code must be digits (optional leading +)." });
    }
    const allowedTopics = ["Feature Request", "Quality of Response", "Accuracy of response", "Other"];
    if (!body.feedback_topic || !allowedTopics.includes(body.feedback_topic)) {
      return res.status(400).json({ error: `Feedback topic must be one of: ${allowedTopics.join(", ")}` });
    }
    if (!body.feedback_message) return res.status(400).json({ error: "Feedback message is required." });

    const accessToken = await getAccessToken();

    // --- Prepare ticket payload using standard Zoho fields ---
    const ticketPayload = {
      subject: `Feedback from ${body.name}`,
      description: body.feedback_message,
      departmentId: DEPARTMENT_ID, // Fixed department
      contact: {
        lastName: body.name,
        email: body.email,
      },
      category: body.feedback_topic, // Map feedback_topic → category
      phone: `${body.whatsapp_country_code} ${body.whatsapp_number}`, // Combine country code + number
    };

    const ticketResponse = await axios.post(TICKETS_URL, ticketPayload, {
      headers: {
        Authorization: `Zoho-oauthtoken ${accessToken}`,
        orgId: process.env.ORG_ID,
        "Content-Type": "application/json",
      },
    });

    return res.status(200).json({ success: true, ticket: ticketResponse.data });
  } catch (err) {
    console.error(err.response?.data || err.message);
    const status = err.response?.status || 500;
    return res.status(status).json({ success: false, error: err.response?.data || err.message });
  }
}
