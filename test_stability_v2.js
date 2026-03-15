
const axios = require('axios');
const fs = require('fs');

async function testStability() {
  const title = "Top Web Development Frameworks";
  const prompt = encodeURIComponent(`${title}, clean minimalist technology background, professional studio lighting, 4k`);
  
  // Test 1: Flux without width/height (sometimes faster)
  console.log("Testing Flux (No dimensions)...");
  try {
    const res = await axios.get(`https://image.pollinations.ai/prompt/${prompt}?nologo=true&model=flux`, { responseType: 'arraybuffer', timeout: 30000 });
    fs.writeFileSync('test-flux-simple.jpg', Buffer.from(res.data));
    console.log("  Flux Simple Success!");
  } catch (e) {
    console.log(`  Flux Simple Failed: ${e.message}`);
  }

  // Test 2: Unity model (often faster)
  console.log("Testing Unity...");
  try {
    const res = await axios.get(`https://image.pollinations.ai/prompt/${prompt}?width=1200&height=630&nologo=true&model=unity`, { responseType: 'arraybuffer', timeout: 20000 });
    fs.writeFileSync('test-unity.jpg', Buffer.from(res.data));
    console.log("  Unity Success!");
  } catch (e) {
    console.log(`  Unity Failed: ${e.message}`);
  }

  // Test 3: Unsplash Source (Legacy but sometimes works)
  console.log("Testing Unsplash Source...");
  try {
    const res = await axios.get(`https://source.unsplash.com/featured/1200x630?technology,abstract`, { responseType: 'arraybuffer', timeout: 15000 });
    fs.writeFileSync('test-unsplash.jpg', Buffer.from(res.data));
    console.log("  Unsplash Success!");
  } catch (e) {
    console.log(`  Unsplash Failed: ${e.message}`);
  }

  // Test 4: Picsum (Very stable stock)
  console.log("Testing Picsum...");
  try {
    const res = await axios.get(`https://picsum.photos/1200/630`, { responseType: 'arraybuffer', timeout: 10000 });
    fs.writeFileSync('test-picsum.jpg', Buffer.from(res.data));
    console.log("  Picsum Success!");
  } catch (e) {
    console.log(`  Picsum Failed: ${e.message}`);
  }
}

testStability();
