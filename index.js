const express = require('express');
const axios = require('axios');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
app.use(express.json());

// --- משתני סביבה מה-Render ---
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

// --- הגדרת Gemini ---
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// --- אימות Webhook מול מטא ---
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token === VERIFY_TOKEN) {
    console.log("Webhook verified successfully!");
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// --- קבלת הודעות ושליחה ---
app.post('/webhook', async (req, res) => {
  const body = req.body;

  if (body.object === 'whatsapp_business_account') {
    if (body.entry && body.entry[0].changes && body.entry[0].changes[0].value.messages) {
      const message = body.entry[0].changes[0].value.messages[0];
      const from = message.from;
      const msgText = message.text ? message.text.body : "";

      if (msgText) {
        console.log(`הודעה נכנסת: ${msgText}`);
        try {
          // שאילתה לג'מיני
          const result = await model.generateContent(msgText);
          const botResponse = result.response.text();

          // שליחה חזרה לוואטסאפ
          await axios({
            method: "POST",
            url: `https://graph.facebook.com/v18.0/${body.entry[0].changes[0].value.metadata.phone_number_id}/messages`,
            data: {
              messaging_product: "whatsapp",
              to: from,
              text: { body: botResponse },
            },
            headers: { 
              "Authorization": `Bearer ${WHATSAPP_TOKEN}`,
              "Content-Type": "application/json"
            },
          });
          console.log("תשובה נשלחה בהצלחה!");
        } catch (err) {
          console.error("שגיאה:", err.message);
        }
      }
    }
    res.sendStatus(200);
  } else {
    res.sendStatus(404);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Boti is running on port ${PORT}`));
