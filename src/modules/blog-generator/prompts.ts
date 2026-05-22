// ============================================================
// Gemini Prompt Templates
// Structured prompts for generating SEO-optimized blog content
// formatted for blog.innovaft.com (Strapi schema).
// ============================================================

/**
 * Builds the main blog generation prompt for the Gemini API.
 * Output is a JSON with Markdown content + full SEO fields.
 */
export function buildBlogPrompt(title: string, keywords: string[], categories: string[]): string {
  const keywordList = keywords.join(', ');
  const categoryList = categories.join(', ');
  const today = new Date().toISOString();

  return `You are an expert SEO content writer for a tech blog (blog.innovaft.com). Write a comprehensive, engaging, and SEO-optimized blog post.

TOPIC: "${title}"
TARGET KEYWORDS: ${keywordList}
AVAILABLE CATEGORIES: ${categoryList}
TODAY'S DATE: ${today}

=== CONTENT REQUIREMENTS ===
1. Write 1500-2000 words of engaging, highly conversational content.
2. Formatted in MARKDOWN (use #, ##, ###, **bold**, *italic*, bullet lists, etc.).
3. TONE & STYLE: Write like a passionate, experienced human expert talking directly to a friend. Use varied sentence lengths. Ask rhetorical questions. Include brief personal anecdotes or metaphors. 
4. FORBIDDEN AI CLICHÉS: NEVER use phrases like "In today's fast-paced digital world", "Delve into", "Navigating the complexities", "In conclusion", or "A testament to".
5. INLINE IMAGES (CRITICAL): You MUST insert exactly 2 images into the markdown body content.
Use this EXACT layout:
![Image Description](https://image.pollinations.ai/prompt/descriptive-hyphenated-prompt?width=1024&height=1024&nologo=true&model=flux)
RULES FOR THE URL: The prompt part can ONLY contain hyphens (e.g., student-using-laptop). NO commas. NO spaces.
6. Naturally incorporate the target keywords throughout
7. NO filler content — every paragraph must provide value

=== SEO REQUIREMENTS ===
- seoTitle: Google-optimized, max 60 chars, includes primary keyword
- metaDescription: Compelling, exactly 150-160 chars, includes keyword
- ogTitle: Slightly different from seoTitle, more engaging/clickbait-friendly, max 70 chars
- ogDescription: More conversational than metaDescription, 150-200 chars
- metaKeywords: comma-separated, 6-8 keywords
- description: Short excerpt shown on blog listing, max 180 chars, no HTML

=== CATEGORY & TAGS REQUIREMENT ===
1. Pick the best fitting category for this blog from the AVAILABLE CATEGORIES list: ${categoryList}. Return EXACTLY one of these names.
2. Generate EXACTLY 2 short tags relevant to the topic (e.g. "AI", "Web Dev"). No more, no less.

=== OUTPUT FORMAT ===
Respond with ONLY this JSON (no markdown fences, no extra text):
{
  "seoTitle": "Max 60 char SEO title",
  "metaDescription": "150-160 char meta description",
  "ogTitle": "Max 70 char engaging OG title",
  "ogDescription": "150-200 char OG description",
  "metaKeywords": "keyword1, keyword2, keyword3, keyword4, keyword5",
  "description": "Short blog listing excerpt, max 180 chars",
  "category": "One name from the provided list",
  "tags": ["Tag1", "Tag2"],
  "content": "# Your H1 Title Here\\n\\nFirst paragraph...\\n\\n## Section 1\\n\\nContent...\\n\\n## Section 2\\n\\nContent..."
}

=== JSON SAFETY & ESCAPING (CRITICAL) ===
- In the "content" string:
  - EVERY double quote (") MUST be escaped as \\". Example: He said \\"Hello\\".
  - EVERY newline MUST be escaped as \\n.
  - DO NOT use real newlines or unescaped quotes inside the JSON values.
- If you fail to follow this, the parser will break. Be extremely careful.

CRITICAL RULES:
- Return ONLY valid JSON. No markdown code fences. No text before or after.
- "category" MUST be exactly one of the items from AVAILABLE CATEGORIES.
- "content" MUST be in Markdown format (not HTML).
- metaDescription MUST be 150-160 characters — count carefully.
- Make content sound human-written, not AI-generated.`;
}

/**
 * Builds the prompt for the second-pass "Humanizer" LLM.
 * Directs the LLM to refine the generated markdown to sound natural, organic, and engaging.
 */
export function buildHumanizerPrompt(content: string): string {
  return `You are a professional senior editor. Rewrite the following AI-generated blog post to make it sound 100% human, highly organic, and conversational.

=== CRITICAL LINGUISTIC RULES ===
1. VARIATION (BURSTINESS): AI writes with extremely consistent sentence lengths and rhythms. Humans write with natural "burstiness" — some sentences are long, flowing, and descriptive, while others are extremely short and punchy. Vary sentence lengths and structures drastically.
2. NATURAL TRANSITIONS: NEVER use rigid AI transition words like "Furthermore", "Moreover", "In summary", "Crucially", "Consequently", "It is important to remember", or "In conclusion". Use natural human transitions ("Actually,", "So,", "But here is the thing...", "That means...", "To be honest,").
3. NO CLICHÉS: Ban generic corporate AI terms like "delve", "testament", "pave the way", "revolutionize", "multifaceted", "beacon", "look no further", or "in today's digital landscape". Use smart, everyday, professional vocabulary.
4. TONE & FLOW: Write like an experienced human expert explaining a topic to a close colleague over coffee. Warm, authentic, energetic, and completely devoid of fluff or academic stiffness. Use organic contractions ("don't", "it's", "you'll", "we're") naturally.
5. PRESERVE MARKDOWN STRUCTURE (CRITICAL): Keep all markdown headings (#, ##, ###), bold text, lists, and bullet points.
6. PRESERVE IMAGE LINKS (MANDATORY): Do NOT alter, rewrite, remove, or modify any markdown image links (e.g. ![Image](https://image.pollinations.ai/...)). Leave them exactly as they are in their original positions.

ORIGINAL AI-GENERATED TEXT:
${content}

OUTPUT:
Respond with ONLY the rewritten markdown text. No conversational introductions, no markdown code fences (like \`\`\`markdown), and no extra notes. Start writing the blog post immediately.`;
}
