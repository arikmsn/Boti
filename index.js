const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

app.get('/webhook', (req, res) => {
  if (req.query['hub.verify_token'] === VERIFY_TOKEN) {
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
    const msgText = message.text ? message.text.body : "";

    if (msgText) {
      console.log(`הודעה נכנסת: ${msgText}`);
      try {
        // בקשה ישירה ל-API של גוגל (עוקף את ה-SDK הבעייתי)
        const response = await axios.post(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
          {
            contents: [{ parts: [{ text: msgText }] }]
          },
          { headers: { 'Content-Type': 'application/json' } }
        );

        const botResponse = response.data.candidates[0].content.parts[0].text;

        // שליחה לוואטסאפ
        await axios.post(
          `https://graph.facebook.com/v18.0/${body.entry[0].changes[0].value.metadata.phone_number_id}/messages`,
          {
            messaging_product: "whatsapp",
            to: from,
            text: { body: botResponse },
          },
          { headers: { "Authorization": `Bearer ${WHATSAPP_TOKEN}` } }
        );
        console.log("תשובה נשלחה בהצלחה!");
      } catch (err) {
        console.error("שגיאה מפורטת:", err.response ? JSON.stringify(err.response.data) : err.message);
      }
    }
  }
  res.sendStatus(200);
});

app.listen(process.env.PORT || 3000, () => console.log('Boti is Ready!'));
