const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

app.get('/webhook', (req, res) => {
  if (req.query['hub.verify_token'] === VERIFY_TOKEN) {
    return res.send(req.query['hub.challenge']);
  } else {
    return res.sendStatus(403);
  }
});

app.post('/webhook', async (req, res) => {
  try {
    const body = req.body;
    
    // בדיקה פשוטה יותר
    if (!body.entry || !body.entry[0] || !body.entry[0].changes || !body.entry[0].changes[0]) {
      return res.sendStatus(200);
    }

    const change = body.entry[0].changes[0];
    const value = change.value;
    
    // וודא שיש הודעה
    if (value.messages && value.messages[0] && value.messages[0].text) {
      const message = value.messages[0];
      const from = message.from;  // 972541234567@c.us
      const msgText = message.text.body;
      
      console.log('הודעה נכנסת מ: ' + from);
      console.log('תוכן: ' + msgText);

      // Gemini – gemini-2.5-flash (הכי טוב אצלך)
      const geminiUrl = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
      
      const geminiResponse = await axios.post(geminiUrl, {
        contents: [{ role: 'user', parts: [{ text: msgText }] }]
      });

      const botResponse = geminiResponse.data.candidates[0].content.parts[0].text;
      console.log('תשובת Gemini: ' + botResponse);

      // שלח תשובה לווטסאפ – תקן את ה-from
      const phoneNumberId = value.metadata.phone_number_id;
      const recipient = from.replace('@c.us', '');  // הסר @c.us

      await axios.post(
        `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          to: recipient,  // עכשיו זה 972541234567 בלי @c.us
          text: { body: botResponse }
        },
        {
          headers: {
            'Authorization': 'Bearer ' + WHATSAPP_TOKEN,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('✅ תשובה נשלחה בהצלחה ל: ' + recipient);
    }
  } catch (err) {
    console.error('❌ שגיאה:');
    console.error(JSON.stringify(err.response?.data, null, 2) || err.message);
  }

  res.sendStatus(200);
});

app.listen(process.env.PORT || 3000, () => 
  console.log('✅ Boti מוכן! שלח הודעה לווטסאפ')
);
