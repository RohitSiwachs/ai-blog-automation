
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs = require('fs');

// Note: Ensure your GEMINI_API_KEY is set in your environment
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function testGeminiImage() {
  console.log("Testing Gemini Imagen 3...");
  try {
    // Attempt to use Imagen 3 model with models/ prefix
    const model = genAI.getGenerativeModel({ model: "models/imagen-3.0-generate-001" });
    
    const prompt = "A professional tech blog banner about WordPress security, minimalist, 4k";
    
    // Check if the SDK supports image generation directly (this is a newer feature)
    // Most SDK versions still focus on generateContent
    const result = await model.generateContent(prompt);
    console.log("Response received. Checking for image data...");
    
    // Note: Imagen 3 usually returns a base64 string or a file path
    // This is just a probe to see if the model name is even accepted
    console.log(JSON.stringify(result, null, 2));

  } catch (e) {
    console.error("Gemini Image Test Failed:", e.message);
    if (e.message.includes("not found")) {
      console.log("Model 'imagen-3.0-generate-001' not available for this key/region.");
    }
  }
}

testGeminiImage();
