require('dotenv').config({ path: require('path').join(__dirname, '../../..', '.env') });
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');
const cheerio = require('cheerio');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// --- CONFIGURATION ---
const TEST_MODE_ONLY = process.env.TEST_MODE_ONLY === 'true';
const LIMIT = process.env.LIMIT ? parseInt(process.env.LIMIT, 10) : null;
const OUTPUT_FILE = path.join(__dirname, 'data', 'national-trust-properties.json');
const CACHE_DIR = path.join(__dirname, 'data', 'cache');
const TEST_DIR = path.join(__dirname, 'test-pages');

const INDEX_PAGE = 'List_of_National_Trust_properties_in_England';
const HOST_ORG = 'National Trust';
const NT_HOSTNAME = 'nationaltrust.org.uk';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const geminiModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

const WIKI_HEADERS = {
    'User-Agent': 'NationalTrustPropertiesBot/1.0 (contact@30x30project.org.uk; Academic/Environmental research crawler)'
};

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) chunks.push(array.slice(i, i + size));
    return chunks;
}

function normalizeTitle(title) {
    if (!title) return '';
    try { return decodeURIComponent(title).replace(/_/g, ' '); } catch (e) { return title.replace(/_/g, ' '); }
}

function isValidPropertyPageTitle(title) {
    if (!title) return false;
    const decoded = normalizeTitle(title);
    const lower = decoded.toLowerCase();

    if (title.includes(':')) return false;
    if (lower.startsWith('list of')) return false;

    const exactIgnores = [
        "national trust", "england", "scotland", "wales", "northern ireland", "united kingdom",
        "wayback machine", "wikipedia", "facebook", "twitter", "bbc", "heritage lottery fund",
        "national lottery heritage fund", "english heritage", "historic england",
        "main page", "contents", "current events", "random article", "about wikipedia",
        "contact us", "help", "community portal", "recent changes", "upload file",
        "area of outstanding natural beauty", "national park", "scheduled monument",
        "grade i listed building", "grade ii listed building", "grade ii* listed building"
    ];
    if (exactIgnores.includes(lower)) return false;

    if (/^\d{1,4}$/.test(lower)) return false;
    return true;
}

function getCacheFilename(action, key) {
    const safeKey = key.replace(/[^a-zA-Z0-9-_]/g, '_').substring(0, 100);
    const hash = crypto.createHash('md5').update(key).digest('hex');
    return path.join(CACHE_DIR, `${action}_${safeKey}_${hash}.json`);
}

async function fetchWithCache(action, key, fetchFn) {
    if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
    const cacheFile = getCacheFilename(action, key);
    if (fs.existsSync(cacheFile)) {
        try { return JSON.parse(fs.readFileSync(cacheFile, 'utf8')); } catch (e) {}
    }
    const data = await fetchFn();
    if (data && !data.error) {
        try { fs.writeFileSync(cacheFile, JSON.stringify(data, null, 2)); } catch (e) {}
    }
    return data;
}

