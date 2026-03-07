import axios from 'axios';
import * as fs from 'fs';

async function test() {
  const url = "https://loremflickr.com/1200/630/technology,software,ui/all";
  console.log("Fetching: ", url);
  try {
    const res = await axios.get(url, { 
      responseType: 'arraybuffer'
    });
    fs.writeFileSync('test-lorem.jpg', res.data);
    console.log("Saved test-lorem.jpg. size:", res.data.length);
  } catch (e: any) {
    console.error("FAIL:", e.message);
  }
}
test();
