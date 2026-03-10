const axios = require('axios');
const token = "87e515a23c56afbbea02929ee376421a2ec5d55f019448f91546309dc324144ec47b764406588a98fda3108e839f7f833c73a347b069bf5f4477521a79f68658263705a5db748893ac5febf88085db91a4adb97931f84855effa72b3d6ea3271531f393e84a27f58699cf501a784ba2414daeb290217ad0f731b44b8573aea50";

async function run() {
  try {
    const res = await axios.get("https://strapi-blog.innovaft.com/api/articles?sort[0]=createdAt:desc&pagination[limit]=1&populate=blocks", { headers: { Authorization: `Bearer ${token}` }});
    const body = res.data.data[0].blocks[0].body;
    const images = body.match(/!\[.*?\]\(.*?\)/g);
    console.log("Found images in markdown:", images);
  } catch (e) {
    console.error(e.message);
  }
}
run();
