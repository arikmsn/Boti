const express = require('express');
const axios = require('axios');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
app.use(express.json());

// --- הגדרות מפתחות ---
const GEMINI_API_KEY = "AIzaSyB_zaUu7dK-ugcCXRMIdM18HRWsu5FdZhM";
const WHATSAPP_TOKEN = "EAAZBE0LZA46GwBQiKr5gacQ5rgBypSN4AylRuJLvbZCo9IsO5tKjFM05PDg3fZAxp9Nr97JJpYoy4YF7py3lUXXJ6ZAV51eZBSMYBkh0qP58s3GM1ZA3QWZBCo1SnDMoZA2NEmFrWuYet5cBbkEVIIjz0NthLU5cfkk89o4mVgCBNJblGxsIOJRGMq6HsfG2VolZBiAgpTjeQy8JglfhAg13SiujAF2KY9KJIr1tFQQHd1NUAQexYQzZBDOPahmWLUvT53zLrNwt87XwIY7kvzzkgZDZD";
const VERIFY_TOKEN = "Boti123"; // הטוקן שהגדרת ב-Webhook של מטא

// שינינו את השם ל-gemini-1.5-flash-8b (גרסה קלה ומהירה יותר שתמיד זמינה)
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel(
  { model: "gemini-1.5-flash-8b" }, 
  { apiVersion: "v1beta" }
);

// --- אימות ה-Webhook מול מטא ---
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token === VERIFY_TOKEN) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// --- קבלת הודעות ושליחת תשובות ---
app.post('/webhook', async (req, res) => {
  const body = req.body;

  // בדיקה אם זו הודעת וואטסאפ נכנסת
  if (body.object === 'whatsapp_business_account') {
    if (body.entry && body.entry[0].changes && body.entry[0].changes[0].value.messages) {
      const message = body.entry[0].changes[0].value.messages[0];
      const from = message.from; // המספר של המשתמש
      const msgText = message.text ? message.text.body : ""; // הטקסט שהמשתמש שלח

      if (msgText) {
        console.log(`קיבלתי הודעה מ-${from}: ${msgText}`);

        try {
          // 1. שואלים את ג'מיני ומקבלים תשובה
          const result = await model.generateContent(msgText);
          const response = await result.response;
          const botResponse = response.text();

          // 2. שולחים את התשובה חזרה לוואטסאפ
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
          console.log("התשובה נשלחה בהצלחה!");
        } catch (err) {
          console.error("שגיאה בתהליך:", err.response ? err.response.data : err.message);
        }
      }
    }
    res.sendStatus(200);
  } else {
    res.sendStatus(404);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Boti is online on port ${PORT}`));
