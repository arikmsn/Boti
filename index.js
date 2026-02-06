const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

// משתני סביבה
const PPLX_API_KEY = process.env.PPLX_API_KEY;      // Perplexity
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;  // WhatsApp Cloud API
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;      // Webhook verify token

// Verify webhook מ-WhatsApp
app.get('/webhook', (req, res) => {
  if (req.query['hub.verify_token'] === VERIFY_TOKEN) {
    return res.send(req.query['hub.challenge']);
  } else {
    return res.sendStatus(403);
  }
});

// Webhook לקבלת הודעות
app.post('/webhook', async (req, res) => {
  try {
    const body = req.body;

    if (
      !body.entry ||
      !body.entry[0] ||
      !body.entry[0].changes ||
      !body.entry[0].changes[0]
    ) {
      return res.sendStatus(200);
    }

    const change = body.entry[0].changes[0];
    const value = change.value;

    if (value.messages && value.messages[0] && value.messages[0].text) {
      const message = value.messages[0];
      const from = message.from;           // לדוגמה: 9725XXXXXXX@c.us
      const msgText = message.text.body;

      console.log('WhatsApp from:', from);
      console.log('User message:', msgText);

      // ===== קריאה ל-Perplexity =====
      const pplxUrl = 'https://api.perplexity.ai/chat/completions';

      const pplxResponse = await axios.post(
        pplxUrl,
        {
          model: 'sonar',   // אפשר להחליף למודל אחר לפי התיעוד
          messages: [
            {
              role: 'system',
              content: 'You are a helpful assistant responding on WhatsApp.'
            },
            {
              role: 'user',
              content: msgText
            }
          ]
        },
        {
          headers: {
            Authorization: `Bearer ${PPLX_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const botResponse =
        pplxResponse.data.choices[0].message.content ||
        'I could not generate a response.';

      console.log('Perplexity answer:', botResponse);

      // ===== שליחת תשובה ל-WhatsApp =====
      const phoneNumberId = value.metadata.phone_number_id;
      const recipient = from.replace('@c.us', ''); // 9725XXXXXXX

      await axios.post(
        `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          to: recipient,
          text: { body: botResponse }
        },
        {
          headers: {
            Authorization: 'Bearer ' + WHATSAPP_TOKEN,
            'Content-Type': 'application/json'
          }
        }
      );

      console.log('✅ WhatsApp reply sent to:', recipient);
    }
  } catch (err) {
    console.error('❌ Error:');
    console.error(JSON.stringify(err.response?.data || err.message, null, 2));
  }

  res.sendStatus(200);
});

// הפעלת השרת
app.listen(process.env.PORT || 3000, () => {
  console.log('Boti Perplexity branch is online');
});
