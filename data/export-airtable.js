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
const VOLUNTEERING_JSON = path.join(__dirname, 'volunteering.json');

// Move the image folder inside the data directory
const IMG_DIR = path.join(process.cwd(), 'data', 'project-img');
const PLACEHOLDER_DIR = path.join(IMG_DIR, 'placeholders'); // Unique placeholder cache

// Initialize Airtable
if (!AIRTABLE_PAT || !AIRTABLE_BASE_ID) {
    console.error("❌ Missing Airtable credentials in .env");
    process.exit(1);
}
const base = new Airtable({ apiKey: AIRTABLE_PAT }).base(AIRTABLE_BASE_ID);

/**
 * Downloads, optimizes, and caches a project-specific image to WebP format.
 * Reuses the cached version if it already exists.
 */
async function cacheImage(attachment) {
    const filename = `${attachment.id}.webp`;
    const localFilePath = path.join(IMG_DIR, filename);
    const relativePath = `data/project-img/${filename}`; 

    try {
        await fs.access(localFilePath);
        return relativePath;
    } catch {
        // Doesn't exist, proceed to download and optimize
    }

    const response = await fetch(attachment.url);
    if (!response.ok) {
        throw new Error(`Failed to download image: ${response.statusText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    await sharp(buffer)
        .resize({ width: 1600, withoutEnlargement: true })
        .webp({ quality: 80, effort: 6 }) 
        .toFile(localFilePath);

    return relativePath;
}

/**
 * Downloads, optimizes, and caches a UNIQUE placeholder image to WebP format,
 * ensuring recurring placeholders are only processed once.
 */
async function cacheUniquePlaceholder(attachment) {
    const filename = `${attachment.id}.webp`;
    const localFilePath = path.join(PLACEHOLDER_DIR, filename);
    const relativePath = `data/project-img/placeholders/${filename}`; 

    try {
        await fs.access(localFilePath);
        return relativePath;
    } catch {
        // Doesn't exist, process it ONCE
    }

    console.log(`[info] Caching unique placeholder for the first time: ${relativePath}`);

    const response = await fetch(attachment.url);
    if (!response.ok) {
        throw new Error(`Failed to download placeholder image: ${response.statusText}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    await sharp(buffer)
        .resize({ width: 800, withoutEnlargement: true })
        .webp({ quality: 75, effort: 6 }) 
        .toFile(localFilePath);

    return relativePath;
}

async function runExport() {
    console.log("🚀 Starting 30x30 UK JSON Export...");
    
    // Ensure image and placeholder directories exist
    await fs.mkdir(IMG_DIR, { recursive: true });
    await fs.mkdir(PLACEHOLDER_DIR, { recursive: true });

    try {
        let realImgCount = 0; 
        let placeholderCacheCount = 0; 

        // ==========================================
        // 1. PROCESS PUBLISHED RECORDS
        // ==========================================
        console.log("Fetching 'Published' view...");
        const publishedRecords = await base(TABLE_NAME).select({ view: "Published" }).all();
        
        const outPublished = [];
        const outVolunteering = []; 

        for (const rec of publishedRecords) {
            let f = { ...rec.fields };

            // Strip unwanted fields to prevent JSON bloat (Kept ParticipationType!)
            const fieldsToRemove = [
                "Google Link", "VolunteeringDescription", "Start", "End", 
                "VolunteeringLocationURL", "VolunteeringCost", "Month", 
                "ContactEmailAddressOrWebpage", "Approved", "Description",
                "Placeholder", "Tags", "Region", "HostOrg", 
                "HostVolunteeringIndividualUrl", 
                "ProjectVolunteeringIndividualUrl", "Published", 
                "Display Image", "Run Update", "Image" 
            ];
            
            for (const field of fieldsToRemove) {
                delete f[field];
            }

            // Handle Image caching - using Display Image!
            let finalImage = undefined;

            if (rec.fields['Display Image'] && rec.fields['Display Image'].length > 0) {
                try {
                    const localPath = await cacheImage(rec.fields['Display Image'][0]);
                    finalImage = { url: localPath };
                    realImgCount++;
                } catch (e) {
                    console.log(`[warn] Published ${rec.fields.Name || '(no name)'}: Real Image Error: ${e.message}`);
                    finalImage = rec.fields['Display Image'][0]; 
                }
            } 
            else if (rec.fields.Placeholder && rec.fields.Placeholder.length > 0) {
                try {
                    const localPath = await cacheUniquePlaceholder(rec.fields.Placeholder[0]);
                    finalImage = { url: localPath };
                    placeholderCacheCount++;
                } catch (e) {
                    console.log(`[warn] Published ${rec.fields.Name || '(no name)'}: Placeholder Error: ${e.message}`);
                    finalImage = rec.fields.Placeholder[0]; 
                }
            }

            if (finalImage) {
                f.Image = finalImage;
            }

            // Swap Description fallback
            if (f.DescriptionVolunteeringFallback) {
                f.Description = f.DescriptionVolunteeringFallback;
                delete f.DescriptionVolunteeringFallback;
            }

            const processedRecord = { id: rec.id, ...f };
            outPublished.push(processedRecord);

            // Check if this published project is a volunteering project
            if (rec.fields.Type && Array.isArray(rec.fields.Type) && rec.fields.Type.includes("Volunteering")) {
                outVolunteering.push(processedRecord);
            }
        }

        await fs.writeFile(PUBLISHED_JSON, JSON.stringify(outPublished, null, 2), 'utf-8');
        console.log(`✔ Wrote ${outPublished.length} records to ${PUBLISHED_JSON}`);


        // ==========================================
        // 2. PROCESS STUB RECORDS
        // ==========================================
        console.log("\nFetching 'Stubs' view...");
        const stubRecords = await base(TABLE_NAME).select({ view: "Stubs" }).all();
        
        const outStubs = [];

        for (const rec of stubRecords) {
            const f = rec.fields;
            
            let finalImage = undefined;

            // Handle Image caching - using Display Image!
            if (f['Display Image'] && f['Display Image'].length > 0) {
                try {
                    const localPath = await cacheImage(f['Display Image'][0]);
                    finalImage = { url: localPath };
                    realImgCount++;
                } catch (e) {
                    console.log(`[warn] Stub ${f.Name || '(no name)'}: Real Image Error: ${e.message}`);
                    finalImage = f['Display Image'][0];
                }
            }
            else if (f.Placeholder && f.Placeholder.length > 0) {
                try {
                    const localPath = await cacheUniquePlaceholder(f.Placeholder[0]);
                    finalImage = { url: localPath };
                    placeholderCacheCount++;
                } catch (e) {
                    console.log(`[warn] Stub ${f.Name || '(no name)'}: Placeholder Error: ${e.message}`);
                    finalImage = f.Placeholder[0];
                }
            }

            const stubData = {
                id: rec.id,
                Name: f.Name,
                LocationURL: f.LocationURL,
                Lat: f.Lat,
                Long: f.Long,
                Type: f.Type || []
            };

            if (finalImage) {
                stubData.Image = finalImage;
            }

            outStubs.push(stubData);

            // Check if this stub is a volunteering project
            if (f.Type && Array.isArray(f.Type) && f.Type.includes("Volunteering")) {
                outVolunteering.push(stubData);
            }
        }

        await fs.writeFile(STUBS_JSON, JSON.stringify(outStubs, null, 2), 'utf-8');
        console.log(`✔ Wrote ${outStubs.length} lightweight records to ${STUBS_JSON}`);
        
        // Write the combined volunteering JSON file
        await fs.writeFile(VOLUNTEERING_JSON, JSON.stringify(outVolunteering, null, 2), 'utf-8');
        console.log(`✔ Wrote ${outVolunteering.length} volunteering records to ${VOLUNTEERING_JSON}`);

        console.log(`✔ Total Unique project/placeholder images processed: ${realImgCount}`);
        
        console.log("\n🎉 Export complete!");

    } catch (err) {
        console.error("❌ Export failed:", err);
    }
}

runExport();