const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { GoogleGenerativeAI } = require("@google/generative-ai");

admin.initializeApp();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

/**
 * Cloud Function to score a project using Gemini AI.
 * Expects { projectId, documentPaths: [] }
 * documentPaths should be the paths within the Firebase Storage bucket
 */
exports.scoreProject = functions.https.onCall(async (data, context) => {
  // Check authentication
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "User must be logged in."
    );
  }

  const { projectId, documentPaths } = data;

  if (!projectId || !documentPaths || !Array.isArray(documentPaths)) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Missing projectId or documentPaths."
    );
  }

  try {
    // 1. Fetch and convert documents to Base64 for Gemini
    const bucket = admin.storage().bucket();
    const documentParts = await Promise.all(
      documentPaths.map(async (path) => {
        try {
          const [fileBuffer] = await bucket.file(path).download();
          return {
            inlineData: {
              data: fileBuffer.toString("base64"),
              mimeType: "application/pdf", // Default to PDF for infra docs
            },
          };
        } catch (err) {
          console.error(`Error downloading file ${path}:`, err);
          return null;
        }
      })
    );

    // Filter out failed downloads
    const validParts = documentParts.filter((part) => part !== null);

    if (validParts.length === 0) {
      throw new Error("No valid documents found for analysis.");
    }

    // 2. Initialize Gemini with JSON mode
    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      generationConfig: { responseMimeType: "application/json" }
    });

    const prompt = `
      You are an expert institutional infrastructure investor. 
      Analyze the attached project documents for a project with ID: ${projectId}.

      Evaluate the project based on the following criteria and weights:
      1. Financial Transparency & Viability (30%) - Focus on IRR, debt/equity, and unit economics.
      2. Developer Track Record (20%) - Evaluation of the team's ability to execute.
      3. Risk Disclosure & Mitigation (15%) - Analysis of FX, grid, and land risks.
      4. Governance Clarity (15%) - Board structure and decision-making transparency.
      5. Documentation Completeness (10%) - Quality and presence of key diligence docs.
      6. AI Risk Score (10%) - Your independent check for inconsistencies or red flags.

      Output a structured JSON response exactly matching this schema:
      {
        "total_score": number,
        "breakdown": {
          "financials": number,
          "track_record": number,
          "risk": number,
          "governance": number,
          "documentation": number,
          "ai_penalty": number
        },
        "risk_flags": string[],
        "recommendations": string[],
        "summary": string
      }
    `;

    // 3. Generate Content (Prompt + Document Parts)
    const result = await model.generateContent([prompt, ...validParts]);
    const response = await result.response;
    const text = response.text();
    
    const scoringResult = JSON.parse(text);

    return {
      success: true,
      data: scoringResult
    };

  } catch (error) {
    console.error("Scoring Error:", error);
    throw new functions.https.HttpsError("internal", error.message);
  }
});
