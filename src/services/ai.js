import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * AI ORCHESTRATION LAYER (The "Brain")
 * Routes user input (Voice/Text) to appropriate tools:
 * - Legal (Gemini API)
 * - Schemes (Intent Classification)
 * - Complaint (Intent Classification)
 */

// 🔑 API Keys
const GEMINI_KEY = import.meta.env.VITE_GEMINI_KEY || "YOUR_FALLBACK_KEY_IF_ANY";
const LAW_API_KEY = import.meta.env.VITE_LAW_API_KEY || GEMINI_KEY;

const genAI = new GoogleGenerativeAI(GEMINI_KEY);
const lawGenAI = new GoogleGenerativeAI(LAW_API_KEY);

const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
const lawModel = lawGenAI.getGenerativeModel({ model: "gemini-1.5-flash" });

/**
 * Uses Gemini to classify user intent from text.
 * Returns: { intent: 'SCHEMES' | 'RIGHTS' | 'COMPLAINT' | 'GENERAL', targetIdx: number }
 */
export const analyzeIntent = async (text) => {
  if (GEMINI_KEY === "YOUR_FALLBACK_KEY_IF_ANY") {
    // Fallback to keyword matching if no API key
    const input = text.toLowerCase();
    if (input.includes('pension') || input.includes('scheme') || input.includes('benefit') || input.includes('money')) return { intent: 'SCHEMES', targetIdx: 1 };
    if (input.includes('right') || input.includes('rule') || input.includes('law') || input.includes('wage rate')) return { intent: 'RIGHTS', targetIdx: 2 };
    if (input.includes('complain') || input.includes('boss') || input.includes('safety') || input.includes('hurt')) return { intent: 'COMPLAINT', targetIdx: 3 };
    return { intent: 'GENERAL', targetIdx: 0 };
  }

  const prompt = `Classify the following user message from a worker into exactly one category: SCHEMES, RIGHTS, COMPLAINT, or GENERAL.
  - SCHEMES: If they want to know about government money, pensions, insurance, or benefits.
  - RIGHTS: If they are asking about legal rules, labor laws, constitution, or minimum wage info.
  - COMPLAINT: If they want to report a problem, an injury, or unpaid wages by a boss.
  - GENERAL: Anything else.
  
  User Message: "${text}"
  
  Return ONLY the category name in uppercase.`;

  try {
    const result = await model.generateContent(prompt);
    const intent = result.response.text().trim().toUpperCase();
    
    const indexMap = { 'SCHEMES': 1, 'RIGHTS': 2, 'COMPLAINT': 3, 'GENERAL': 0 };
    return { 
      intent: indexMap[intent] ? intent : 'GENERAL', 
      targetIdx: indexMap[intent] || 0 
    };
  } catch (error) {
    console.error("Intent Analysis Error:", error);
    return { intent: 'GENERAL', targetIdx: 0 };
  }
};

/**
 * Validates if an API key is actually set and not a placeholder
 */
const isValidKey = (key) => {
  return key && key.length > 20 && !key.startsWith("YOUR_");
};

