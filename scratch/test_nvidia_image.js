const axios = require('axios');
const fs = require('fs');
const path = require('path');

async function testNvidiaImage() {
  const apiKey = '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';
  const url = 'https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.1-schnell';
  const title = "AI Blog Automation: The Future of Content Creation";
  const prompt = `A professional, high-quality, photorealistic cinematic background for a blog post titled "${title}". Modern, minimalist, studio lighting. 8k, no text, no watermarks. Subject: Futuristic digital automation.`;

  console.log('Generating image using NVIDIA Flux.1-Schnell...');

  try {
    const response = await axios.post(url, {
      prompt: prompt,
      seed: 0
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      timeout: 120000
    });

    const imageBase64 = response.data?.artifacts?.[0]?.base64 || response.data?.image;
    if (imageBase64) {
      const buffer = Buffer.from(imageBase64, 'base64');
      const outputPath = path.join(__dirname, 'test_image.png');
      fs.writeFileSync(outputPath, buffer);
      console.log('--- Success ---');
      console.log('Image saved to:', outputPath);
    } else {
      console.log('--- Failed ---');
      console.log('No image data in response:', JSON.stringify(response.data, null, 2));
    }
  } catch (error) {
    console.log('--- Failed ---');
    console.error('Status:', error.response ? error.response.status : error.message);
    if (error.response && error.response.data) {
        console.error('Error Details:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

testNvidiaImage();
