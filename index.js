// ----- ייבוא ספריות -----
const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');
const express = require('express');
const pino = require('pino');
const axios = require('axios');

// ----- Express בשביל Render -----
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => res.send('Boti (Baileys) is alive!'));
app.listen(PORT, () => console.log(`Web server listening on port ${PORT}`));

// ----- משתני סביבה -----
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// ----- פונקציית הפעלה ראשית -----
async function startBoti() {
  try {
    // מומלץ: למפות את זה לדיסק קבוע ב-Render, למשל /data/auth_info
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    const { version } = await fetchLatestBaileysVersion();

    console.log('Using Baileys version:', version);

    const sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      logger: pino({ level: 'info' }),
      browser: ['Ubuntu', 'Chrome', '20.0.04']
    });

    // ---- Pairing Code (אם אין חיבור רשום) ----
    if (!sock.authState.creds.registered) {
      const phoneNumber = '972559106275'; // החלף למספר הבוט שלך (ללא פלוס)
      console.log('No registered session, requesting pairing code for:', phoneNumber);

      setTimeout(async () => {
        try {
          const code = await sock.requestPairingCode(phoneNumber);
          console.log('\n====================================');
          console.log('קוד החיבור שלך הוא:', code);
          console.log('כנס לוואטסאפ בטלפון → מכשירים מקושרים → קישור באמצעות מספר טלפון והקש את הקוד הזה.');
          console.log('====================================\n');
        } catch (err) {
          console.error('Error requesting pairing code:', err.message);
        }
      }, 5000);
    }

    // ---- שמירת session ----
    sock.ev.on('creds.update', saveCreds);

    // ---- מצב חיבור ----
    sock.ev.on('connection.update', (update) => {
      console.log('connection.update:', update);
      const { connection, lastDisconnect } = update;

      if (connection === 'close') {
        console.log('החיבור נסגר, מנסה להתחבר מחדש...', lastDisconnect?.error?.message);
        startBoti().catch((e) => console.error('Error restarting Boti:', e));
      } else if (connection === 'open') {
        console.log('✅ הבוט מחובר בהצלחה ל-WhatsApp!');
      }
    });

    // ---- קבלת הודעות ----
    sock.ev.on('messages.upsert', async (m) => {
      try {
        console.log('messages.upsert got:', JSON.stringify(m, null, 2));

        const msg = m.messages && m.messages[0];
        if (!msg) {
          console.log('no message object');
          return;
        }

        // לא להגיב להודעות שאתה שלחת מעצמך
        if (msg.key.fromMe) {
          console.log('message from me – skipping');
          return;
        }

        const from = msg.key.remoteJid;
        const msgText =
          msg.message?.conversation ||
          msg.message?.extendedTextMessage?.text ||
          msg.message?.imageMessage?.caption ||
          null;

        if (!msgText) {
          console.log('no text content in message, skipping');
          return;
        }

        console.log('📩 Incoming from', from, 'text:', msgText);

        // ---- קריאה ל-Gemini ----
        const geminiUrl =
          'https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=' +
          GEMINI_API_KEY;

        const aiResp = await axios.post(geminiUrl, {
          contents: [
            {
              role: 'user',
              parts: [{ text: msgText }]
            }
          ]
        });

        const botResponse =
          aiResp.data?.candidates?.[0]?.content?.parts?.[0]?.text ||
          'מצטער, לא הצלחתי לייצר תשובה כרגע.';

        console.log('🤖 Gemini answer:', botResponse);

        // ---- שליחת תשובה ----
        await sock.sendMessage(from, { text: botResponse });
        console.log('✅ Reply sent to', from);
      } catch (err) {
        console.error('❌ Error in messages.upsert handler:', err.response?.data || err.message);
      }
    });
  } catch (err) {
    console.error('❌ Error in startBoti():', err);
  }
}

// הפעלה
startBoti().catch((e) => console.error('Fatal error starting Boti:', e));
