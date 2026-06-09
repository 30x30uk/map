require('dotenv').config({ path: require('path').join(__dirname, '../../..', '.env') });
const fs = require('fs');
const path = require('path');
const http = require('http');
const axios = require('axios');
const Airtable = require('airtable');
const { spawn, execSync } = require('child_process');
const NGROK_BIN = require('path').join(__dirname, '../../../node_modules/.bin/ngrok');

// --- CONFIGURATION ---
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_PAT = process.env.AIRTABLE_PAT;
const TABLE_NAME = 'Projects';
const LIMIT = process.env.LIMIT ? parseInt(process.env.LIMIT, 10) : null;

// Local image server — one image is downloaded and served via a live ngrok tunnel
// so Airtable can fetch it (Wikipedia blocks direct hotlinking)
const IMAGE_SERVER_PORT = 4242;
const NGROK_AUTHTOKEN = '3E4XI0ZkB0X45JNgeHix6piiXEv_41x16twmrD6xZEQqqiASX';
const NGROK_DOMAIN = (process.env.PUBLIC_IMAGE_SERVER || '').replace(/\/$/, '').replace(/^https?:\/\//, '');
const IMAGE_TMP_DIR = path.join(__dirname, 'data', 'image-tmp');

const INPUT_FILE = path.join(__dirname, 'data', 'national-trust-properties.json');

if (!AIRTABLE_PAT || !AIRTABLE_BASE_ID) {
    console.error('❌ Missing AIRTABLE_PAT or AIRTABLE_BASE_ID in .env');
    process.exit(1);
}
if (!NGROK_DOMAIN) {
    console.warn('⚠️  PUBLIC_IMAGE_SERVER not set in .env — images will be skipped.');
}

const base = new Airtable({ apiKey: AIRTABLE_PAT }).base(AIRTABLE_BASE_ID);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// ---------------------------------------------------------------------------
// Region lookup from lat/lon bounding boxes (England only)
// Ordered from most specific/smallest to largest to avoid greedy matches
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
    { name: 'Scotland',           latMin: 54.60, latMax: 60.90, lonMin: -8.70, lonMax:  2.00 },
    { name: 'Northern Ireland',   latMin: 53.95, latMax: 55.40, lonMin: -8.30, lonMax: -5.40 },
];

function deriveRegion(lat, lon) {
    if (lat === null || lon === null) return null;
    // London first (tightest box), then work outward
    for (const r of REGIONS) {
        if (lat >= r.latMin && lat <= r.latMax && lon >= r.lonMin && lon <= r.lonMax) return r.name;
    }
    return null;
}

// ---------------------------------------------------------------------------
// Local HTTP image server (serves downloaded Wikipedia images to Airtable)
// ---------------------------------------------------------------------------
let imageServer = null;
let ngrokProcess = null;
let ngrokUrl = null;

async function startImageServer() {
    if (!fs.existsSync(IMAGE_TMP_DIR)) fs.mkdirSync(IMAGE_TMP_DIR, { recursive: true });

    // Start local HTTP server
    imageServer = http.createServer((req, res) => {
        const filename = decodeURIComponent(req.url.replace(/^\//, ''));
        const filePath = path.join(IMAGE_TMP_DIR, filename);
        if (fs.existsSync(filePath)) {
            const ext = path.extname(filename).toLowerCase();
            const mime = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp' }[ext] || 'application/octet-stream';
            res.writeHead(200, { 'Content-Type': mime });
            fs.createReadStream(filePath).pipe(res);
        } else {
            res.writeHead(404);
            res.end('Not found');
        }
    });
    await new Promise(resolve => imageServer.listen(IMAGE_SERVER_PORT, resolve));

    // Kill any lingering ngrok processes cleanly
    try { execSync('pkill -f "ngrok http"', { stdio: 'ignore' }); await sleep(800); } catch (e) {}

    // Spawn ngrok CLI directly — more reliable than the npm wrapper for static domains
    const ngrokArgs = ['http', IMAGE_SERVER_PORT.toString(), '--log=stdout', '--log-format=json'];
    if (NGROK_DOMAIN) ngrokArgs.push(`--domain=${NGROK_DOMAIN}`);
    ngrokProcess = spawn(NGROK_BIN, ngrokArgs, { env: { ...process.env, HOME: process.env.HOME } });

    // Wait for ngrok to emit the tunnel URL in its JSON log
    ngrokUrl = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('ngrok startup timed out after 15s')), 15000);
        ngrokProcess.stdout.on('data', chunk => {
            for (const line of chunk.toString().split('\n')) {
                try {
                    const entry = JSON.parse(line);
                    const url = entry.url || (entry.msg === 'started tunnel' && entry.url);
                    if (url) { clearTimeout(timeout); resolve(url); }
                    if (entry.err && entry.err !== 'EOF' && entry.err !== '<nil>') { clearTimeout(timeout); reject(new Error(entry.err)); }
                } catch (e) {}
            }
        });
        ngrokProcess.stderr.on('data', d => process.stderr.write(d));
        ngrokProcess.on('error', e => { clearTimeout(timeout); reject(e); });
    });

    console.log(`🖼️  Image server live → ${ngrokUrl}`);
}

