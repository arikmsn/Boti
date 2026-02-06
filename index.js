const express = require('express');
const axios = require('axios');
const { OpenAI } = require('openai');

const app = express();
app.use(express.json());

// --- משתני סביבה (הגדרנו אותם ב-Render) ---
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "Boti123";

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

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
      console.log(`קיבלתי הודעה: ${msgText}`);
      try {
        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini", 
          messages: [{ role: "user", content: msgText }],
        });

        const botResponse = completion.choices[0].message.content;

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
        console.log("התשובה נשלחה בהצלחה!");
      } catch (err) {
        console.error("שגיאה:", err.message);
      }
    }
    res.sendStatus(200);
  }
});

app.listen(process.env.PORT || 3000, () => console.log('Boti is ready!'));
