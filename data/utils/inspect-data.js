require('dotenv').config();
const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs").promises;
const path = require("path");

// --- CONFIGURATION ---
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// Initialize model with Search Grounding
const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    tools: [{ googleSearch: {} }],
    generationConfig: {
        temperature: 0.1 // Keep it analytical and precise
    }
});

const INPUT_FILE = path.join(process.cwd(), "data", "stubs-desc.json");
const OUTPUT_FILE = path.join(process.cwd(), "data", "stubs-checked.json");
const FAILED_FILE = path.join(process.cwd(), "data", "stubs-checked-failed.json");

// Helper to avoid API rate limits
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function inspectProject(project, index, total) {
    console.log(`\n--- [${index}/${total}] Inspecting: ${project.Name} ---`);
    console.log(` 🏢 HostOrg:     ${project.HostOrg || "N/A"}`);
    console.log(` 🔗 LocationURL: ${project.LocationURL || "N/A"}`);

    const prompt = `
        You are an expert geospatial data auditor for UK nature conservation projects. 
        Analyze the following raw project data. Your goal is to pinpoint the ONE specific, real-world nature reserve in the UK that this record is trying to represent, using all available clues (Name, URL, Description, HostOrg, and Lat/Long).
        
        ${JSON.stringify(project, null, 2)}
        
        Task:
        1. Name Check: If the "Name" contains parentheses (e.g., "(Highest Point)"), suggest a cleaned, simplified name in "Name-Change".
        2. Site Alignment & Location Check (CRITICAL): Identify the actual nature reserve. 
           - Evaluate the original Lat/Long. Does it point to a generic town center, an industrial estate, an administrative office, or an entirely wrong region (e.g., the URL says Oxfordshire but coordinates say Chester)?
           - If the coordinates point to an office/HQ rather than a physical reserve, add the tag "Suggest deletion - Office Location" to "Suggestion-Tags".
           - Provide the precise nature reserve coordinates in "Lat-Change" and "Long-Change" if the original ones are wrong, point to an office, or belong to a completely different region than the true site. 
           - NOTE: Coordinates pointing to a car park for the specific nature reserve ARE perfectly acceptable and do not need changing.
        3. URL Check: Sanity check the URL. Does the domain match the true identified nature reserve? If it points to an unrelated site, DO NOT try to guess the correct URL. Instead, generate a Google Search URL combining the site name and host organization in "LocationURL-GoogleLink" (e.g., "https://www.google.com/search?q=Abberton+Reservoir+Essex+Wildlife+Trust") AND add the tag "Suggest URL Review" to "Suggestion-Tags".
        4. Description Check: Is the description missing, poorly formatted, or describing the wrong location/site based on your holistic identification? Suggest a fix in "Description-Change" to align perfectly with the identified site.
        5. Host Organization Check: Verify the 'HostOrg'. Does it correctly reflect the organization that manages the identified site (e.g., RSPB, National Trust, a specific regional Wildlife Trust)? If it is missing, vague, misspelled, or entirely incorrect, suggest the exact managing organization in "HostOrg-Change".
        6. AI-Notes: Provide clear reasoning for ANY changes you suggest. If the original data was a confusing mix of locations, explain how you determined the "true" site and aligned the properties to it.

        If a field is perfectly fine, omit its corresponding "-Change" field or set it to null.

        OUTPUT INSTRUCTIONS:
        You MUST return ONLY a valid, parsable JSON object. Do not include markdown fences, conversational text, or explanations outside the JSON.
        Format your response exactly like this structure:
        {
            "id": "string",
            "Name": "string",
            "Name-Change": "string or null",
            "Lat": 0.0,
            "Lat-Change": 0.0 or null,
            "Long": 0.0,
            "Long-Change": 0.0 or null,
            "HostOrg-Change": "string or null",
            "LocationURL-GoogleLink": "string or null",
            "Description-Change": "string or null",
            "Suggestion-Tags": ["string", "string"],
            "AI-Notes": "string"
        }
    `;

    let responseText = null;

    try {
        const result = await model.generateContent(prompt);
        responseText = result.response.text();
        
        // SURGICAL EXTRACTION: Find the first { and the last } to ignore any conversational text
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        
        if (!jsonMatch) {
            throw new Error(`No JSON object found in response.`);
        }

        // Parse the extracted JSON block
        const checkedData = JSON.parse(jsonMatch[0]);

        // Explicitly inject the base properties so they are always in the output JSON
        checkedData.Name = project.Name; // Enforce original name just in case
        checkedData.HostOrg = project.HostOrg || null;
        checkedData.LocationURL = project.LocationURL || null;

        // Remove null -Change fields for cleaner output
        const changeFields = ["Name-Change", "Lat-Change", "Long-Change", "HostOrg-Change", "LocationURL-GoogleLink", "Description-Change"];
        changeFields.forEach(field => {
            if (checkedData[field] === null || checkedData[field] === undefined) {
                delete checkedData[field];
            }
        });
        
        // Quick console feedback
        if (checkedData["Suggestion-Tags"] && checkedData["Suggestion-Tags"].length > 0) {
            console.log(` ⚠️ Tags: ${checkedData["Suggestion-Tags"].join(", ")}`);
        }
        if (checkedData["HostOrg-Change"]) {
            console.log(` 🏢 Org Change:  [${project.HostOrg || "N/A"}] -> [${checkedData["HostOrg-Change"]}]`);
        }
        if (checkedData["Lat-Change"]) {
            console.log(` 📍 Moved Marker: [${checkedData.Lat}, ${checkedData.Long}] -> [${checkedData["Lat-Change"]}, ${checkedData["Long-Change"]}]`);
        }
        if (checkedData["LocationURL-GoogleLink"]) {
            console.log(` 🔎 Search URL: ${checkedData["LocationURL-GoogleLink"]}`);
        }
        console.log(` 📝 Note: ${checkedData["AI-Notes"]}`);

        return { success: true, data: checkedData };

    } catch (error) {
        console.error(` ❌ API/Parsing Error for ${project.Name}: ${error.message}`);
        
        // If responseText is null, it means the API crashed before giving us text.
        // We'll capture the actual Node error trace so you know exactly why it failed.
        const errorDetails = responseText !== null ? responseText : `API/Network Crash:\n${error.stack || error.message}`;
        
        // Return a structured error so the main loop can log it, including the raw text
        return { 
            success: false, 
            project: project, 
            error: error.message,
            rawResponse: errorDetails
        }; 
    }
}

