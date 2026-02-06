const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

// endpoint לבדיקת מודלים זמינים – מחק אחרי השימוש
app.get('/list-models', async (req, res) => {
  try {
    const listUrl = `https://generativelanguage.googleapis.com/v1/models?key=${GEMINI_API_KEY}`;
    const response = await axios.get(listUrl);
    
    let supportedModels = [];
    if (response.data.models) {
      response.data.models.forEach(model => {
        if (model.supportedGenerationMethods && 
            model.supportedGenerationMethods.includes('generateContent')) {
          supportedModels.push({
            name: model.name,
            displayName: model.displayName || 'לא ידוע'
          });
        }
      });
    }
    
    res.json({
      availableModels: supportedModels,
      allModels: response.data.models?.map(m => m.name) || []
    });
  } catch (err) {
    res.status(500).json({ error: err.response?.data || err.message });
  }
});

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

        // נסה מודלים לפי סדר עד שמצליח
        const geminiModels = ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-pro'];
        let geminiResponse = null;
        let workingModel = null;

        for (let model of geminiModels) {
          try {
            const geminiUrl = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
            geminiResponse = await axios.post(geminiUrl, {
              contents: [{ role: 'user', parts: [{ text: msgText }] }]
            });
            workingModel = model;
            console.log(`מודל שעבד: ${model}`);
            break;
          } catch (err) {
            console.log(`מודל ${model} נכשל`);
          }
        }

        let botResponse = 'מצטער, לא הצלחתי לייצר תשובה.';
        if (geminiResponse && geminiResponse.data && geminiResponse.data.candidates && 
            geminiResponse.data.candidates[0] && geminiResponse.data.candidates[0].content && 
            geminiResponse.data.candidates[0].content.parts && geminiResponse.data.candidates[0].content.parts[0]) {
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
    console.error('שגיאה:');
    console.error(err.response ? JSON.stringify(err.response.data) : err.message);
  }

  res.sendStatus(200);
});

app.listen(process.env.PORT || 3000, () => 
  console.log('Boti is online (Gemini Fixed)')
);