export const getLegalAdvice = async (query, lang = 'en', userProfile = {}) => {
  // 🛡️ DEV/MOCK MODE: If no valid API Key is present, provide high-quality pre-defined advice
  if (!isValidKey(LAW_API_KEY)) {
    const mockAdvice = {
      en: "⚖️ [Demo Mode: AI Brain Offline]\nAs an expert in Indian Labor Laws, I can tell you that under the Code on Wages (2019), you are entitled to minimum wages and overtime protection. If you are a construction worker, ensure you are registered under the BOCW Act to receive insurance benefits of up to ₹2 Lakhs.",
      te: "⚖️ [డెమో మోడ్: AI బ్రెయిన్ ఆఫ్‌లైన్]\nభారతదేశ కార్మిక చట్టాల ప్రకారం, అతి తక్కువ వేతన చట్టం (2019) కింద మీకు సరైన జీతం పొందే హక్కు ఉంది. మీరు నిర్మాణ రంగ కార్మికులైతే, BOCW చట్టం కింద రిజిస్టర్ చేసుకోండి, తద్వారా మీరు ₹2 లక్షల బీమా ప్రయోజనాన్ని పొందవచ్చు."
    };
    return mockAdvice[lang] || mockAdvice['en'];
  }

  const { job = "Unorganized worker", income = "Unknown" } = userProfile;

  const systemPrompt = `You are 'Legal Saathi', a premium AI legal advisor for unorganized workers in India.
  User Profile: Job: ${job}, Income: ${income}.
  Language: ${lang === 'te' ? 'Telugu' : 'English'}.

  Guidelines:
  1. Use easy-to-understand language. Avoid complex legalese.
  2. Cite Indian Constitution Articles (e.g., Art 21, 23) and Labor Codes (Code on Wages 2019).
  3. Be extremely empathetic but professional.
  4. If the user mentions a problem with their boss, explain their right to file a grievance under the IR Code.
  5. Keep responses concise (under 120 words).
  6. Structure the response with bullet points if possible.
  
  IMPORTANT: Response MUST be in ${lang === 'te' ? 'Telugu' : 'English'}.`;

  try {
    const chat = lawModel.startChat({
      history: [
        { role: "user", parts: [{ text: systemPrompt }] },
        { role: "model", parts: [{ text: "Understood. I am Legal Saathi. I will provide clear, cite-backed legal advice to the worker." }] },
      ],
    });

    const result = await chat.sendMessage(query);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Gemini Error:", error);
    const isKeyError = error.message?.includes("API_KEY_INVALID") || error.message?.includes("API key not found");
    
    if (lang === 'te') {
      return isKeyError 
        ? "❌ API కీ తప్పుగా ఉంది. దయచేసి మీ .env ఫైల్‌లో సరైన Gemini API కీని సెట్ చేయండి."
        : "⚠️ సర్వర్‌లో చిన్న సమస్య ఉంది. దయచేసి మీ ఇంటర్నెట్ కనెక్షన్ తనిఖీ చేసి మళ్ళీ ప్రయత్నించండి.";
    }
    return isKeyError
      ? "❌ Invalid API Key. Please check your VITE_LAW_API_KEY in the .env file."
      : "⚠️ Technical error connecting to the Legal Brain. Please check your connectivity and try again.";
  }
};

/**
 * 📸 Gemini Vision: Analyzes images for safety violations
 * Accepts: { inlineData: { data: base64, mimeType: 'image/png' } }
 */
export const analyzeImage = async (imageParts, lang = 'en') => {
  if (!isValidKey(GEMINI_KEY)) {
    return lang === 'te' 
      ? "⚠️ ఫోటో విశ్లేషణ కోసం AI అందుబాటులో లేదు. మీ API కీని సెట్ చేయండి." 
      : "⚠️ Vision AI not available. Please set a valid Gemini API Key.";
  }

  const prompt = `You are a professional Labor Safety Inspector (Nyaya Saathi AI). 
  Look at this photo from a construction site or factory. 
  1. Identify any safety hazards (e.g., missing helmets, no harness, blocked exits, child labor, unsafe scaffolding).
  2. Explain which labor law or safety rule is being violated (e.g., Factories Act 1948 or BOCW Act).
  3. Write a 2-sentence formal complaint draft that the worker can submit.

  IMPORTANT: Response MUST be in ${lang === 'te' ? 'Telugu' : 'English'}. Keep it under 100 words.`;

  try {
    const result = await model.generateContent([prompt, imageParts]);
    return result.response.text();
  } catch (err) {
    console.error("Vision Error:", err);
    return "Failed to analyze image. Ensure it is a clear photo of the worksite.";
  }
};

export const bhashiniMockASR = async (audioBlob) => {
  // Simulating Bhashini WebSocket ASR
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve("Namaste! Mere employer ne meri wage nahi di hai.");
    }, 1500);
  });
};
