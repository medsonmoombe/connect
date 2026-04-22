const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { GoogleGenerativeAI } = require("@google/generative-ai");

admin.initializeApp();

// Initialize GenAI inside the handler to ensure it picks up the latest environment variables
const getGenAI = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new HttpsError("failed-precondition", "GEMINI_API_KEY is not configured in the Cloud Function environment.");
  }
  return new GoogleGenerativeAI(apiKey);
};

/**
 * Cloud Function to score a project using Gemini AI.
 * Expects { projectId, documentPaths: [] }
 */
exports.scoreProject = onCall({ region: "us-central1" }, async (request) => {
  const data = request.data;
  console.log("Received Gen 2 scoring request. Data:", JSON.stringify(data));
  
  const { projectId, documentPaths } = data || {};

  if (!projectId || !documentPaths || !Array.isArray(documentPaths)) {
    console.error("Validation failed. Data received:", data);
    throw new HttpsError(
      "invalid-argument",
      "Missing projectId or documentPaths. Received: " + JSON.stringify(data)
    );
  }

  try {
    const uid = request.auth ? request.auth.uid : "testing-uid";

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
    const genAI = getGenAI();
    const model = genAI.getGenerativeModel({ 
      model: "gemini-3-flash-preview",
      generationConfig: { responseMimeType: "application/json" }
    });

    const prompt = `
      You are an expert institutional infrastructure investor specialized in the African energy market. 
      Analyze the attached project documents for a project with ID: ${projectId}.

      CRITICAL MANDATE: RELEVANCE & INTEGRITY CHECK
      Before scoring, you must verify if the uploaded documents are relevant to infrastructure development, energy projects, or corporate project finance.
      If the documents are irrelevant (e.g., personal photos, unrelated literature, shopping lists, or non-project documents):
      1. Set "total_score" to 0.
      2. Set all sub-scores in "breakdown" to 0.
      3. Add a "HIGH" level risk signal with category "DATA_INTEGRITY" and text "Uploaded documentation is irrelevant to infrastructure project development."
      4. In the "summary", state clearly that the analysis cannot proceed because the documentation provided does not contain project-related data.

      SCORING CRITERIA (Only apply if documents are relevant):
      Evaluate the project based on the following 21-parameter criteria across three main categories:

      1. Regulatory & Project Readiness (40% Weighting)
         - Site Rights & Land Security (6%): Title, Lease, or Consent.
         - Environmental Approval (5%): ZEMA Decision Letter presence and status.
         - Grid Readiness (7%): Approved Grid Impact Study + Connection Agreement.
         - Feasibility Study Quality (8%): Technical, Financial, and Environmental depth.
         - PPA / Offtake Agreement (8%): Signed or advanced stage.
         - Construction Readiness (3%): Building permits and site access.
         - Licensing Status (2%): Generation, Transmission, or Distribution licenses.
         - Corporate Compliance (1%): PACRA registration and legal structure.

      2. Financial Viability (35% Weighting)
         - CAPEX Benchmarking (5%): Comparison vs industry norms.
         - OPEX Sustainability (5%): Long-term operational viability.
         - FIRR (10%): Internal Rate of Return (Core investor metric).
         - FNPV (7%): Net Present Value (Value creation).
         - Payback Period (5%): Liquidity and time-to-return.
         - Sensitivity Analysis (3%): Stress testing (tariff, cost, delays).

      3. Developer Strength (25% Weighting)
         - Legal & Regulatory Compliance (3%): Clean structure.
         - Track Record - Development (6%): Proven delivery of similar projects.
         - Track Record - Operations (4%): Long-term operational capability.
         - EPC / Technical Partnerships (4%): Strong execution partners identified.
         - Equity Commitment (4%): Percentage of skin in the game.
         - Funding Readiness (3%): Debt/equity already secured or committed.
         - Company Strength (1%): Years in operation and backing.

      Output a structured JSON response exactly matching this schema:
      {
        "total_score": number,
        "breakdown": {
          "regulatory": {
            "score": number,
            "max": 40,
            "details": {
              "site_rights": number,
              "environmental": number,
              "grid_readiness": number,
              "feasibility": number,
              "ppa_status": number,
              "construction_ready": number,
              "licensing": number,
              "compliance": number
            }
          },
          "financial": {
            "score": number,
            "max": 35,
            "details": {
              "capex_benchmarking": number,
              "opex_sustainability": number,
              "firr": number,
              "fnpv": number,
              "payback_period": number,
              "sensitivity_analysis": number
            }
          },
          "developer": {
            "score": number,
            "max": 25,
            "details": {
              "legal_compliance": number,
              "track_record_dev": number,
              "track_record_ops": number,
              "epc_partnerships": number,
              "equity_commitment": number,
              "funding_readiness": number,
              "company_strength": number
            }
          }
        },
        "risk_signals": [
          { "level": "HIGH" | "MEDIUM" | "LOW", "category": string, "text": string }
        ],
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
    throw new HttpsError("internal", error.message);
  }
});
