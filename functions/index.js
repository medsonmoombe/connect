const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { GoogleGenerativeAI } = require("@google/generative-ai");

admin.initializeApp();

const DEFAULT_GEMINI_MODEL = "gemini-1.5-flash";

const getGenAI = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new HttpsError("failed-precondition", "GEMINI_API_KEY is not configured in the Cloud Function environment.");
  }
  return new GoogleGenerativeAI(apiKey);
};

const getMimeType = async (bucket, path) => {
  try {
    const [metadata] = await bucket.file(path).getMetadata();
    return metadata.contentType || "application/pdf";
  } catch (err) {
    console.warn(`Could not read metadata for ${path}; defaulting to application/pdf:`, err);
    return "application/pdf";
  }
};

const buildGcsFileDataParts = async (bucket, paths) => {
  const parts = [];

  for (const path of paths) {
    const mimeType = await getMimeType(bucket, path);
    parts.push({
      fileData: {
        fileUri: `gs://${bucket.name}/${path}`,
        mimeType,
      },
    });
  }

  return parts;
};

const buildInlineDataParts = async (bucket, paths) => {
  const parts = [];

  for (const path of paths) {
    const mimeType = await getMimeType(bucket, path);
    const [fileBuffer] = await bucket.file(path).download();
    parts.push({
      inlineData: {
        data: fileBuffer.toString("base64"),
        mimeType,
      },
    });
  }

  return parts;
};

/**
 * Cloud Function to score a project using Gemini AI.
 * Expects { projectId, documentPaths: [] }
 */
exports.scoreProject = onCall({
  region: "us-central1",
  memory: "512MiB",
  timeoutSeconds: 540,
}, async (request) => {
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
    console.log("Authenticated uid:", uid);

    const bucket = admin.storage().bucket();

    // 1. Convert Storage objects to Gemini file parts without loading every PDF into memory.
    let documentParts = await buildGcsFileDataParts(bucket, documentPaths);
    let documentPartMode = "gcs-file-data";

    // 2. Initialize Gemini with JSON mode
    const genAI = getGenAI();
    const model = genAI.getGenerativeModel({ 
      model: process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL,
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
    let result;
    try {
      result = await model.generateContent([prompt, ...documentParts]);
    } catch (generationError) {
      console.warn(`Gemini generation failed with ${documentPartMode} parts; retrying with inline document data:`, generationError);
      documentParts = await buildInlineDataParts(bucket, documentPaths);
      documentPartMode = "inline-data";
      result = await model.generateContent([prompt, ...documentParts]);
    }

    const response = await result.response;
    let text = response.text();
    console.log("Raw response text from Gemini:", text);

    // Clean up Markdown code block wrapper if present
    if (text.trim().startsWith("```")) {
      text = text.trim().replace(/^```json\s*/i, "").replace(/```$/, "").trim();
    }

    // Try parsing the text. If it fails, attempt to strip trailing commas from JSON arrays/objects
    let scoringResult;
    try {
      scoringResult = JSON.parse(text);
    } catch (parseError) {
      console.warn("Standard JSON parse failed, attempting regex-based trailing comma cleanup...");
      try {
        // Strip trailing commas before a closing bracket or brace
        const cleanedText = text.replace(/,(\s*[\]}])/g, "$1");
        scoringResult = JSON.parse(cleanedText);
        console.log("Cleaned JSON parse succeeded!");
      } catch (nestedError) {
        console.error("AI returned malformed JSON structure:", text);
        throw new HttpsError(
          "internal", 
          `AI returned malformed JSON that could not be parsed: ${parseError.message}. Raw output: ${text.substring(0, 300)}...`
        );
      }
    }

    return {
      success: true,
      data: scoringResult
    };

  } catch (error) {
    console.error("Scoring Error:", error);
    throw new HttpsError("internal", error.message);
  }
});
