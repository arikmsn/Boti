const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

// --- משתני סביבה מה-Render ---
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

// --- אימות Webhook מול מטא ---
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token === VERIFY_TOKEN) {
    console.log("Webhook verified!");
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
          // קריאה ישירה ל-API של ג'מיני עם מודל ה-PRO היציב
          const geminiResponse = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`
            {
              contents: [{ parts: [{ text: msgText }] }]
            },
            { headers: { 'Content-Type': 'application/json' } }
          );

          // חילוץ התשובה מהמבנה של גוגל
          const botResponse = geminiResponse.data.candidates[0].content.parts[0].text;

          // שליחת התשובה חזרה לוואטסאפ דרך מטא
          await axios.post(
            `https://graph.facebook.com/v18.0/${body.entry[0].changes[0].value.metadata.phone_number_id}/messages`,
            {
              messaging_product: "whatsapp",
              to: from,
              text: { body: botResponse },
            },
            { 
              headers: { 
                "Authorization": `Bearer ${WHATSAPP_TOKEN}`,
                "Content-Type": "application/json"
              } 
            }
          );
          console.log("התשובה נשלחה בהצלחה!");
        } catch (err) {
          // הדפסת שגיאה מפורטת ללוג של Render כדי שנדע בדיוק מה קרה
          console.error("שגיאה בתהליך:");
          if (err.response) {
            console.error(JSON.stringify(err.response.data));
          } else {
            console.error(err.message);
          }
        }
      }
    }
    res.sendStatus(200);
  } else {
    res.sendStatus(404);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
