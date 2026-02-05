const express = require('express');
const axios = require('axios');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
app.use(express.json());

// מפתחות - כאן מדביקים את מה שהעתקנו
const GEMINI_API_KEY = "AIzaSyB_zaUu7dK-ugcCXRMIdM18HRWsu5FdZhM";
const WHATSAPP_TOKEN = "EAAZBE0LZA46GwBQiKr5gacQ5rgBypSN4AylRuJLvbZCo9IsO5tKjFM05PDg3fZAxp9Nr97JJpYoy4YF7py3lUXXJ6ZAV51eZBSMYBkh0qP58s3GM1ZA3QWZBCo1SnDMoZA2NEmFrWuYet5cBbkEVIIjz0NthLU5cfkk89o4mVgCBNJblGxsIOJRGMq6HsfG2VolZBiAgpTjeQy8JglfhAg13SiujAF2KY9KJIr1tFQQHd1NUAQexYQzZBDOPahmWLUvT53zLrNwt87XwIY7kvzzkgZDZD";
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// שים לב למבנה: שם המודל בסוגריים הראשונים, והגרסה בשניים
const model = genAI.getGenerativeModel(
  { model: "gemini-1.5-flash" },
  { apiVersion: "v1beta" }
);

app.get('/webhook', (req, res) => {
  if (req.query['hub.verify_token'] === 'Boti123') {
    res.send(req.query['hub.challenge']);
  } else {
    res.sendStatus(403);
  }
});

app.post('/webhook', async (req, res) => {
  const body = req.body;
  if (body.object === 'whatsapp_business_account' && body.entry[0].changes[0].value.messages) {
    const message = body.entry[0].changes[0].value.messages[0];
    const from = message.from;
    const msgText = message.text.body;

    console.log("הודעה ממשתמש: " + msgText);

    try {
      // 1. שואלים את ג'מיני
      const result = await model.generateContent(msgText);
      const botResponse = result.response.text();

      // 2. שולחים את התשובה של ג'מיני לוואטסאפ
      await axios({
        method: "POST",
        url: `https://graph.facebook.com/v18.0/${body.entry[0].changes[0].value.metadata.phone_number_id}/messages`,
        data: {
          messaging_product: "whatsapp",
          to: from,
          text: { body: botResponse },
        },
        headers: { "Authorization": `Bearer ${WHATSAPP_TOKEN}` },
      });
    } catch (err) {
      console.log("שגיאה: " + err.message);
    }
  }
  res.sendStatus(200);
});

app.listen(process.env.PORT || 3000, () => console.log('Boti is now SMART!'));
