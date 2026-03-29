/**
 * TWILIO SMS PROXY SERVER
 * 
 * A lightweight Express server that securely proxies SMS requests to Twilio.
 * This keeps Twilio credentials on the server side (never exposed to browser).
 * 
 * SETUP:
 *   1. cd server
 *   2. npm install express cors twilio dotenv
 *   3. Create server/.env with your Twilio credentials (see below)
 *   4. node sms-server.js
 * 
 * ENV VARS (server/.env):
 *   TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
 *   TWILIO_AUTH_TOKEN=your_auth_token
 *   TWILIO_PHONE_NUMBER=+1234567890
 *   PORT=3001
 */

import express from 'express';
import cors from 'cors';
import twilio from 'twilio';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:3000'] }));
app.use(express.json());

// Initialize Twilio client
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// ─── SMS Endpoint ──────────────────────────────────────────────
app.post('/api/send-sms', async (req, res) => {
  const { to, message } = req.body;

  if (!to || !message) {
    return res.status(400).json({ error: 'Missing "to" or "message" field' });
  }

  try {
    const result = await twilioClient.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: to,
    });

    console.log(`✅ SMS sent to ${to} | SID: ${result.sid}`);
    res.json({ success: true, sid: result.sid });
  } catch (err) {
    console.error(`❌ SMS failed to ${to}:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Health Check ──────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    twilio: !!process.env.TWILIO_ACCOUNT_SID,
    timestamp: new Date().toISOString()
  });
});

app.listen(PORT, () => {
  console.log(`\n🚀 Nyaya Saathi SMS Server running on http://localhost:${PORT}`);
  console.log(`   POST /api/send-sms  — Send SMS via Twilio`);
  console.log(`   GET  /api/health    — Server health check\n`);
  
  if (!process.env.TWILIO_ACCOUNT_SID) {
    console.log(`⚠️  TWILIO_ACCOUNT_SID not set! Create server/.env with:`);
    console.log(`   TWILIO_ACCOUNT_SID=ACxxxx`);
    console.log(`   TWILIO_AUTH_TOKEN=xxxx`);
    console.log(`   TWILIO_PHONE_NUMBER=+1xxxx\n`);
  }
});
