const axios = require('axios');
const fs = require('fs');
const path = require('path');

const apiKey = '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';
const url = 'https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.1-schnell';

const titles = [
  "WordPress Mastery: Build Professional Websites Without Coding",
  "The Ultimate Guide to AI Tools for Business and Education",
  "Web Development Roadmap: From Beginner to Professional Developer",
  "Business Automation Guide: Save Time and Scale Your Company",
  "Digital Skills Every Student and Professional Needs in 2026"
];

async function generateImage(title, index) {
  const prompt = `A professional, high-quality, photorealistic cinematic background for a blog post titled "${title}". Modern, minimalist, studio lighting. 8k, no text, no watermarks.`;
  
  console.log(`Generating image ${index + 1}/5: "${title}"...`);

  try {
    const response = await axios.post(url, {
      prompt: prompt,
      seed: Math.floor(Math.random() * 1000000)
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
      const filename = `blog_image_${index + 1}.png`;
      const outputPath = path.join(__dirname, filename);
      fs.writeFileSync(outputPath, buffer);
      console.log(`--- Success: ${filename} ---`);
      return filename;
    } else {
      console.log(`--- Failed: No data for "${title}" ---`);
    }
  } catch (error) {
    console.error(`--- Failed: ${title} ---`, error.response ? error.response.status : error.message);
  }
  return null;
}

async function runBatch() {
  for (let i = 0; i < titles.length; i++) {
    await generateImage(titles[i], i);
  }
}

runBatch();
