const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason,
    fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');
const express = require('express'); // הוספנו אקספרס כדי להרגיע את Render
const pino = require('pino');

const app = express();
const PORT = process.env.PORT || 3000;

// שרת דמי בשביל Render
app.get('/', (req, res) => res.send('Boti is alive!'));
app.listen(PORT, () => console.log(`Web Server listening on port ${PORT}`));

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const axios = require('axios');

async function startBoti() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false, // נכבה את ה-QR ונעבור לקוד
        logger: pino({ level: 'fatal' }),
        browser: ["Ubuntu", "Chrome", "20.0.04"], // הגדרה קריטית למניעת ניתוקים
    });

    // --- חיבור באמצעות קוד (במקום QR) ---
    // אם אין חיבור קיים, הוא ידפיס קוד ללוג
    if (!sock.authState.creds.registered) {
        const phoneNumber = "972559106275"; // החלף במספר הטלפון של הבוט (כולל קידומת בלי פלוס)
        setTimeout(async () => {
            const code = await sock.requestPairingCode(phoneNumber);
            console.log(`\n--- קוד החיבור שלך הוא: ${code} ---\n`);
            console.log("כנס לוואטסאפ בטלפון -> מכשירים מקושרים -> קישור באמצעות מספר טלפון והקש את הקוד.");
        }, 5000);
    }

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            console.log('מתחבר מחדש...');
            startBoti();
        } else if (connection === 'open') {
            console.log('הבוט מחובר בהצלחה!');
        }
    });

    sock.ev.on('messages.upsert', async m => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const from = msg.key.remoteJid;
        const msgText = msg.message.conversation || msg.message.extendedTextMessage?.text;

        if (msgText) {
            try {
                const geminiUrl = "https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=" + GEMINI_API_KEY;
                const response = await axios.post(geminiUrl, {
                    contents: [{ parts: [{ text: msgText }] }]
                });
                const botResponse = response.data.candidates[0].content.parts[0].text;
                await sock.sendMessage(from, { text: botResponse });
            } catch (err) {
                console.error("שגיאה בתגובה:", err.message);
            }
        }
    });
}

startBoti();