async function downloadImage(url) {
    const filename = path.basename(new URL(url).pathname);
    const localPath = path.join(IMAGE_TMP_DIR, filename);
    if (fs.existsSync(localPath)) return filename; // cached
    const response = await axios.get(url, { responseType: 'arraybuffer', headers: { 'User-Agent': 'NationalTrustImportBot/1.0 (contact@30x30project.org.uk)' }, timeout: 15000 });
    fs.writeFileSync(localPath, response.data);
    return filename;
}

async function prepareAttachment(images) {
    if (!ngrokUrl || !images || images.length === 0) return null;
    // Use only the first image
    try {
        const filename = await downloadImage(images[0]);
        const publicUrl = `${ngrokUrl}/${encodeURIComponent(filename)}`;
        // Verify it's actually reachable before passing to Airtable
        await axios.head(publicUrl, { timeout: 5000 });
        return { url: publicUrl };
    } catch (err) {
        console.warn(`     ⚠️  Image not reachable: ${err.message}`);
        return null;
    }
}

// ---------------------------------------------------------------------------
// Airtable helpers
// ---------------------------------------------------------------------------
async function getExistingNames() {
    console.log('🔍 Fetching existing record names from Airtable to avoid duplicates...');
    const existing = new Set();
    await base(TABLE_NAME).select({ fields: ['Name'] }).eachPage((records, next) => {
        records.forEach(r => { if (r.fields.Name) existing.add(r.fields.Name.toLowerCase().trim()); });
        next();
    });
    console.log(`   Found ${existing.size} existing records.`);
    return existing;
}

function mapToAirtableFields(property, attachment) {
    const region = deriveRegion(property.Lat, property.Long);
    const fields = {
        'Name':              property.Name,
        'HostOrg':           property.HostOrg,
        'Lat':               property.Lat,
        'Long':              property.Long,
        'LocationURL':       property.LocationUrl,
        'Description':       property.DescriptionModified || property.Description,
        'Type':              ['Volunteering'],
        'ParticipationType': ['Individual', 'Team'],
        'Admin Tags':        property['Suggestion-Tags'] || [],
        'AINotes':           property['AI-Notes'] || null,
    };
    if (region) fields['Region'] = region;
    if (property.Area !== null && property.Area !== undefined) fields['Area'] = property.Area;
    if (attachment) fields['Image'] = [attachment];
    return fields;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
    console.log('🏛️  National Trust England → Airtable Import\n');

    await startImageServer();

    const properties = JSON.parse(fs.readFileSync(INPUT_FILE, 'utf8'));
    console.log(`📂 Loaded ${properties.length} properties from input file.`);

    const existingNames = await getExistingNames();

    const toImport = properties
        .filter(p => !existingNames.has(p.Name.toLowerCase().trim()))
        .slice(0, LIMIT ?? Infinity);

    const skipped = properties.length - toImport.length;
    if (skipped > 0) console.log(`⏭️  Skipping ${skipped} already in Airtable.`);
    console.log(`\n🚀 Importing ${toImport.length} new properties...\n`);

    let imported = 0, failed = 0;

    for (const property of toImport) {
        try {
            const attachment = await prepareAttachment(property.Images);
            const fields = mapToAirtableFields(property, attachment);

            await base(TABLE_NAME).create(fields, { typecast: true });

            const regionStr = fields['Region'] || '(no region)';
            const imgStr = attachment ? '1 img' : 'no img';
            console.log(`   ✅ "${property.Name}" [${regionStr}] [${imgStr}]`);
            imported++;
            // Wait longer when image is included so Airtable can fetch from ngrok
            await sleep(attachment ? 4000 : 250);
        } catch (err) {
            console.error(`   ❌ Failed: "${property.Name}" — ${err.message}`);
            failed++;
        }
    }

    console.log(`\n🎉 Done! Imported: ${imported}, Failed: ${failed}, Skipped: ${skipped}`);
    if (imageServer) imageServer.close();
    if (ngrokProcess) ngrokProcess.kill();
}

main();
