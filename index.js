const express = require('express');
const axios = require('axios');
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
app.use(express.json());

// --- משתני סביבה מה-Render ---
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;

// הגדרת ה-SDK של גוגל
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// --- אימות Webhook מול מטא ---
app.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token === VERIFY_TOKEN) {
    console.log("Webhook verified successfully!");
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// --- קבלת הודעות ושליחה עם מנגנון הגנה ---
app.post('/webhook', async (req, res) => {
  const body = req.body;

  if (body.object === 'whatsapp_business_account') {
    if (body.entry && body.entry[0].changes && body.entry[0].changes[0].value.messages) {
      const message = body.entry[0].changes[0].value.messages[0];
      const from = message.from;
      const msgText = message.text ? message.text.body : "";

      if (msgText) {
        console.log(`הודעה נכנסת מהמספר ${from}: ${msgText}`);
        
        // רשימת מודלים לניסיון בסדר יורד
        const modelsToTry = ["gemini-1.5-flash-latest", "gemini-1.5-flash", "gemini-pro"];
        let botResponse = "";
        let success = false;

        // לולאת ה-Fallback: מנסה כל מודל עד שמצליח
        for (const modelName of modelsToTry) {
          if (success) break;
          try {
            console.log(`מנסה להשתמש במודל: ${modelName}...`);
            const currentModel = genAI.getGenerativeModel({ model: modelName });
            const result = await currentModel.generateContent(msgText);
            botResponse = result.response.text();
            success = true;
            console.log(`הצלחה! מודל ${modelName} עבד.`);
          } catch (err) {
            console.error(`מודל ${modelName} נכשל: ${err.message}`);
          }
        }

        if (success) {
          try {
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
            console.log("התשובה נשלחה בהצלחה לוואטסאפ!");
          } catch (sendErr) {
            console.error("שגיאה בשליחה למטא:", sendErr.response ? sendErr.response.data : sendErr.message);
          }
        } else {
          console.error("כל ניסיונות ה-AI נכשלו. בדוק את המפתח שלך ב-Google Studio.");
        }
      }
    }
    res.sendStatus(200);
  } else {
    res.sendStatus(404);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Boti Smart Server is online on port ${PORT}`));
