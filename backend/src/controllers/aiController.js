const OpenAI = require("openai");
const config = require("../config/env");

const buildPrompt = ({ name, category, price, keyFeatures, tone, length }) => {
  const features = Array.isArray(keyFeatures)
    ? keyFeatures.join(", ")
    : keyFeatures || "";

  return [
    "You are an ecommerce copywriter.",
    "Return a JSON object with keys: title, shortDescription, longDescription, bullets (array), keywords (array).",
    "Keep language clear and customer-friendly.",
    "Avoid medical or legal claims.",
    `Tone: ${tone || "neutral"}.`,
    `Length: ${length || "medium"}.`,
    `Product name: ${name}.`,
    `Category: ${category || "N/A"}.`,
    price ? `Price: ${price}.` : "",
    features ? `Key features: ${features}.` : "",
  ]
    .filter(Boolean)
    .join("\n");
};

const ensureClient = () => {
  if (!config.openaiApiKey) {
    return null;
  }
  return new OpenAI({ apiKey: config.openaiApiKey });
};

const productDraft = async (req, res, next) => {
  try {
    const client = ensureClient();
    if (!client) {
      return res.status(400).json({ message: "OpenAI API key not configured." });
    }

    const {
      name,
      category,
      price,
      keyFeatures = "",
      tone = "neutral",
      length = "medium",
    } = req.body || {};

    if (!name) {
      return res.status(400).json({ message: "Product name is required." });
    }

    const prompt = buildPrompt({ name, category, price, keyFeatures, tone, length });

    const completion = await client.chat.completions.create({
      model: config.openaiModel,
      temperature: 0.4,
      messages: [
        { role: "system", content: "You write ecommerce product copy." },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
    });

    const content = completion.choices?.[0]?.message?.content || "{}";
    let parsed = {};

    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = {};
    }

    return res.json({
      draft: {
        title: parsed.title || name,
        shortDescription: parsed.shortDescription || "",
        longDescription: parsed.longDescription || "",
        bullets: Array.isArray(parsed.bullets) ? parsed.bullets : [],
        keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
      },
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  productDraft,
};