async function main() {
    // Read the limit from the command line (e.g., \`node data/inspect-data.js 25\`)
    const runLimit = process.argv[2] ? parseInt(process.argv[2], 10) : null;

    try {
        // 1. Load Data
        const rawData = JSON.parse(await fs.readFile(INPUT_FILE, "utf8"));
        
        let checkedResults = [];
        let failedResults = [];

        try { checkedResults = JSON.parse(await fs.readFile(OUTPUT_FILE, "utf8")); } catch(e) {}
        try { failedResults = JSON.parse(await fs.readFile(FAILED_FILE, "utf8")); } catch(e) {}

        // 2. Filter out records we've already successfully processed
        const processedIds = new Set(checkedResults.map(r => r.id));
        const toProcess = rawData.filter(project => !processedIds.has(project.id));

        if (toProcess.length === 0) {
            console.log("🎉 All records in stubs.json have already been successfully checked!");
            return;
        }

        // 3. Apply the CLI limit
        const batch = runLimit ? toProcess.slice(0, runLimit) : toProcess;
        console.log(`🚀 Starting AI Inspection: Processing ${batch.length} items...\n`);

        // 4. Process sequentially to respect rate limits and maintain order
        for (let i = 0; i < batch.length; i++) {
            const project = batch[i];
            
            const result = await inspectProject(project, i + 1, batch.length);
            
            if (result.success) {
                checkedResults.push(result.data);
                await fs.writeFile(OUTPUT_FILE, JSON.stringify(checkedResults, null, 2));

                // If it was previously in the failed file, remove it now that it succeeded!
                const failedIndex = failedResults.findIndex(f => f.project.id === project.id);
                if (failedIndex > -1) {
                    failedResults.splice(failedIndex, 1);
                    await fs.writeFile(FAILED_FILE, JSON.stringify(failedResults, null, 2));
                }
            } else {
                // Log failure to the failed file with the raw text
                const failedEntry = { 
                    error: result.error, 
                    project: result.project,
                    rawResponse: result.rawResponse
                };

                const existingIndex = failedResults.findIndex(f => f.project.id === project.id);
                if (existingIndex > -1) {
                    failedResults[existingIndex] = failedEntry;
                } else {
                    failedResults.push(failedEntry);
                }
                await fs.writeFile(FAILED_FILE, JSON.stringify(failedResults, null, 2));
            }

            // Pause for 3 seconds between requests to avoid Google API quotas
            if (i < batch.length - 1) {
                await delay(3000); 
            }
        }
        
        console.log(`\n🏁 Done. Successfully checked: ${checkedResults.length} | Failed: ${failedResults.length}`);

    } catch (err) {
        console.error("Critical error:", err.message);
    }
}

main();