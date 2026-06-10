require('dotenv').config({ path: require('path').join(__dirname, '../../..', '.env') });
const fs = require('fs');
const path = require('path');
const http = require('http');
const axios = require('axios');
const Airtable = require('airtable');
const { spawn, execSync } = require('child_process');

// --- CLI args ---
const args = process.argv.slice(2);
let dataFilePath = null;
for (let i = 0; i < args.length; i++) {
    if (args[i] === '--data' && args[i + 1]) { dataFilePath = path.resolve(args[++i]); }
    else if (!args[i].startsWith('--')) { dataFilePath = path.resolve(args[i]); }
}
if (!dataFilePath) {
    console.error('Usage: node update-airtable-images.js --data <path-to-properties.json>');
    console.error('');
    console.error('Examples:');
    console.error('  node update-airtable-images.js --data ../national-trust-england/data/national-trust-properties.json');
    console.error('  node update-airtable-images.js --data ../national-trust-scotland/data/national-trust-properties.json');
    process.exit(1);
}

const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_PAT = process.env.AIRTABLE_PAT;
const TABLE_NAME = 'Projects';
const LIMIT = process.env.LIMIT ? parseInt(process.env.LIMIT, 10) : null;

const NGROK_BIN = path.join(__dirname, '../../../node_modules/.bin/ngrok');
const IMAGE_SERVER_PORT = 4242;
const NGROK_DOMAIN = (process.env.PUBLIC_IMAGE_SERVER || '').replace(/\/$/, '').replace(/^https?:\/\//, '');
const IMAGE_TMP_DIR = path.join(__dirname, '../national-trust-england/data/image-tmp');

if (!AIRTABLE_PAT || !AIRTABLE_BASE_ID) {
    console.error('❌ Missing AIRTABLE_PAT or AIRTABLE_BASE_ID in .env');
    process.exit(1);
}

const base = new Airtable({ apiKey: AIRTABLE_PAT }).base(AIRTABLE_BASE_ID);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// ---------------------------------------------------------------------------
// Image server (same as import scripts)
// ---------------------------------------------------------------------------
let imageServer = null;
let ngrokProcess = null;
let ngrokUrl = null;

async function startImageServer() {
    if (!fs.existsSync(IMAGE_TMP_DIR)) fs.mkdirSync(IMAGE_TMP_DIR, { recursive: true });

    imageServer = http.createServer((req, res) => {
        const filename = decodeURIComponent(req.url.replace(/^\//, ''));
        const filePath = path.join(IMAGE_TMP_DIR, filename);
        if (fs.existsSync(filePath)) {
            const ext = path.extname(filename).toLowerCase();
            const mime = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif', '.webp': 'image/webp' }[ext] || 'application/octet-stream';
            res.writeHead(200, { 'Content-Type': mime });
            fs.createReadStream(filePath).pipe(res);
        } else {
            res.writeHead(404); res.end('Not found');
        }
    });
    await new Promise(resolve => imageServer.listen(IMAGE_SERVER_PORT, resolve));

    try { execSync('pkill -f "ngrok http"', { stdio: 'ignore' }); await sleep(800); } catch (e) {}

    const ngrokArgs = ['http', IMAGE_SERVER_PORT.toString(), '--log=stdout', '--log-format=json'];
    if (NGROK_DOMAIN) ngrokArgs.push(`--domain=${NGROK_DOMAIN}`);
    ngrokProcess = spawn(NGROK_BIN, ngrokArgs, { env: { ...process.env, HOME: process.env.HOME } });

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
    if (fs.existsSync(localPath)) return filename;
    const response = await axios.get(url, {
        responseType: 'arraybuffer',
        headers: { 'User-Agent': 'NTImageUpdateBot/1.0 (contact@30x30project.org.uk)' },
        timeout: 15000
    });
    fs.writeFileSync(localPath, response.data);
    return filename;
}

async function prepareAttachment(imageUrl) {
    if (!ngrokUrl || !imageUrl) return null;
    try {
        const filename = await downloadImage(imageUrl);
        const publicUrl = `${ngrokUrl}/${encodeURIComponent(filename)}`;
        await axios.head(publicUrl, { timeout: 5000 });
        return { url: publicUrl };
    } catch (err) {
        console.warn(`     ⚠️  Image not reachable: ${err.message}`);
        return null;
    }
}

// ---------------------------------------------------------------------------
// Airtable: fetch all existing records (Name → record ID)
// ---------------------------------------------------------------------------
async function getExistingRecords() {
    console.log('🔍 Fetching existing Airtable records...');
    const records = {};
    await base(TABLE_NAME).select({ fields: ['Name', 'Image'] }).eachPage((page, next) => {
        page.forEach(r => {
            if (r.fields.Name) records[r.fields.Name.toLowerCase().trim()] = {
                id: r.id,
                hasImage: !!(r.fields.Image && r.fields.Image.length > 0)
            };
        });
        next();
    });
    console.log(`   Found ${Object.keys(records).length} existing records.\n`);
    return records;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
    console.log('🖼️  NT Airtable Image Updater\n');

    await startImageServer();

    const properties = JSON.parse(fs.readFileSync(dataFilePath, 'utf8'));
    const withImage = properties.filter(p => p.Image);
    console.log(`📂 ${properties.length} properties loaded, ${withImage.length} have a picked image.\n`);

    const existingRecords = await getExistingRecords();

    // Match properties to Airtable records and determine what needs updating
    const toUpdate = withImage
        .map(p => {
            const record = existingRecords[p.Name.toLowerCase().trim()];
            return record ? { property: p, recordId: record.id, hadImage: record.hasImage } : null;
        })
        .filter(Boolean)
        .slice(0, LIMIT ?? Infinity);

    const notFound = withImage.filter(p => !existingRecords[p.Name.toLowerCase().trim()]);
    if (notFound.length > 0) {
        console.log(`⚠️  ${notFound.length} properties not found in Airtable (not yet imported?):`);
        notFound.forEach(p => console.log(`   - ${p.Name}`));
        console.log('');
    }

    console.log(`🚀 Updating ${toUpdate.length} records with picked images...\n`);

    let updated = 0, failed = 0;

    for (const { property, recordId, hadImage } of toUpdate) {
        try {
            const attachment = await prepareAttachment(property.Image);
            if (!attachment) {
                console.log(`   ⚠️  "${property.Name}" — image download failed, skipping`);
                continue;
            }

            await base(TABLE_NAME).update(recordId, { 'Image': [attachment] });

            const wasStr = hadImage ? 'replaced' : 'added';
            console.log(`   ✅ "${property.Name}" [${wasStr}]`);
            updated++;
            await sleep(4000); // wait for Airtable to fetch from ngrok
        } catch (err) {
            console.error(`   ❌ Failed: "${property.Name}" — ${err.message}`);
            failed++;
        }
    }

    console.log(`\n🎉 Done! Updated: ${updated}, Failed: ${failed}, Not in Airtable: ${notFound.length}`);
    if (imageServer) imageServer.close();
    if (ngrokProcess) ngrokProcess.kill();
}

main();
