require('dotenv').config({ path: require('path').join(__dirname, '../../..', '.env') });
const fs = require('fs');
const path = require('path');
const Airtable = require('airtable');

// --- CONFIGURATION ---
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_PAT = process.env.AIRTABLE_PAT;
const TABLE_NAME = 'Projects';
const LIMIT = process.env.LIMIT ? parseInt(process.env.LIMIT, 10) : null;

const INPUT_FILE = path.join(__dirname, 'data', 'forestry-england-enriched.json');

if (!AIRTABLE_PAT || !AIRTABLE_BASE_ID) {
    console.error('❌ Missing AIRTABLE_PAT or AIRTABLE_BASE_ID in .env');
    process.exit(1);
}

const base = new Airtable({ apiKey: AIRTABLE_PAT }).base(AIRTABLE_BASE_ID);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// ---------------------------------------------------------------------------
// Region lookup from lat/lon bounding boxes (England + Wales)
// ---------------------------------------------------------------------------
const REGIONS = [
    { name: 'London',             latMin: 51.28, latMax: 51.70, lonMin: -0.52, lonMax:  0.33 },
    { name: 'South East England', latMin: 50.70, latMax: 51.85, lonMin: -1.85, lonMax:  1.80 },
    { name: 'South West England', latMin: 49.85, latMax: 51.70, lonMin: -6.50, lonMax: -1.75 },
    { name: 'East of England',    latMin: 51.50, latMax: 53.10, lonMin: -0.65, lonMax:  1.85 },
    { name: 'East Midlands',      latMin: 52.00, latMax: 53.50, lonMin: -2.10, lonMax:  0.80 },
    { name: 'West Midlands',      latMin: 51.90, latMax: 53.10, lonMin: -3.15, lonMax: -1.40 },
    { name: 'Yorkshire & Humber', latMin: 53.30, latMax: 54.55, lonMin: -2.60, lonMax:  0.20 },
    { name: 'North West England', latMin: 53.00, latMax: 55.00, lonMin: -3.60, lonMax: -2.00 },
    { name: 'North East England', latMin: 54.40, latMax: 55.85, lonMin: -2.55, lonMax: -0.90 },
    { name: 'Wales',              latMin: 51.30, latMax: 53.50, lonMin: -5.40, lonMax: -2.65 },
];

function deriveRegion(lat, lng) {
    if (lat === null || lng === null) return null;
    for (const r of REGIONS) {
        if (lat >= r.latMin && lat <= r.latMax && lng >= r.lonMin && lng <= r.lonMax) return r.name;
    }
    return null;
}

// ---------------------------------------------------------------------------
// Airtable helpers
// ---------------------------------------------------------------------------
async function getExistingNames() {
    console.log('🔍 Fetching existing Forestry England records from Airtable...');
    const existing = new Set();
    await base(TABLE_NAME).select({
        filterByFormula: '{HostOrg}="Forestry England"',
        fields: ['Name']
    }).eachPage((records, next) => {
        records.forEach(r => { if (r.fields.Name) existing.add(r.fields.Name.toLowerCase().trim()); });
        next();
    });
    console.log(`   Found ${existing.size} existing Forestry England records.`);
    return existing;
}

function mapToAirtableFields(forest) {
    const region = deriveRegion(forest.lat, forest.lng);
    const fields = {
        'Name':              forest.name,
        'HostOrg':           'Forestry England',
        'Lat':               forest.lat,
        'Long':              forest.lng,
        'LocationURL':       forest.url,
        'Description':       forest.description || null,
        'Type':              ['Volunteering'],
        'ParticipationType': ['Individual', 'Team'],
        'Admin Tags':        forest['Suggestion-Tags'] || [],
        'AINotes':           forest['AI-Notes'] || null,
    };
    if (region) fields['Region'] = region;
    // Images are on Forestry England CDN — no hotlinking protection, pass directly
    if (forest.image) fields['Image'] = [{ url: forest.image }];
    return fields;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
    console.log('🌲 Forestry England → Airtable Import\n');

    if (!fs.existsSync(INPUT_FILE)) {
        console.error(`❌ Input file not found: ${INPUT_FILE}`);
        console.error('   Run enrich-with-gemini.js first.');
        process.exit(1);
    }

    const forests = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf8'));
    console.log(`📂 Loaded ${forests.length} forests from input file.`);

    const existingNames = await getExistingNames();

    const toImport = forests
        .filter(f => !existingNames.has(f.name.toLowerCase().trim()))
        .slice(0, LIMIT ?? Infinity);

    const skipped = forests.length - toImport.length;
    if (skipped > 0) console.log(`⏭️  Skipping ${skipped} already in Airtable.`);
    console.log(`\n🚀 Importing ${toImport.length} forests...\n`);

    let imported = 0, failed = 0;

    for (const forest of toImport) {
        try {
            const fields = mapToAirtableFields(forest);
            await base(TABLE_NAME).create(fields, { typecast: true });

            const regionStr = fields['Region'] || '(no region)';
            const imgStr = forest.image ? '1 img' : 'no img';
            console.log(`   ✅ "${forest.name}" [${regionStr}] [${imgStr}]`);
            imported++;
            await sleep(250);
        } catch (err) {
            console.error(`   ❌ Failed: "${forest.name}" — ${err.message}`);
            failed++;
        }
    }

    console.log(`\n🎉 Done! Imported: ${imported}, Failed: ${failed}, Skipped: ${skipped}`);
}

main();
