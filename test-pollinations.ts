import axios from 'axios';

async function test() {
  const title = "Testing blog banner with modern 3d tech illustration";
  const prompt = encodeURIComponent(title);
  const url = `https://image.pollinations.ai/prompt/${prompt}?width=1200&height=630&nologo=true`;
  console.log("Fetching URL:", url);
  try {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    console.log("Success! Image size:", response.data.length);
  } catch (error: any) {
    console.error("Failed to fetch image:", error.message);
  }
}

test();
