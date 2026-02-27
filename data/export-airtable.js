require('dotenv').config();
const fs = require('fs/promises');
const path = require('path');
const Airtable = require('airtable');
const sharp = require('sharp');

// --- CONFIGURATION ---
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || process.env.AT_BASE_ID;
const AIRTABLE_PAT = process.env.AIRTABLE_PAT || process.env.AT_TOKEN;
const TABLE_NAME = process.env.AT_TABLE || 'Projects';

// Force JSON files to save in the same directory as this script (the data/ folder)
const PUBLISHED_JSON = path.join(__dirname, 'published.json');
const STUBS_JSON = path.join(__dirname, 'stubs.json');

// Keep the image folder in the project root so your frontend can access it easily
const IMG_DIR = path.join(process.cwd(), 'project-img');

// Initialize Airtable
if (!AIRTABLE_PAT || !AIRTABLE_BASE_ID) {
    console.error("❌ Missing Airtable credentials in .env");
    process.exit(1);
}
const base = new Airtable({ apiKey: AIRTABLE_PAT }).base(AIRTABLE_BASE_ID);

/**
 * Downloads, optimizes, and caches an image to WebP format.
 * Reuses the cached version if it already exists.
 */
async function cacheImage(attachment) {
    const filename = `${attachment.id}.webp`;
    const localFilePath = path.join(IMG_DIR, filename);
    const relativePath = `project-img/${filename}`;

    try {
        // 1. Check if it's already cached
        await fs.access(localFilePath);
        return relativePath;
    } catch {
        // 2. Doesn't exist, proceed to download and optimize
    }

    // Fetch the raw image
    const response = await fetch(attachment.url);
    if (!response.ok) {
        throw new Error(`Failed to download image: ${response.statusText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Optimize with Sharp (Resize to max 1600px width, convert to WebP)
    await sharp(buffer)
        .resize({ width: 1600, withoutEnlargement: true })
        .webp({ quality: 80, effort: 6 }) 
        .toFile(localFilePath);

    return relativePath;
}

async function runExport() {
    console.log("🚀 Starting 30x30 UK JSON Export...");
    
    // Ensure image directory exists
    await fs.mkdir(IMG_DIR, { recursive: true });

    try {
        // ==========================================
        // 1. PROCESS PUBLISHED RECORDS
        // ==========================================
        console.log("Fetching 'Published' view...");
        const publishedRecords = await base(TABLE_NAME).select({ view: "Published" }).all();
        
        const outPublished = [];
        let imgCount = 0;

        for (const rec of publishedRecords) {
            let f = { ...rec.fields };

            // Strip unwanted fields
            const fieldsToRemove = ["Google Link", "VolunteeringDescription", "Start", "End", "VolunteeringLocationURL", "VolunteeringCost", "Month", "ContactEmailAddressOrWebpage", "Approved", "Description"];
            for (const field of fieldsToRemove) {
                delete f[field];
            }

            // Handle Image caching
            if (f.Image && f.Image.length > 0) {
                try {
                    const localPath = await cacheImage(f.Image[0]);
                    f.Image[0] = { url: localPath };
                    imgCount++;
                } catch (e) {
                    console.log(`[warn] ${f.Name || '(no name)'}: ${e.message}`);
                }
            }

            // Swap Description fallback
            if (f.DescriptionVolunteeringFallback) {
                f.Description = f.DescriptionVolunteeringFallback;
                delete f.DescriptionVolunteeringFallback;
            }

            outPublished.push({ id: rec.id, ...f });
        }

        await fs.writeFile(PUBLISHED_JSON, JSON.stringify(outPublished, null, 2), 'utf-8');
        console.log(`✔ Wrote ${outPublished.length} records to ${PUBLISHED_JSON}`);
        console.log(`✔ Ensured ${imgCount} images in project-img/`);


        // ==========================================
        // 2. PROCESS STUB RECORDS
        // ==========================================
        console.log("\nFetching 'Stubs' view...");
        const stubRecords = await base(TABLE_NAME).select({ view: "Stubs" }).all();
        
        const outStubs = [];

        for (const rec of stubRecords) {
            const f = rec.fields;
            
            // Keep it very light: just Name, URL, Coordinates, and Type
            outStubs.push({
                id: rec.id,
                Name: f.Name,
                LocationURL: f.LocationURL,
                Lat: f.Lat,
                Long: f.Long,
                Type: f.Type || []
            });
        }

        await fs.writeFile(STUBS_JSON, JSON.stringify(outStubs, null, 2), 'utf-8');
        console.log(`✔ Wrote ${outStubs.length} lightweight records to ${STUBS_JSON}`);
        
        console.log("\n🎉 Export complete!");

    } catch (err) {
        console.error("❌ Export failed:", err);
    }
}

runExport();