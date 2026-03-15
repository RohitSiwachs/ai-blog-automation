
const OpenAI = require('openai');
const axios = require('axios');
const fs = require('fs');

async function testDalle() {
  const apiKey = "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";
  const openai = new OpenAI({ apiKey });

  const title = "Innovations in Artificial Intelligence for Healthcare";
  console.log(`Testing DALL-E 3 for title: "${title}"`);

  try {
    const start = Date.now();
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: `A professional, high-quality, photorealistic cinematic background for a blog post titled "${title}". The style should be modern, clean, and minimalist with professional lighting. 8k resolution, cinematic atmosphere. No text or logos.`,
      n: 1,
      size: "1024x1024",
      quality: "standard",
    });

    const imageUrl = response.data[0].url;
    console.log(`DALL-E 3 URL received: ${imageUrl}`);

    const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(imageResponse.data);
    
    fs.writeFileSync('test-dalle-banner.png', buffer);
    console.log(`Success! Image saved to test-dalle-banner.png (${(buffer.length / 1024).toFixed(1)} KB)`);
    console.log(`Time taken: ${((Date.now() - start) / 1000).toFixed(1)}s`);
  } catch (e) {
    console.error(`DALL-E 3 Failed: ${e.message}`);
    if (e.response) {
      console.error(`Status: ${e.response.status}`);
      console.error(`Data: ${JSON.stringify(e.response.data)}`);
    }
  }
}

testDalle();
