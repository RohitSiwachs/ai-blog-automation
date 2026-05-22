const axios = require('axios');
const fs = require('fs');
const path = require('path');

const apiKey = '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';
const url = 'https://ai.api.nvidia.com/v1/genai/black-forest-labs/flux.1-schnell';

// Each title gets a UNIQUE, highly descriptive visual prompt
const images = [
  {
    title: "WordPress Mastery: Build Professional Websites Without Coding",
    prompt: "A sleek laptop on a modern white desk showing a beautiful website design on screen, surrounded by floating colorful UI components and drag-and-drop interface elements, soft warm ambient lighting, shallow depth of field, 8k, photorealistic, no text"
  },
  {
    title: "The Ultimate Guide to AI Tools for Business and Education",
    prompt: "A futuristic glowing holographic brain made of blue and purple neural networks floating above a dark conference table, with small AI tool icons orbiting around it, dramatic cinematic lighting, cyberpunk aesthetic, 8k render, no text"
  },
  {
    title: "Web Development Roadmap: From Beginner to Professional Developer",
    prompt: "A winding illuminated road made of glowing code and HTML tags stretching from a small laptop into a massive futuristic city skyline, night scene with neon colors blue orange and green, aerial perspective, 8k cinematic, no text"
  },
  {
    title: "Business Automation Guide: Save Time and Scale Your Company",
    prompt: "A network of interconnected golden gears and robotic arms working together inside a transparent modern office building, with flowing data streams and charts, warm sunrise lighting through glass walls, industrial futuristic style, 8k, no text"
  },
  {
    title: "Digital Skills Every Student and Professional Needs in 2026",
    prompt: "A diverse group of young Indian professionals and students collaborating around a large transparent digital touchscreen display showing various tech skill icons like coding python AI cloud, modern coworking space with plants and natural light, vibrant and energetic mood, 8k photorealistic, no text"
  }
];

async function generateImage(item, index) {
  console.log(`\nGenerating image ${index + 1}/5: "${item.title}"...`);
  console.log(`Prompt: "${item.prompt.substring(0, 80)}..."`);

  try {
    const response = await axios.post(url, {
      prompt: item.prompt,
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
      const filename = `blog_v2_${index + 1}.png`;
      const outputPath = path.join(__dirname, filename);
      fs.writeFileSync(outputPath, buffer);
      console.log(`✅ Success: ${filename} (${(buffer.length / 1024).toFixed(0)} KB)`);
      return filename;
    } else {
      console.log(`❌ Failed: No image data`);
    }
  } catch (error) {
    console.error(`❌ Error:`, error.response ? error.response.status : error.message);
  }
  return null;
}

async function runBatch() {
  console.log("=== NVIDIA Flux.1-Schnell — Unique Blog Banners ===\n");
  for (let i = 0; i < images.length; i++) {
    await generateImage(images[i], i);
  }
  console.log("\n=== Done! ===");
}

runBatch();
