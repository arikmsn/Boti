const express = require('express');
const app = express();
app.use(express.json());

// זה החלק שמאשר לפייסבוק שהשרת שלך תקין
app.get('/webhook', (req, res) => {
  const myToken = "Boti123"; // זה הקוד הסודי שאתה ממציא
  
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === myToken) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

app.listen(process.env.PORT || 3000, () => console.log('Boti is awake!'));
