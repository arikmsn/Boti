const express = require('express');
const axios = require('axios'); // ספריה שעוזרת לשלוח הודעות
const app = express();
app.use(express.json());

const VERIFY_TOKEN = 'Boti123';
// כאן תצטרך להדביק את הטוקן שתקבל מ-Meta (נסביר לך איך עוד רגע)
const ACCESS_TOKEN = 'EAAZBE0LZA46GwBQiKr5gacQ5rgBypSN4AylRuJLvbZCo9IsO5tKjFM05PDg3fZAxp9Nr97JJpYoy4YF7py3lUXXJ6ZAV51eZBSMYBkh0qP58s3GM1ZA3QWZBCo1SnDMoZA2NEmFrWuYet5cBbkEVIIjz0NthLU5cfkk89o4mVgCBNJblGxsIOJRGMq6HsfG2VolZBiAgpTjeQy8JglfhAg13SiujAF2KY9KJIr1tFQQHd1NUAQexYQzZBDOPahmWLUvT53zLrNwt87XwIY7kvzzkgZDZD'; 

// אימות ה-Webhook (מה שכבר עשית)
app.get('/webhook', (req, res) => {
  if (req.query['hub.verify_token'] === VERIFY_TOKEN) {
    res.send(req.query['hub.challenge']);
  } else {
    res.sendStatus(403);
  }
});

// קבלת הודעות ושליחת תשובה
app.post('/webhook', async (req, res) => {
  const body = req.body;

  if (body.object === 'whatsapp_business_account') {
    if (body.entry && body.entry[0].changes && body.entry[0].changes[0].value.messages) {
      const message = body.entry[0].changes[0].value.messages[0];
      const from = message.from; // מספר הטלפון של השולח
      const msgText = message.text.body; // הטקסט שנשלח

      console.log(`קיבלתי הודעה מ-${from}: ${msgText}`);

      // שליחת תשובה אוטומטית
      try {
        await axios({
          method: "POST",
          url: `https://graph.facebook.com/v18.0/${body.entry[0].changes[0].value.metadata.phone_number_id}/messages`,
          data: {
            messaging_product: "whatsapp",
            to: from,
            text: { body: "קיבלתי את ההודעה שלך! אני Boti." },
          },
          headers: { "Authorization": `Bearer ${ACCESS_TOKEN}` },
        });
      } catch (err) {
        console.log("שגיאה בשליחה: " + err.message);
      }
    }
    res.sendStatus(200);
  } else {
    res.sendStatus(404);
  }
});

app.listen(process.env.PORT || 3000, () => console.log('Boti is ready to talk!'));
