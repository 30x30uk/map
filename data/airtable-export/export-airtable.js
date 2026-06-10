require('dotenv').config();
const fs = require('fs/promises');
const path = require('path');
const Airtable = require('airtable');
const sharp = require('sharp');

// --- CONFIGURATION ---
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || process.env.AT_BASE_ID;
const AIRTABLE_PAT = process.env.AIRTABLE_PAT || process.env.AT_TOKEN;
const TABLE_NAME = process.env.AT_TABLE || 'Projects';

const PROJECTS_JSON = path.join(__dirname, 'projects.json');
const VOLUNTEERING_JSON = path.join(__dirname, 'volunteering.json');

const IMG_DIR = path.join(process.cwd(), 'data', 'project-img');

// Fields to include in the export — control what appears here, not in Airtable views
const FIELD_WHITELIST = ['Name', 'HostOrg', 'Lat', 'Long', 'LocationURL', 'Type', 'Description'];
// 'Display Image' is handled separately → becomes 'Image'
// Record ID is always included as 'id' from rec.id

if (!AIRTABLE_PAT || !AIRTABLE_BASE_ID) {
    console.error("❌ Missing Airtable credentials in .env");
    process.exit(1);
}
const base = new Airtable({ apiKey: AIRTABLE_PAT }).base(AIRTABLE_BASE_ID);

function pickFields(fields) {
    const result = {};
    for (const key of FIELD_WHITELIST) {
        if (fields[key] !== undefined) result[key] = fields[key];
    }
    return result;
}

/**
 * Downloads, optimizes, and caches a project image to WebP format.
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
    if (!response.ok) throw new Error(`Failed to download image: ${response.statusText}`);

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    await sharp(buffer)
        .resize({ width: 1600, withoutEnlargement: true })
        .webp({ quality: 80, effort: 6 })
        .toFile(localFilePath);

    return relativePath;
}

async function processRecord(rec, isStub) {
    const f = pickFields(rec.fields);
    let imgCount = 0;

    if (rec.fields['Admin Tags']?.includes('Wikipedia Import')) {
        f.Source = 'Wikipedia';
    }

    if (rec.fields['Display Image'] && rec.fields['Display Image'].length > 0) {
        try {
            const localPath = await cacheImage(rec.fields['Display Image'][0]);
            f.Image = { url: localPath };
            imgCount++;
        } catch (e) {
            console.log(`[warn] ${isStub ? 'Stub' : 'Published'} ${f.Name || '(no name)'}: Image error: ${e.message}`);
            f.Image = rec.fields['Display Image'][0];
        }
    }

    return { record: { id: rec.id, ...f, isStub }, imgCount };
}

async function runExport() {
    console.log("🚀 Starting 30x30 UK JSON Export...");

    await fs.mkdir(IMG_DIR, { recursive: true });

    try {
        let totalImgCount = 0;
        const outProjects = [];
        const outVolunteering = [];

        // ==========================================
        // 1. PUBLISHED RECORDS
        // ==========================================
        console.log("Fetching 'Published' view...");
        const publishedRecords = await base(TABLE_NAME).select({ view: "Published (API)" }).all();

        for (const rec of publishedRecords) {
            const { record, imgCount } = await processRecord(rec, false);
            totalImgCount += imgCount;
            outProjects.push(record);

            if (rec.fields.Type?.includes("Volunteering")) {
                outVolunteering.push({ ...record });
            }
        }

        // ==========================================
        // 2. STUB RECORDS
        // ==========================================
        console.log("Fetching 'Stubs' view...");
        const stubRecords = await base(TABLE_NAME).select({ view: "Stubs (API)" }).all();

        for (const rec of stubRecords) {
            const { record, imgCount } = await processRecord(rec, true);
            totalImgCount += imgCount;
            outProjects.push(record);

            if (rec.fields.Type?.includes("Volunteering")) {
                outVolunteering.push({ ...record });
            }
        }

        await fs.writeFile(PROJECTS_JSON, JSON.stringify(outProjects, null, 2), 'utf-8');
        console.log(`✔ Wrote ${outProjects.length} records to ${PROJECTS_JSON}`);

        await fs.writeFile(VOLUNTEERING_JSON, JSON.stringify(outVolunteering, null, 2), 'utf-8');
        console.log(`✔ Wrote ${outVolunteering.length} volunteering records to ${VOLUNTEERING_JSON}`);

        console.log(`✔ Total images processed: ${totalImgCount}`);

        // Copy to data/ so the app picks up the latest without a manual step
        const DATA_DIR = path.join(__dirname, '..');
        await fs.copyFile(PROJECTS_JSON, path.join(DATA_DIR, 'projects.json'));
        await fs.copyFile(VOLUNTEERING_JSON, path.join(DATA_DIR, 'volunteering.json'));
        console.log(`✔ Copied to data/projects.json and data/volunteering.json`);

        console.log("\n🎉 Export complete!");

    } catch (err) {
        console.error("❌ Export failed:", err);
    }
}

runExport();
