app.post('/generate', async (req, res) => {
  try {
    const { prompt, image, color } = req.body;

    if (!prompt || !image) {
      return res.status(400).json({ error: 'Missing prompt or image' });
    }

    if (!REPLICATE_API_TOKEN) {
      return res.status(500).json({ error: 'Missing Replicate API token' });
    }

    const hairColor = color && color !== "Natural" ? `${color} ` : "";

    // ✅ Optimized prompt for realism + identity preservation
    const fullPrompt = `
Professional studio portrait of the same person, preserving facial identity, facial structure, skin tone, and expression.
Apply a ${hairColor}${prompt} hairstyle naturally integrated with the head shape.
Realistic hair strands, accurate hairline, natural lighting, sharp focus, 8k resolution, DSLR photo, cinematic lighting, highly detailed.
    `;

    // ✅ Negative prompt to prevent distortions
    const negativePrompt = `
deformed face, distorted features, unrealistic hair, wig, low quality, blurry, extra limbs, bad anatomy, cartoon, anime, overexposed, underexposed
    `;

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
          version: "bytedance/sdxl-lightning-4step",
          input: {
            prompt: fullPrompt,
            negative_prompt: negativePrompt,
            image: formattedImage,
            strength: 0.65,
            guidance_scale: 6.5,
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