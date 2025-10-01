import axios from "axios";

/**
 * Simple Vercel serverless function that:
 *  1) exchanges REFRESH_TOKEN -> new access token
 *  2) calls Zoho Desk create ticket API
 *
 * Notes:
 * - Set environment variables in Vercel (CLIENT_ID, CLIENT_SECRET, REFRESH_TOKEN, ORG_ID).
 * - If your Zoho account is India, set ZOHO_ACCOUNTS_HOST=accounts.zoho.in and ZOHO_DESK_HOST=desk.zoho.in
 */

const ACCOUNTS_HOST = process.env.ZOHO_ACCOUNTS_HOST || "accounts.zoho.in";
const DESK_HOST = process.env.ZOHO_DESK_HOST || "desk.zoho.in";
const TOKEN_URL = `https://${ACCOUNTS_HOST}/oauth/v2/token`;
const TICKETS_URL = `https://${DESK_HOST}/api/v1/tickets`;

/** Allow simple CORS for frontends (adjust origin in production) */
function setCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*"); // change "*" to your frontend origin in production
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
    // minimal validation
    if (!body || !body.subject || !body.contact || !body.contact.email) {
      return res.status(400).json({ error: "Missing required fields: subject and contact.email" });
    }

    const accessToken = await getAccessToken();

    const ticketResponse = await axios.post(
      TICKETS_URL,
      {
        subject: body.subject,
        description: body.description || "",
        departmentId: body.departmentId, // optional
        contact: {
          lastName: body.contact.lastName || "",
          email: body.contact.email,
        },
        // add other fields if needed
      },
      {
        headers: {
          Authorization: `Zoho-oauthtoken ${accessToken}`,
          orgId: process.env.ORG_ID,
          "Content-Type": "application/json",
        },
      }
    );

    return res.status(200).json({ success: true, ticket: ticketResponse.data });
  } catch (err) {
    console.error(err.response?.data || err.message);
    const status = err.response?.status || 500;
    return res.status(status).json({ success: false, error: err.response?.data || err.message });
  }
}