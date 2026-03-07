const axios = require('axios');
const fs = require('fs');

async function test() {
  const url = "https://image.pollinations.ai/prompt/ui%20design?width=1200&height=630&nologo=true";
  console.log("Fetching: ", url);
  try {
    const res = await axios.get(url, { 
      responseType: 'arraybuffer',
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    fs.writeFileSync('test-poll.jpg', res.data);
    console.log("POLLINATIONS size:", res.data.length);
  } catch (e) {
    console.error("POLLINATIONS FAIL:", e.message);
  }

  const lfUrl = "https://loremflickr.com/1200/630/technology,ui,software/all";
  try {
    const res = await axios.get(lfUrl, { responseType: 'arraybuffer' });
    fs.writeFileSync('test-lf.jpg', res.data);
    console.log("LOREMFLICKR size:", res.data.length);
  } catch (e) {
    console.error("LOREMFLICKR FAIL:", e.message);
  }
}
test();
