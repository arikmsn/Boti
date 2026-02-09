const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason 
} = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const pino = require('pino');
const axios = require('axios');

// משתני סביבה (נשאר רק המפתח של ה-AI)
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

async function connectToWhatsApp() {
    // ניהול זיכרון החיבור (נשמר בתיקייה auth_info)
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true, // זה ידפיס את ה-QR בלוגים
        logger: pino({ level: 'silent' })
    });

    // שמירת שינויים בחיבור
    sock.ev.on('creds.update', saveCreds);

    // ניהול מצב החיבור (מחובר/מנותק)
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Connection closed, reconnecting...', shouldReconnect);
            if (shouldReconnect) connectToWhatsApp();
        } else if (connection === 'open') {
            console.log('Boti is Connected to WhatsApp!');
        }
    });

    // האזנה להודעות נכנסות
    sock.ev.on('messages.upsert', async m => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return; // מתעלם מהודעות של עצמי

        const from = msg.key.remoteJid;
        const msgText = msg.message.conversation || msg.message.extendedTextMessage?.text;

        if (msgText) {
            console.log(`הודעה נכנסת מ-${from}: ${msgText}`);

            try {
                // קריאה ל-AI (השתמשתי במודל שעבד לך קודם)
                const geminiUrl = "https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=" + GEMINI_API_KEY;
                const response = await axios.post(geminiUrl, {
                    contents: [{ parts: [{ text: msgText }] }]
                });

                const botResponse = response.data.candidates[0].content.parts[0].text;

                // שליחת הודעה דרך Baileys (בחינם!)
                await sock.sendMessage(from, { text: botResponse });
                
            } catch (err) {
                console.error("Error processing message:", err.message);
            }
        }
    });
}

connectToWhatsApp();
