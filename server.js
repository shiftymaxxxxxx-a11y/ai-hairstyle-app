
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();

// Increase JSON limit to handle camera images
app.use(express.json({ limit: '50mb' }));
app.use(cors());

// 🔴 Hardcoded token (as requested)
const REPLICATE_API_TOKEN = "r8_Q8a3ESeEhpiotoRU5XhwXNYNY46AJ6P2aDRVC";

// Hairstyles
const hairstyles = [
  "Short Bob",
  "Pixie Cut",
  "Long Layers",
  "Curly Bob",
  "Blunt Bangs",
  "Medium Layered",
  "French Braids",
  "Buzz Cut",
  "Afro",
  "Side Part",
  "Top Knot",
  "Mohawk"
];

// Colors
const colors = [
  "Natural",
  "Platinum Blonde",
  "Ash Brown",
  "Jet Black",
  "Copper Red",
  "Pastel Pink",
  "Silver Gray",
  "Electric Blue",
  "Lavender",
  "Golden Blonde",
  "Honey Brown"
];

// GET routes
app.get('/hairstyles', (req, res) => res.json(hairstyles));
app.get('/colors', (req, res) => res.json(colors));

// 🔥 GENERATE ROUTE
app.post('/generate', async (req, res) => {
  try {
    const { prompt, image, color } = req.body;

    if (!prompt || !image) {
      return res.status(400).json({ error: 'Missing prompt or image' });
    }

    const hairColor = color && color !== "Natural" ? `${color} ` : "";
    const fullPrompt = `A professional studio portrait of a person with ${hairColor}${prompt} hairstyle, high quality, realistic, 8k resolution, cinematic lighting`;

    console.log(`\n--- Generating: ${fullPrompt} ---`);

    // Ensure base64 format
    const formattedImage = image.startsWith('data:image')
      ? image
      : `data:image/jpeg;base64,${image}`;

    // 1️⃣ Create prediction
    let replicateResponse;
    try {
      replicateResponse = await axios.post(
  'https://api.replicate.com/v1/predictions',
  {
    version: "black-forest-labs/flux-2-pro", // realistic vision img2img
    input: {
      prompt: fullPrompt,
      image: formattedImage,
      strength: 0.75,
      num_inference_steps: 30
    }
  },
        {
          headers: {
            'Authorization': `Token ${REPLICATE_API_TOKEN}`,
            'Content-Type': 'application/json'
          }
        }
      );
    } catch (err) {
      console.error("Replicate error:", err.response?.data || err.message);
      return res.status(502).json({
        error: 'Replicate request failed',
        details: err.response?.data || err.message
      });
    }

    const predictionId = replicateResponse.data.id;
    console.log(`Prediction ID: ${predictionId}`);

    // 2️⃣ Poll result
    let status = 'starting';
    let outputUrl = null;
    let attempts = 0;

    while (
      status !== 'succeeded' &&
      status !== 'failed' &&
      attempts < 60
    ) {
      await new Promise(r => setTimeout(r, 2000));

      const poll = await axios.get(
        `https://api.replicate.com/v1/predictions/${predictionId}`,
        {
          headers: {
            'Authorization': `Token ${REPLICATE_API_TOKEN}`
          }
        }
      );

      status = poll.data.status;
      console.log(`Status: ${status}`);

      if (status === 'succeeded') {
        outputUrl = Array.isArray(poll.data.output)
          ? poll.data.output[0]
          : poll.data.output;
      }

      if (status === 'failed') {
        console.error("Replicate failed:", poll.data.error);
      }

      attempts++;
    }

    if (!outputUrl) {
      return res.status(500).json({
        error: 'Generation failed or timed out'
      });
    }

    // 3️⃣ Return result
    res.json({ image: outputUrl });

  } catch (error) {
    console.error("Server error:", error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start server
const PORT = 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n==============================`);
  console.log(`Server running on port ${PORT}`);
  console.log(`==============================\n`);
});