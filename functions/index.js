const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { GoogleGenerativeAI } = require("@google/generative-ai");

admin.initializeApp();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

/**
 * Cloud Function to score a project using Gemini AI.
 * Expects { projectId, documentUrls: [] }
 */
exports.scoreProject = functions.https.onCall(async (data, context) => {
  // Check authentication
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "User must be logged in."
    );
  }

  const { projectId, documentUrls } = data;

  if (!projectId || !documentUrls || !Array.isArray(documentUrls)) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Missing projectId or documentUrls."
    );
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

    // 1. Prepare parts for Gemini (text prompt + documents)
    // Note: In a production environment, you'd fetch the files from Firebase Storage 
    // and convert them to base64 or pass them as URI if Gemini supports it directly for your tier.
    // For this MVP, we are assuming text extraction or direct PDF analysis via GenAI SDK.
    
    const prompt = `
      You are an expert institutional infrastructure investor. 
      Analyze the following project documents for a project with ID: ${projectId}.
      
      Documents provided (URLs): ${documentUrls.join(", ")}

      Evaluate the project based on the following criteria and weights:
      1. Financial Transparency & Viability (30%) - Focus on IRR, debt/equity, and unit economics.
      2. Developer Track Record (20%) - Evaluation of the team's ability to execute.
      3. Risk Disclosure & Mitigation (15%) - Analysis of FX, grid, and land risks.
      4. Governance Clarity (15%) - Board structure and decision-making transparency.
      5. Documentation Completeness (10%) - Quality and presence of key diligence docs.
      6. AI Risk Score (10%) - Your independent check for inconsistencies or red flags.

      Output a structured JSON response with the following format:
      {
        "total_score": number (0-100),
        "breakdown": {
          "financials": number (0-100),
          "track_record": number (0-100),
          "risk": number (0-100),
          "governance": number (0-100),
          "documentation": number (0-100),
          "ai_penalty": number (0-100)
        },
        "risk_flags": [string],
        "recommendations": [string],
        "summary": string
      }
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // Clean up JSON if LLM adds markdown blocks
    const jsonStr = text.replace(/```json|```/g, "").trim();
    const scoringResult = JSON.parse(jsonStr);

    // 2. Save result to Supabase or return to frontend
    // In the full flow, this function will write directly to the Supabase 'project_scores' table.
    
    return {
      success: true,
      data: scoringResult
    };

  } catch (error) {
    console.error("Scoring Error:", error);
    throw new functions.https.HttpsError("internal", error.message);
  }
});
