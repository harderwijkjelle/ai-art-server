const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const nodemailer = require('nodemailer');
const app = express();

app.use(bodyParser.json({ limit: '10mb' }));

const replicateApiKey = 'r8_OJfTaqwXmFj7n6yUL6bx2LSGRDJYU660vGlZc';
const emailReceiver = 'suppjelle@gmail.com';

// AI modellen per stijl
const models = {
  'Cartoon': 'nitrosocke/cartoonify',
  'Olieverf': 'stability-ai/sdxl',
  'Schets': 'tencentarc/gfpgan',
  'Waterverf': 'kandinsky-community/kandinsky-3'
};

app.post('/webhook', async (req, res) => {
  try {
    const order = req.body;

    const lineItems = order.line_items || [];
    for (const item of lineItems) {
      const props = item.properties || {};
      const imageUrl = props['Foto upload'];
      const style = props['Kunststijl'];
      const model = models[style];

      if (!imageUrl || !model) continue;

      const prediction = await axios.post(
        `https://api.replicate.com/v1/predictions`,
        {
          version: 'latest',
          input: {
            image: imageUrl
          }
        },
        {
          headers: {
            Authorization: `Token ${replicateApiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const getUrl = prediction.data.urls.get;

      let outputUrl = null;
      for (let i = 0; i < 20; i++) {
        const poll = await axios.get(getUrl, {
          headers: { Authorization: `Token ${replicateApiKey}` }
        });
        if (poll.data.status === 'succeeded') {
          outputUrl = poll.data.output;
          break;
        }
        await new Promise(r => setTimeout(r, 3000));
      }

      if (outputUrl) {
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: 'suppjelle@gmail.com',
            pass: 'YOUR-GMAIL-APP-PASSWORD'
          }
        });

        await transporter.sendMail({
          from: '"AI Kunstwinkel" <suppjelle@gmail.com>',
          to: emailReceiver,
          subject: `Nieuwe AI afbeelding in stijl ${style}`,
          html: `<p>Hier is de afbeelding in stijl <strong>${style}</strong>:</p><img src="${outputUrl}" width="500"/>`
        });
      }
    }

    res.status(200).send('Webhook verwerkt');
  } catch (error) {
    console.error(error);
    res.status(500).send('Fout bij verwerken webhook');
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Webhook draait op poort ${port}`));