function extractNTUrl(wikitext) {
    if (!wikitext) return null;
    const urls = wikitext.match(/https?:\/\/[^\s\|\]\}\<"']+/ig) || [];
    for (let url of urls) {
        try {
            const hostname = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
            if (hostname === NT_HOSTNAME || hostname.endsWith('.' + NT_HOSTNAME)) return url;
        } catch(e) {}
    }
    const infoboxMatch = wikitext.match(/(?:website|url)\s*=\s*(?:\{\{URL\||\[)?(https?:\/\/[^\s\}\|\]\<"']+)/i);
    if (infoboxMatch) {
        try {
            const hostname = new URL(infoboxMatch[1]).hostname.toLowerCase().replace(/^www\./, '');
            if (hostname === NT_HOSTNAME || hostname.endsWith('.' + NT_HOSTNAME)) return infoboxMatch[1];
        } catch(e) {}
    }
    return null;
}

const NATURE_KEYWORDS = [
    'nature reserve', 'nature park', 'sssi', 'site of special scientific interest',
    'woodland', 'ancient woodland', 'forest',
    'wetland', 'marsh', 'fen', 'bog', 'saltmarsh', 'estuary',
    'meadow', 'grassland', 'chalk grassland', 'heath', 'heathland', 'moorland', 'moor',
    // 'common' alone is too generic — require compound forms
    'village common', 'open common', 'town common', 'nature common',
    'coast', 'coastal', 'cliff', 'sand dune',
    'wildlife', 'habitat', 'biodiversity', 'ecology', 'ecological',
    'conservation area', 'nature conservation',
    'flora', 'fauna', 'bat roost', 'bats', 'otter', 'deer',
    'ancient tree', 'veteran tree', 'orchard',
    'countryside', 'downs', 'escarpment',
    'lake', 'pond', 'waterway',
];

// Properties described primarily in these terms with no nature context are excluded
const ARCHITECTURAL_ONLY_KEYWORDS = [
    'gatehouse', 'cottage', 'cottages', 'almshouse', 'almshouses',
    'priory', 'abbey', 'chapel', 'church', 'cathedral',
    'castle', 'fort', 'tower', 'bridge',
    'manor house', 'country house', 'stately home', 'hall', 'mansion',
    'museum', 'gallery', 'theatre', 'windmill', 'watermill',
];

const TINY_AREA_THRESHOLD_HA = 2;

function assessNatureRelevance(extract, wikitext, area) {
    const text = ((extract || '') + ' ' + (wikitext || '')).toLowerCase();

    const hasNatureKeyword = NATURE_KEYWORDS.some(kw => text.includes(kw));

    // If area is known and tiny, and no nature keywords, exclude
    if (!hasNatureKeyword && area !== null && area < TINY_AREA_THRESHOLD_HA) {
        return { include: false, reason: `tiny area (${area}ha) with no nature keywords` };
    }

    if (!hasNatureKeyword) {
        // Check if it's purely architectural
        const isArchitecturalOnly = ARCHITECTURAL_ONLY_KEYWORDS.some(kw => text.includes(kw));
        if (isArchitecturalOnly) {
            return { include: false, reason: 'architectural-only, no nature context' };
        }
        // Borderline — include but flag for review
        return { include: true, needsReview: true, reason: 'no nature keywords found' };
    }

    return { include: true, needsReview: false };
}

async function generateNatureDescription(name, originalDescription, extract) {
    if (!process.env.GEMINI_API_KEY) return null;
    const fullText = extract || originalDescription || '';
    const prompt = `You are writing a short description for a nature and conservation map of the UK.

The National Trust property is: "${name}"

Wikipedia text:
"""
${fullText.substring(0, 1500)}
"""

Write a single concise sentence (max 30 words) that highlights the nature, landscape, or ecological value of this property — e.g. its woodlands, wildlife, coastline, meadows, or open countryside. Do not mention it is a National Trust property. Do not mention history or architecture unless nature is entirely absent. If there is genuinely no nature angle, reply with exactly: SKIP`;

    try {
        const result = await geminiModel.generateContent(prompt);
        const text = result.response.text().trim();
        if (text === 'SKIP' || text.length < 5) return null;
        return text;
    } catch (err) {
        console.warn(`   ⚠️  Gemini failed for "${name}": ${err.message}`);
        return null;
    }
}

const PHOTO_EXTENSIONS = /\.(jpe?g|png|gif|webp)$/i;
const ICON_PATTERN = /^File:(flag|icon|logo|map|stub|commons|wikimedia|red_pog|blue_pog|green_pog|symbol|arrow|coa_|coat_of|seal_of|badge)/i;
const MAX_IMAGES = 10;

async function fetchImageUrls(fileTitles) {
    if (fileTitles.length === 0) return [];
    const photoTitles = fileTitles
        .filter(t => PHOTO_EXTENSIONS.test(t) && !ICON_PATTERN.test(t))
        .slice(0, MAX_IMAGES);
    if (photoTitles.length === 0) return [];

    const chunks = chunkArray(photoTitles, 20);
    const urls = [];
    for (const chunk of chunks) {
        try {
            const data = await fetchWithCache('nt_imageinfo_v1', chunk.join('|'), async () => {
                const response = await axios.get('https://en.wikipedia.org/w/api.php', {
                    params: { action: 'query', titles: chunk.join('|'), prop: 'imageinfo', iiprop: 'url', format: 'json' },
                    headers: WIKI_HEADERS
                });
                return response.data;
            });
            const pages = data?.query?.pages || {};
            for (const id in pages) {
                const url = pages[id]?.imageinfo?.[0]?.url;
                if (url) urls.push(url);
            }
        } catch (err) {
            console.warn(`   ⚠️  imageinfo fetch failed: ${err.message}`);
        }
    }
    return urls;
}

function extractAreaFromText(text) {
    if (!text) return null;
    const hectareRegex = /([\d.,]+)\s*(?:-|–|\s)*(?:hectare|ha)\b/i;
    const hectMatch = text.match(hectareRegex);
    if (hectMatch) {
        const val = parseFloat(hectMatch[1].replace(/,/g, ''));
        if (!isNaN(val)) return parseFloat(val.toFixed(2));
    }
    const acreRegex = /([\d.,]+)\s*(?:-|–|\s)*(?:acre)\b/i;
    const acreMatch = text.match(acreRegex);
    if (acreMatch) {
        const val = parseFloat(acreMatch[1].replace(/,/g, ''));
        if (!isNaN(val)) return parseFloat((val * 0.4047).toFixed(2));
    }
    return null;
}

async function fetchBatchDetails(titles) {
    if (titles.length === 0) return [];

    const apiUrl = 'https://en.wikipedia.org/w/api.php';
    const params = {
        action: 'query',
        titles: titles.join('|'),
        prop: 'coordinates|extracts|revisions|images',
        rvprop: 'content',
        rvslots: 'main',
        imlimit: 50,
        exintro: 1,
        explaintext: 1,
        exlimit: 'max',
        redirects: 1,
        format: 'json'
    };

    try {
        const responseData = await fetchWithCache('nt_query_v3', titles.join('|'), async () => {
            const response = await axios.get(apiUrl, { params, headers: WIKI_HEADERS });
            return response.data;
        });

        const pages = responseData?.query?.pages;
        if (!pages) return [];

        const titleMap = {};
        titles.forEach(t => titleMap[t.toLowerCase()] = t);
        if (responseData.query.normalized) {
            responseData.query.normalized.forEach(n => titleMap[n.to.toLowerCase()] = titleMap[n.from.toLowerCase()] || n.from);
        }
        if (responseData.query.redirects) {
            responseData.query.redirects.forEach(r => titleMap[r.to.toLowerCase()] = titleMap[r.from.toLowerCase()] || r.from);
        }

        const results = [];
        for (let id in pages) {
            const page = pages[id];
            if (page.missing !== undefined) continue;

            const originalTitle = titleMap[page.title.toLowerCase()] || page.title;

            let wikitext = '';
            if (page.revisions && page.revisions.length > 0) {
                wikitext = page.revisions[0].slots?.main?.['*'] || page.revisions[0]['*'] || '';
            }

            const extractLower = (page.extract || '').toLowerCase();

            // Must have National Trust context
            const hasNTContext =
                extractLower.includes('national trust') ||
                extractNTUrl(wikitext) !== null;

            if (!hasNTContext) continue;

            let lat = null, lon = null;
            if (page.coordinates && page.coordinates.length > 0) {
                lat = parseFloat(page.coordinates[0].lat.toFixed(6));
                lon = parseFloat(page.coordinates[0].lon.toFixed(6));
            }

            const locationUrl = extractNTUrl(wikitext) || null;

            let descriptionText = null;
            if (page.extract && page.extract.length > 20) {
                let cleanExtract = page.extract.replace(/\s*\([^)]*\)/g, '').replace(/\s+/g, ' ');
                const sentences = cleanExtract.match(/[^.!?]+[.!?]+/g);
                descriptionText = sentences ? sentences.slice(0, 2).join(' ').trim() : cleanExtract.trim();
            }
            if (!descriptionText) descriptionText = 'A National Trust property.';

            const area = extractAreaFromText(page.extract) || extractAreaFromText(wikitext);

            const relevance = assessNatureRelevance(page.extract, wikitext, area);
            if (!relevance.include) {
                console.log(`   🚫 Excluded "${normalizeTitle(originalTitle)}": ${relevance.reason}`);
                continue;
            }

            const tags = ['Wikipedia Import'];
            if (relevance.needsReview) tags.push('Needs Review');

            const descriptionModified = await generateNatureDescription(normalizeTitle(originalTitle), descriptionText, page.extract);
            if (!descriptionModified) {
                console.log(`   🚫 Excluded "${normalizeTitle(originalTitle)}": Gemini found no nature angle`);
                continue;
            }

            const fileTitles = (page.images || []).map(img => img.title);
            const images = await fetchImageUrls(fileTitles);

            results.push({
                Name: normalizeTitle(originalTitle),
                HostOrg: HOST_ORG,
                Lat: lat,
                Long: lon,
                Area: area,
                Description: descriptionText,
                DescriptionModified: descriptionModified,
                Images: images,
                LocationUrl: locationUrl,
                'Suggestion-Tags': tags,
                'AI-Notes': `[Wiki Subpage Scraped]: Programmatically parsed from Wikipedia. Source index: "${INDEX_PAGE}".`
            });
        }
        return results;
    } catch (err) {
        console.error('   ❌ Error querying batch details:', err.message);
        return [];
    }
}

async function extractPropertiesFromIndexHtml(htmlContent, skipNames = new Set()) {
    const $ = cheerio.load(htmlContent);
    const candidateTitles = new Set();

    // Pull links from tables and lists on the index page
    $('table.wikitable a, .div-col a, div.columns a, li a').each((_, a) => {
        if ($(a).closest('.navbox, [role="navigation"], .infobox, .reflist, .references').length > 0) return;
        const href = $(a).attr('href');
        if (!href) return;
        const match = href.match(/\/wiki\/([^#?:]+)/);
        if (!match) return;
        const title = normalizeTitle(match[1]);
        if (isValidPropertyPageTitle(match[1])) candidateTitles.add(title);
    });

    let titlesArray = Array.from(candidateTitles)
        .filter(t => !skipNames.has(t.toLowerCase()));

    const skippedCount = candidateTitles.size - titlesArray.length;
    console.log(`   🔍 Found ${candidateTitles.size} candidate links. ${skippedCount > 0 ? `Skipping ${skippedCount} already scraped. ` : ''}${titlesArray.length} remaining.`);

    if (LIMIT) {
        titlesArray = titlesArray.slice(0, LIMIT);
        console.log(`   ⚠️  LIMIT=${LIMIT}: processing only first ${titlesArray.length} title(s).`);
    }

    const allResults = [];
    const chunks = chunkArray(titlesArray, 10);
    for (let i = 0; i < chunks.length; i++) {
        console.log(`   📡 Batch ${i + 1}/${chunks.length}: querying ${chunks[i].length} pages...`);
        const batch = await fetchBatchDetails(chunks[i]);
        allResults.push(...batch);
        // Write progress after each batch so a restart can resume
        if (fs.existsSync(OUTPUT_FILE)) {
            const existing = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8'));
            const merged = [...existing, ...batch];
            fs.writeFileSync(OUTPUT_FILE, JSON.stringify(merged, null, 2));
        }
        await sleep(150);
    }

    console.log(`   🎯 ${allResults.length} new properties found.`);
    return allResults;
}

async function scrapeIndexPage(skipNames) {
    console.log(`\n⏳ Fetching Wikipedia index: "${INDEX_PAGE}"...`);
    const apiUrl = 'https://en.wikipedia.org/w/api.php';
    const params = { action: 'parse', page: INDEX_PAGE, format: 'json', prop: 'text', redirects: 1 };

    const responseData = await fetchWithCache('nt_parse_index_v1', INDEX_PAGE, async () => {
        const response = await axios.get(apiUrl, { params, headers: WIKI_HEADERS });
        return response.data;
    });

    const htmlContent = responseData.parse?.text?.['*'];
    if (!htmlContent) throw new Error(`Could not parse index page: ${INDEX_PAGE}`);
    return extractPropertiesFromIndexHtml(htmlContent, skipNames);
}

async function scrapeLocalPage(filePath) {
    const fileName = path.basename(filePath);
    console.log(`\n🧪 Processing local test page: "${fileName}"...`);
    const htmlContent = fs.readFileSync(filePath, 'utf8');
    const results = await extractPropertiesFromIndexHtml(htmlContent);
    results.forEach(r => r.SourceFile = fileName);
    return results;
}

async function runTests(allResults) {
    const expectedPath = path.join(TEST_DIR, 'expected.json');
    if (!fs.existsSync(expectedPath)) return;

    console.log('\n🧪 Running automated tests against expected.json...');
    const expectedData = JSON.parse(fs.readFileSync(expectedPath, 'utf8'));
    let passed = 0, failed = 0;

    for (let testCase of expectedData) {
        if (testCase.expectedProperty) {
            const expected = testCase.expectedProperty;

            if (expected.validMinProperties !== undefined) {
                const count = allResults.length;
                if (count >= expected.validMinProperties) {
                    console.log(`   ✅ PASS: Found ${count} properties (expected min: ${expected.validMinProperties}).`);
                    passed++;
                } else {
                    console.error(`   ❌ FAIL: Found only ${count} properties (expected min: ${expected.validMinProperties}).`);
                    failed++;
                }
                continue;
            }

            if (!expected.Name) { console.warn('   ⚠️  Invalid test case: missing expectedProperty.Name'); continue; }

            const found = allResults.find(r => r.Name.toLowerCase() === expected.Name.toLowerCase());
            if (!found) {
                console.error(`   ❌ FAIL: Could not find property named "${expected.Name}"`);
                failed++;
                continue;
            }

            let match = true;
            const errors = [];
            for (let key in expected) {
                if (key === 'Description') {
                    const cleanExpected = expected[key].replace(/\[.*?\]/g, '').replace(/\s*\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
                    const cleanFound = found[key] || '';
                    const matchLen = Math.min(25, cleanExpected.length);
                    if (!cleanFound.includes(cleanExpected.substring(0, matchLen))) {
                        match = false; errors.push(`Mismatched Description:\n  Expected: ${cleanExpected}\n  Got:      ${cleanFound}`);
                    }
                } else if (found[key] !== expected[key]) {
                    match = false; errors.push(`Mismatched ${key}: expected ${expected[key]}, got ${found[key]}`);
                }
            }

            if (match) { console.log(`   ✅ PASS: "${expected.Name}" extracted and verified.`); passed++; }
            else { console.error(`   ❌ FAIL: Data mismatch for "${expected.Name}".`); errors.forEach(e => console.error(`       - ${e}`)); failed++; }

        } else if (testCase.notExpectedProperties) {
            for (let badName of testCase.notExpectedProperties) {
                if (allResults.find(r => r.Name.toLowerCase() === badName.toLowerCase())) {
                    console.error(`   ❌ FAIL: "${badName}" was scraped but should have been filtered.`);
                    failed++;
                } else {
                    console.log(`   ✅ PASS: "${badName}" correctly excluded.`);
                    passed++;
                }
            }
        }
    }

    console.log(`\n📊 Test Summary: ${passed} passed, ${failed} failed.`);
    if (failed > 0 && TEST_MODE_ONLY) { console.log('🛑 Stopping due to test failures.'); process.exit(1); }
}

async function main() {
    console.log('🏛️  National Trust Properties Scraper — Wikipedia Source');

    const outputDir = path.dirname(OUTPUT_FILE);
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    if (!fs.existsSync(TEST_DIR)) {
        fs.mkdirSync(TEST_DIR, { recursive: true });
        console.log(`📁 Created test directory: ${TEST_DIR}`);
        console.log('💡 Drop .html files here to test the parser without hitting the web.');
    }

    // Load any existing results so we can resume after a cancel
    let allResults = [];
    if (fs.existsSync(OUTPUT_FILE)) {
        try {
            allResults = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8'));
            if (allResults.length > 0) console.log(`\n♻️  Resuming — loaded ${allResults.length} previously scraped properties.`);
        } catch (e) { allResults = []; }
    }
    const skipNames = new Set(allResults.map(r => r.Name.toLowerCase().trim()));

    const testFiles = fs.readdirSync(TEST_DIR).filter(f => f.endsWith('.html') || f.endsWith('.htm'));
    if (testFiles.length > 0) {
        console.log(`\n🛠️  Found ${testFiles.length} local test page(s). Processing first...`);
        for (let file of testFiles) {
            allResults = allResults.concat(await scrapeLocalPage(path.join(TEST_DIR, file)));
        }
        await runTests(allResults);
    }

    if (!TEST_MODE_ONLY) {
        const liveResults = await scrapeIndexPage(skipNames);
        allResults = allResults.concat(liveResults);
    } else {
        console.log('\n⚠️  TEST_MODE_ONLY=true — skipping live crawl.');
    }

    // Deduplicate by name
    const unique = [];
    const seen = new Set();
    for (let r of allResults) {
        const key = r.Name.toLowerCase().trim();
        if (!seen.has(key)) {
            seen.add(key);
            const toSave = { ...r };
            delete toSave.SourceFile;
            unique.push(toSave);
        }
    }

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(unique, null, 2));
    console.log(`\n🎉 Done! Saved ${unique.length} unique properties to: ${OUTPUT_FILE}`);
}

main();
