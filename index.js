const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

// בחר אחד המודלים התקניים ל-v1
// gemini-flash-latest  או  gemini-2.0-flash  וכו'
const GEMINI_MODEL = 'gemini-flash-latest'; 

app.get('/webhook', (req, res) => {
  if (req.query['hub.verify_token'] === VERIFY_TOKEN) {
    return res.send(req.query['hub.challenge']);
  } else {
    return res.sendStatus(403);
  }
});

app.post('/webhook', async (req, res) => {
  const body = req.body;

  try {
    if (
      body.object === 'whatsapp_business_account' &&
      body.entry &&
      body.entry[0] &&
      body.entry[0].changes &&
      body.entry[0].changes[0] &&
      body.entry[0].changes[0].value &&
      body.entry[0].changes[0].value.messages &&
      body.entry[0].changes[0].value.messages[0]
    ) {
      const message = body.entry[0].changes[0].value.messages[0];
      const from = message.from;
      const msgText = message.text ? message.text.body : '';

      if (msgText) {
        console.log('הודעה נכנסת: ' + msgText);

        // שים לב לשינוי: מודל עדכני ונתיב נכון
        const geminiUrl = `https://generativelanguage.googleapis.com/v1/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

        const geminiResponse = await axios.post(geminiUrl, {
          contents: [
            {
              role: 'user',
              parts: [{ text: msgText }],
            },
          ],
        });

        let botResponse = 'מצטער, לא הצלחתי לייצר תשובה.';

        if (
          geminiResponse.data &&
          geminiResponse.data.candidates &&
          geminiResponse.data.candidates[0] &&
          geminiResponse.data.candidates[0].content &&
          geminiResponse.data.candidates[0].content.parts &&
          geminiResponse.data.candidates[0].content.parts[0] &&
          geminiResponse.data.candidates[0].content.parts[0].text
        ) {
          botResponse = geminiResponse.data.candidates[0].content.parts[0].text;
        }

        await axios.post(
          `https://graph.facebook.com/v18.0/${body.entry[0].changes[0].value.metadata.phone_number_id}/messages`,
          {
            messaging_product: 'whatsapp',
            to: from,
            text: { body: botResponse },
          },
          {
            headers: {
              Authorization: 'Bearer ' + WHATSAPP_TOKEN,
              'Content-Type': 'application/json',
            },
          }
        );

        console.log('תשובה נשלחה בהצלחה!');
      }
    }
  } catch (err) {
    console.error('שגיאה בקריאה ל-Gemini או ל-WhatsApp:');
    console.error(
      err.response
        ? JSON.stringify(err.response.data, null, 2)
        : err.message
    );
  }

  // חשוב להחזיר 200 לפייסבוק גם אם הייתה שגיאה
  res.sendStatus(200);
});

app.listen(process.env.PORT || 3000, () =>
  console.log('Boti is online (v1, Gemini)')
);
