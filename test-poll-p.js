const axios = require('axios');
const fs = require('fs');

async function test() {
  const prompt = encodeURIComponent("modern 3d tech illustration of students using ai tools");
  const url = `https://pollinations.ai/p/${prompt}`;
  console.log("Fetching: ", url);
  try {
    const res = await axios.get(url, { 
      responseType: 'arraybuffer',
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    fs.writeFileSync('test-poll-p.jpg', res.data);
    console.log("SUCCESS! POLLINATIONS /p/ size:", res.data.length);
  } catch (e) {
    console.error("FAIL:", e.message);
  }
}
test();
