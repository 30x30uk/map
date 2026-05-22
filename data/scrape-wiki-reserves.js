const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');
const cheerio = require('cheerio');
const { gridRefToLatLon, extractGridRef, parseGeoHackCoords } = require('./geo-utils.js');

// --- CONFIGURATION ---
const TEST_MODE_ONLY = process.env.TEST_MODE_ONLY === 'true'; 
const OUTPUT_FILE = path.join(process.cwd(), 'data', 'wiki-reserves.json');
const CACHE_DIR = path.join(process.cwd(), 'data', 'wiki-cache');
const TEST_DIR = path.join(process.cwd(), 'data', 'wildlife-trust-test-pages'); 

const WIKI_HEADERS = {
    'User-Agent': 'WildlifeTrustReservesBot/1.0 (contact@30x30project.org.uk; Academic/Environmental research crawler)'
};

// --- VERIFIED TRUST DOMAINS & WIKIPEDIA PAGES ---
const TRUST_DOMAINS = [
    "https://www.alderneywildlife.org", "https://www.avonwildlifetrust.org.uk", "https://www.wildlifebcn.org", "https://www.bbowt.org.uk",
    "https://www.bbcwildlife.org.uk", "https://www.cheshirewildlifetrust.org.uk", "https://www.cornwallwildlifetrust.org.uk", "https://www.cumbriawildlifetrust.org.uk",
    "https://www.derbyshirewildlifetrust.org.uk", "https://www.devonwildlifetrust.org", "https://www.dorsetwildlifetrust.org.uk", "https://www.durhamwt.com",
    "https://www.essexwt.org.uk", "https://www.gloucestershirewildlifetrust.co.uk", "https://www.gwentwildlife.org", "https://www.hiwwt.org.uk",
    "https://www.herefordshirewt.org", "https://www.hertswildlifetrust.org.uk", "https://www.ios-wildlifetrust.org.uk", "https://www.kentwildlifetrust.org.uk",
    "https://www.lancswt.org.uk", "https://www.lrwt.org.uk", "https://www.lincstrust.org.uk", "https://www.wildlondon.org.uk",
    "https://www.mwt.im", "https://www.montwt.co.uk", "https://www.norfolkwildlifetrust.org.uk", "https://www.northwaleswildlifetrust.org.uk",
    "https://www.nwt.org.uk", "https://www.nottinghamshirewildlife.org", "https://www.rwtwales.org", "https://scottishwildlifetrust.org.uk",
    "https://www.shropshirewildlifetrust.org.uk", "https://www.somersetwildlife.org", "https://www.staffs-wildlife.org.uk", "https://www.suffolkwildlifetrust.org",
    "https://www.surreywildlifetrust.org", "https://www.sussexwildlifetrust.org.uk", "https://www.teeswildlife.org", "https://www.ulsterwildlife.org",
    "https://www.warwickshirewildlifetrust.org.uk", "https://www.wildsheffield.com", "https://www.welshwildlife.org", "https://www.wiltshirewildlife.org",
    "https://www.worcswildlifetrust.co.uk", "https://www.ywt.org.uk"
];

const TRUST_WIKI_PAGES = [
    "Alderney_Wildlife_Trust", "Avon_Wildlife_Trust", "Bedfordshire,_Cambridgeshire_and_Northamptonshire_Wildlife_Trust", "Berkshire,_Buckinghamshire_and_Oxfordshire_Wildlife_Trust",
    "Birmingham_and_Black_Country_Wildlife_Trust", "Cheshire_Wildlife_Trust", "Cornwall_Wildlife_Trust", "Cumbria_Wildlife_Trust",
    "Derbyshire_Wildlife_Trust", "Devon_Wildlife_Trust", "Dorset_Wildlife_Trust", "Durham_Wildlife_Trust",
    "Essex_Wildlife_Trust", "Gloucestershire_Wildlife_Trust", "Gwent_Wildlife_Trust", "Hampshire_and_Isle_of_Wight_Wildlife_Trust",
    "Herefordshire_Wildlife_Trust", "Hertfordshire_and_Middlesex_Wildlife_Trust", "Isles_of_Scilly_Wildlife_Trust", "Kent_Wildlife_Trust",
    "Lancashire_Wildlife_Trust", "Leicestershire_and_Rutland_Wildlife_Trust", "Lincolnshire_Wildlife_Trust", "London_Wildlife_Trust",
    "Manx_Wildlife_Trust", "Montgomeryshire_Wildlife_Trust", "Norfolk_Wildlife_Trust", "North_Wales_Wildlife_Trust",
    "Northumberland_Wildlife_Trust", "Nottinghamshire_Wildlife_Trust", "Radnorshire_Wildlife_Trust", "Scottish_Wildlife_Trust",
    "Shropshire_Wildlife_Trust", "Somerset_Wildlife_Trust", "Staffordshire_Wildlife_Trust", "Suffolk_Wildlife_Trust",
    "Surrey_Wildlife_Trust", "Sussex_Wildlife_Trust", "Tees_Valley_Wildlife_Trust", "Ulster_Wildlife_Trust",
    "Warwickshire_Wildlife_Trust", "Wildlife_Trust_for_Sheffield_and_Rotherham", "Wildlife_Trust_of_South_and_West_Wales", "Wiltshire_Wildlife_Trust",
    "Worcestershire_Wildlife_Trust", "Yorkshire_Wildlife_Trust"
];

const TRUST_HOSTNAMES = TRUST_DOMAINS.map(url => {
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch(e) { return url; }
});

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size));
    }
    return chunks;
}

function normalizeTitle(title) {
    if (!title) return '';
    try { return decodeURIComponent(title).replace(/_/g, ' '); } catch (e) { return title.replace(/_/g, ' '); }
}

function isValidReservePageTitle(title) {
    if (!title) return false;
    const decoded = normalizeTitle(title);
    const lower = decoded.toLowerCase();
    
    if (title.includes(':')) return false; 
    if (lower.startsWith('list of')) return false; 
    
    const exactIgnores = [
        "wildlife trust", "natural england", "nature reserve", "local nature reserve", "national nature reserve", 
        "site of special scientific interest", "ancient woodland", "trust for nature conservation", "england", "scotland", 
        "wales", "northern ireland", "united kingdom", "wayback machine", "wikipedia", "facebook", "twitter", "bbc",
        "flora", "fauna", "species", "statistics", "donate", "wikimedia foundation, inc.", "wikimedia foundation", 
        "bronze age", "scheduled monument", "wiltshire", "main page", "contents", "current events", "random article", 
        "about wikipedia", "contact us", "help", "learn to edit", "community portal", "recent changes", "upload file",
        "issn (identifier)", "bibcode (identifier)", "kml", "british nature conservation statuses", "area of outstanding natural beauty",
        "second world war", "natura 2000", "hectare", "biodiversity", "ramsar convention", "coppicing", "coppice with standards", "coppice",
        "heritage lottery fund", "national lottery heritage fund", "environment agency", "forestry commission", 
        "south gloucestershire", "north somerset", "severn estuary", "bristol channel"
    ];
    if (exactIgnores.includes(lower)) return false;
    
    const wordIgnores = ["county", "district", "borough", "town", "city", "village", "parish", "council", "committee", "trustees"];
    if (wordIgnores.some(item => lower === item || lower.endsWith(' ' + item) || lower.startsWith(item + ' '))) {
        return false;
    }

    if (/^\d{1,4}$/.test(lower)) return false; 
    return true;
}

function extractAreaFromText(text) {
    if (!text) return null;
    const infoboxRegex = /area\s*=\s*(?:\{\{convert\|)?([\d.,]+)\s*(?:\|)?\s*(ha|hectare|acre)/i;
    const infoMatch = text.match(infoboxRegex);
    if (infoMatch) {
        const val = parseFloat(infoMatch[1].replace(/,/g, ''));
        if (!isNaN(val)) {
            if (infoMatch[2].toLowerCase().startsWith('acre')) return parseFloat((val * 0.4047).toFixed(2));
            return parseFloat(val.toFixed(2));
        }
    }

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

function extractLocationURL(wikitext) {
    if (!wikitext) return null;
    const urls = wikitext.match(/https?:\/\/[^\s\|\]\}\<"']+/ig) || [];
    for (let url of urls) {
        try {
            const hostname = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
            if (TRUST_HOSTNAMES.some(trustHost => hostname === trustHost || hostname.endsWith('.' + trustHost))) {
                return url; 
            }
        } catch(e) {}
    }
    const infoboxMatch = wikitext.match(/(?:website|url)\s*=\s*(?:\{\{URL\||\[)?(https?:\/\/[^\s\}\|\]\<"']+)/i);
    if (infoboxMatch) return infoboxMatch[1];
    return null;
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

function extractPageTitleFromElement($el) {
    const href = $el.attr('href');
    const title = $el.attr('title');
    
    if (!href) return null;
    if (href.startsWith('#')) return null; 
    
    const match = href.match(/\/wiki\/([^#?]+)/);
    if (match) return match[1];
    
    if (title) {
        const ignoreTitles = ["Edit section", "Enlarge", "Wikipedia", "Wikimedia"];
        if (ignoreTitles.some(t => title.includes(t))) return null;
        return title.replace(/ /g, '_');
    }

    if (href.endsWith('.html') || href.endsWith('.htm')) return href.split('/').pop().replace(/\.html?$/, '');

    const text = $el.text().trim();
    if (text) return text.replace(/ /g, '_');
    return null;
}

async function fetchBatchCoordsAndDetails(titles, hostOrg) {
    if (titles.length === 0) return [];
    
    const apiUrl = `https://en.wikipedia.org/w/api.php`;
    const params = {
        action: 'query',
        titles: titles.join('|'),
        prop: 'coordinates|extracts|revisions|pageimages',
        rvprop: 'content',
        rvslots: 'main',
        pithumbsize: 800,
        exintro: 1,
        explaintext: 1,
        exlimit: 'max', 
        redirects: 1, 
        format: 'json'
    };

    try {
        // BUMP CACHE KEY to v14 to clear out the old NLP anomalies 
        const responseData = await fetchWithCache('query_v14', titles.join('|'), async () => {
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
            const originalTitle = titleMap[page.title.toLowerCase()] || page.title;
            
            let wikitext = "";
            if (page.revisions && page.revisions.length > 0) {
                wikitext = page.revisions[0].slots?.main?.['*'] || page.revisions[0]['*'] || "";
            }

            // --- STRICT NLP VALIDATION FILTER ---
            // Extract a clean first sentence by removing newlines and parenthetical text (e.g. pronunciations/dates)
            let cleanExtractForSentence = (page.extract || "").replace(/\n/g, ' ').replace(/\s*\([^)]*\)/g, '').trim();
            const firstSentence = (cleanExtractForSentence.split(/(?<=[.!?])\s+/)[0] || "").toLowerCase();
            
            let locationUrl = extractLocationURL(wikitext);
            
            // SECURITY FIX: Ensure the URL is an explicitly verified Trust domain, not a generic infobox link
            let isVerifiedUrl = false;
            if (locationUrl) {
                try {
                    const hostname = new URL(locationUrl).hostname.toLowerCase().replace(/^www\./, '');
                    isVerifiedUrl = TRUST_HOSTNAMES.some(trustHost => hostname === trustHost || hostname.endsWith('.' + trustHost));
                } catch(e) {}
            }

            const isNatureReserve = firstSentence.includes("nature reserve") || firstSentence.includes("sssi") || firstSentence.includes("site of special scientific interest") || firstSentence.includes("nature park") || firstSentence.includes("country park");

            // 1. HARD DROPS: Massive geographical areas, administrative bodies, species, concepts. 
            // We drop these even if they have a Wildlife Trust URL in their footnotes!
            const hardDropRegex = /\b(is|are|forms|was|were|refers to)\b.{0,60}?\b(towns?|villages?|cities|city|civil parishes|civil parish|suburbs?|hamlets?|settlements?|count(?:y|ies)|ceremonial count(?:y|ies)|districts?|boroughs?|unitary authorities|unitary authority|regions?|countries|country|national parks?|biosphere reserves?|newspapers?|publications?|charit(?:y|ies)|organisations?|organizations?|funds?|public bodies|public body|government departments?|agenc(?:y|ies)|councils?|coastal plains?|upland areas?|mountain ranges?|disciplines?|sciences?|studies|study|concepts?|businesses|business|compan(?:y|ies)|websites?|universit(?:y|ies)|colleges?|schools?|partners?|trusts?|birds?|ducks?|plants?|species|genus|families|family|mammals?|insects?|butterflies|butterfly|moths?|periods?|eras?|rivers?|estuar(?:y|ies)|canals?|mountains?|waterfalls?|waterways?)\b/i;
            
            if (firstSentence.match(hardDropRegex) && !isNatureReserve) {
                continue; 
            }

            // 2. SOFT DROPS: Biological organisms, physical landmarks, and properties that MIGHT be a reserve.
            // We drop these UNLESS they have a verified URL (e.g. a Trust-owned quarry) OR explicitly claim to be a reserve.
            const softDropRegex = /\b(is|are|forms|was|were)\b.{0,60}?\b(hills?|promontor(?:y|ies)|headlands?|peninsulas?|islands?|lochs?|sea lochs?|railway stations?|halts?|stations?|stately homes?|mansions?|estates?|hillforts?|castles?|quarr(?:y|ies)|kilns?|works|factories|factory|mills?|lakes?|reservoirs?|archaeological sites?|historic sites?|monuments?|buildings?|stadiums?|farms?|woods?|forests?)\b/i;
            const isSoftConcept = firstSentence.match(softDropRegex) || firstSentence.match(/\b(was|is)\b.{0,30}?\b(general|statesman|author|person)\b/i);
            
            if (isSoftConcept && !isNatureReserve && !isVerifiedUrl) {
                continue;
            }

            const extractLower = (page.extract || '').toLowerCase();
            
            // STRICT CONTEXT: Must have a verified Trust URL, OR explicitly mention the Trust in the intro text.
            const hasConservationContext = 
                isVerifiedUrl ||
                extractLower.includes('wildlife trust') ||
                (hostOrg && extractLower.includes(hostOrg.toLowerCase()));

            if (!hasConservationContext && !isNatureReserve) {
                continue; 
            }
            // --- END CONTENT VALIDATION FILTER ---

            let area = extractAreaFromText(page.extract) || extractAreaFromText(wikitext);
            let lat = null, lon = null;
            
            if (page.coordinates && page.coordinates.length > 0) {
                lat = parseFloat(page.coordinates[0].lat.toFixed(6));
                lon = parseFloat(page.coordinates[0].lon.toFixed(6));
            } else {
                let gridRef = extractGridRef(page.extract, true) || extractGridRef(wikitext, true); 
                if (gridRef) {
                    const coords = gridRefToLatLon(gridRef);
                    if (coords) { lat = coords.lat; lon = coords.lon; }
                }
            }

            const imageUrl = page.thumbnail ? page.thumbnail.source : null;
            if (!locationUrl) locationUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, '_'))}`;

            let descriptionText = null;
            if (page.extract && page.extract.length > 20) {
                let cleanExtract = page.extract.replace(/\s*\([^)]*\)/g, '').replace(/\s+/g, ' '); 
                const sentences = cleanExtract.match(/[^.!?]+[.!?]+/g);
                descriptionText = (sentences && sentences.length > 0) ? sentences.slice(0, 2).join(' ').trim() : cleanExtract.trim();
            }

            if (!descriptionText) {
                try {
                    const htmlRes = await axios.get(locationUrl, { headers: WIKI_HEADERS });
                    const _$ = cheerio.load(htmlRes.data);
                    _$('p').not('.mw-empty-elt').each((i, el) => {
                        const text = _$(el).text().trim();
                        if (text.length > 40 && !text.includes('Coordinates:')) {
                            let cleanExtract = text.replace(/\[.*?\]/g, '').replace(/\s*\([^)]*\)/g, '').replace(/\s+/g, ' ');
                            const sentences = cleanExtract.match(/[^.!?]+[.!?]+/g);
                            descriptionText = (sentences && sentences.length > 0) ? sentences.slice(0, 2).join(' ').trim() : cleanExtract.trim();
                            return false; 
                        }
                    });
                } catch(e) {}
            }

            if (!descriptionText) {
                descriptionText = area !== null 
                    ? `A local nature reserve of approximately ${Math.round(area)} hectares.`
                    : "A local nature reserve.";
            }

            results.push({ Name: originalTitle, HostOrg: hostOrg, Lat: lat, Long: lon, Area: area, Description: descriptionText, Image: imageUrl, LocationUrl: locationUrl });
        }
        return results;
    } catch (err) {
        console.error(`   ❌ Error querying batch details:`, err.message);
        return [];
    }
}

async function extractReservesFromHtml(htmlContent, cleanTitle, hostOrg) {
    const $ = cheerio.load(htmlContent);
    const reserves = [];
    const candidateTitles = new Set(); 

    const tables = $('table.wikitable');
    tables.each((_, table) => {
        const headers = [];
        $(table).find('tr').first().find('th, td').each((_, cell) => headers.push($(cell).text().trim().toLowerCase()));

        const nameIdx = headers.findIndex(h => h.includes('reserve') || h.includes('name') || h.includes('site') || h.includes('location') || h.includes('property') || h.includes('title'));
        const areaIdx = headers.findIndex(h => h.includes('area') || h.includes('size') || h.includes('ha') || h.includes('hectares'));
        const coordIdx = headers.findIndex(h => h.includes('coordinate') || h.includes('location') || h.includes('grid ref'));

        if (nameIdx === -1) return;

        $(table).find('tr').slice(1).each((_, row) => {
            const cols = $(row).find('td, th'); 
            if (cols.length === 0) return;

            const nameText = $(cols[nameIdx]).text().replace(/\[.*?\]/g, '').trim().replace(/\s+/g, ' ');
            if (!nameText) return;

            let areaValue = null;
            let descriptionText = "A local nature reserve.";
            if (areaIdx !== -1 && cols[areaIdx]) {
                const areaText = $(cols[areaIdx]).text().trim().toLowerCase();
                const areaMatch = areaText.match(/([\d.,]+)\s*(?:ha|hectare|acres)?/);
                if (areaMatch) {
                    const parsedArea = parseFloat(areaMatch[1].replace(/,/g, ''));
                    if (!isNaN(parsedArea)) areaValue = areaText.includes('acres') && !areaText.includes('ha') && !areaText.includes('hectare') ? parseFloat((parsedArea * 0.4047).toFixed(2)) : parseFloat(parsedArea.toFixed(2));
                }
            }

            let coords = null;
            if (coordIdx !== -1 && cols[coordIdx]) coords = parseGeoHackCoords($(cols[coordIdx]).find('a[href*="geohack"]').first().attr('href'));
            if (!coords) coords = parseGeoHackCoords($(row).find('a[href*="geohack"]').first().attr('href'));
            if (!coords) {
                const gridRef = extractGridRef($(row).text(), false); 
                if (gridRef) coords = gridRefToLatLon(gridRef);
            }

            let subPageTitle = null;
            const rawSubTitle = extractPageTitleFromElement($(cols[nameIdx]).find('a').first());
            if (rawSubTitle && isValidReservePageTitle(rawSubTitle)) {
                subPageTitle = normalizeTitle(rawSubTitle);
                candidateTitles.add(subPageTitle);
            }

            if (areaValue !== null) descriptionText = `A local nature reserve of approximately ${Math.round(areaValue)} hectares.`;

            reserves.push({
                Name: nameText, HostOrg: hostOrg, Lat: coords ? coords.lat : null, Long: coords ? coords.lon : null, Area: areaValue, Description: descriptionText, Image: null, LocationUrl: null, 
                "Suggestion-Tags": ["Wikipedia Import"],
                "AI-Notes": coords ? `[Wiki Table Scraped]: Programmatically parsed from Wikipedia page: "${hostOrg}". Coordinates resolved using standard geo-mapping lookup.` : `[Wiki Table + Subpage Merge]: Name parsed from table on "${hostOrg}". Attempting to merge coordinates from subpage.`,
                _subPageTitle: subPageTitle
            });
        });
    });

    console.log(`   🔍 Scanning page text for linked subpages...`);

    $('p a, li a, td a, th a, .div-col a, div.columns a').each((_, a) => {
        if ($(a).closest('.navbox, .navbox-title, [role="navigation"], .infobox, .mw-indicators, .reflist, .references, .reference').length > 0) return;
        
        const rawSubTitle = extractPageTitleFromElement($(a));
        if (rawSubTitle && isValidReservePageTitle(rawSubTitle)) {
            candidateTitles.add(normalizeTitle(rawSubTitle));
        }
    });

    const titlesArray = Array.from(candidateTitles);
    if (titlesArray.length > 0) {
        console.log(`   📡 Batch querying ${titlesArray.length} candidate subpage links...`);
        const titleChunks = chunkArray(titlesArray, 10); 
        
        for (let chunk of titleChunks) {
            const batchReserves = await fetchBatchCoordsAndDetails(chunk, hostOrg);
            for (let r of batchReserves) {
                const existingIdx = reserves.findIndex(existing => (existing._subPageTitle && existing._subPageTitle.toLowerCase() === r.Name.toLowerCase()) || (existing.Name.toLowerCase() === r.Name.toLowerCase()));
                
                if (existingIdx !== -1) {
                    if (reserves[existingIdx].Lat === null && r.Lat !== null) { reserves[existingIdx].Lat = r.Lat; reserves[existingIdx].Long = r.Long; }
                    if (r.Area !== null && reserves[existingIdx].Area === null) reserves[existingIdx].Area = r.Area;
                    if (r.Description && !r.Description.startsWith("A local nature reserve")) reserves[existingIdx].Description = r.Description; 
                    if (r.Image) reserves[existingIdx].Image = r.Image;
                    if (r.LocationUrl) reserves[existingIdx].LocationUrl = r.LocationUrl;
                } else {
                    reserves.push({
                        Name: r.Name, HostOrg: hostOrg, Lat: r.Lat, Long: r.Long, Area: r.Area, Description: r.Description, Image: r.Image, LocationUrl: r.LocationUrl,
                        "Suggestion-Tags": ["Wikipedia Import"],
                        "AI-Notes": `[Wiki Subpage Scraped]: Programmatically parsed from subpage linked in: "${hostOrg}". Details resolved using Wikipedia Query API (coordinates and extracts).`
                    });
                }
            }
            await sleep(100);
        }
    }

    const validReserves = reserves.filter(r => r.Lat !== null && r.Long !== null);

    if (isValidReservePageTitle(cleanTitle)) {
        console.log(`   💡 Evaluating page itself as a reserve: "${cleanTitle}"`);
        let localDescription = null;
        $('p').not('.mw-empty-elt').each((i, el) => {
            const text = $(el).text().trim();
            if (text.length > 30) {
                let cleanExtract = text.replace(/\[.*?\]/g, '').replace(/\s*\([^)]*\)/g, '').replace(/\s+/g, ' ');
                const sentences = cleanExtract.match(/[^.!?]+[.!?]+/g);
                localDescription = (sentences && sentences.length > 0) ? sentences.slice(0, 2).join(' ').trim() : cleanExtract.trim();
                return false; 
            }
        });

        const selfBatch = await fetchBatchCoordsAndDetails([cleanTitle], hostOrg);
        
        for (let r of selfBatch) {
            if (localDescription && (!r.Description || r.Description.startsWith("A local nature reserve"))) r.Description = localDescription;
            const existingIdx = reserves.findIndex(existing => (existing._subPageTitle && existing._subPageTitle.toLowerCase() === r.Name.toLowerCase()) || (existing.Name.toLowerCase() === r.Name.toLowerCase()));
            
            if (existingIdx !== -1) {
                if (reserves[existingIdx].Lat === null && r.Lat !== null) { reserves[existingIdx].Lat = r.Lat; reserves[existingIdx].Long = r.Long; }
                if (r.Area !== null && reserves[existingIdx].Area === null) reserves[existingIdx].Area = r.Area;
                if (r.Description && !r.Description.startsWith("A local nature reserve")) reserves[existingIdx].Description = r.Description;
                if (r.Image) reserves[existingIdx].Image = r.Image;
                if (r.LocationUrl) reserves[existingIdx].LocationUrl = r.LocationUrl;
            } else if (r.Lat !== null && r.Long !== null) {
                validReserves.push(r);
            }
        }
    }

    validReserves.forEach(r => delete r._subPageTitle);
    console.log(`   🎯 Extracted ${validReserves.length} reserves with valid coordinates.`);
    return validReserves;
}

async function scrapeTrustPage(pageTitle) {
    const cleanTitle = pageTitle.replace(/_/g, ' ');
    console.log(`\n⏳ Fetching Wikipedia Page: "${cleanTitle}"...`);
    const apiUrl = `https://en.wikipedia.org/w/api.php`;
    const params = { action: 'parse', page: pageTitle, format: 'json', prop: 'text', redirects: 1 };

    try {
        const responseData = await fetchWithCache('parse', pageTitle, async () => {
            const response = await axios.get(apiUrl, { params, headers: WIKI_HEADERS });
            return response.data;
        });

        const htmlContent = responseData.parse?.text?.['*'];
        if (!htmlContent) {
            console.log(`   ⚠️ Could not find parseable content for ${pageTitle}`);
            return [];
        }
        return await extractReservesFromHtml(htmlContent, cleanTitle, cleanTitle);
    } catch (err) {
        console.error(`   ❌ Error querying ${pageTitle}:`, err.message);
        return [];
    }
}

async function scrapeLocalPage(filePath) {
    const fileName = path.basename(filePath);
    console.log(`\n🧪 Processing Local Test Page: "${fileName}"...`);
    
    try {
        const htmlContent = fs.readFileSync(filePath, 'utf8');
        const $ = cheerio.load(htmlContent);
        
        let cleanTitle = $('title').text().replace(/ - Wikipedia$/, '').trim();
        if (!cleanTitle) cleanTitle = fileName.replace(/\.html?$/, '').replace(/_/g, ' ');
        
        let hostOrg = cleanTitle;
        const trustPageNames = TRUST_WIKI_PAGES.map(t => t.replace(/_/g, ' '));
        
        if (!trustPageNames.includes(cleanTitle)) {
            const pageText = $('body').text().replace(/\s+/g, ' ');
            for (let trustName of trustPageNames) {
                if (pageText.includes(trustName)) {
                    hostOrg = trustName;
                    break;
                }
            }
        }
        
        console.log(`   🏢 Detected HostOrg: "${hostOrg}"`);
        const extracted = await extractReservesFromHtml(htmlContent, cleanTitle, hostOrg);
        
        extracted.forEach(r => r.SourceFile = fileName);
        return extracted;
    } catch (err) {
        console.error(`   ❌ Error reading local file ${fileName}:`, err.message);
        return [];
    }
}

async function main() {
    console.log("🌐 Initializing Wikipedia Nature Reserve Scraper...");
    let allReserves = [];

    const outputDir = path.dirname(OUTPUT_FILE);
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    if (!fs.existsSync(TEST_DIR)) {
        fs.mkdirSync(TEST_DIR, { recursive: true });
        console.log(`📁 Created test directory: ${TEST_DIR}`);
        console.log(`💡 You can drop .html files in here to test the parser before querying the web.`);
    }

    const testFiles = fs.readdirSync(TEST_DIR).filter(f => f.endsWith('.htm') || f.endsWith('.html'));
    if (testFiles.length > 0) {
        console.log(`\n🛠️ Found ${testFiles.length} local test pages. Processing these first...`);
        for (let file of testFiles) {
            allReserves = allReserves.concat(await scrapeLocalPage(path.join(TEST_DIR, file)));
        }

        const expectedPath = path.join(TEST_DIR, 'expected.json');
        if (fs.existsSync(expectedPath)) {
            console.log(`\n🧪 Running Automated Tests against expected.json...`);
            try {
                const expectedData = JSON.parse(fs.readFileSync(expectedPath, 'utf8'));
                let passed = 0, failed = 0;

                for (let testCase of expectedData) {
                    if (testCase.expectedReserve) {
                        const expected = testCase.expectedReserve;

                        if (expected.validMinReserves !== undefined) {
                            const sourceMatch = expected.source;
                            const count = sourceMatch ? allReserves.filter(r => r.SourceFile && r.SourceFile.replace(/\.html?$/, '') === sourceMatch.replace(/\.html?$/, '')).length : allReserves.length;
                            
                            if (count >= expected.validMinReserves) {
                                console.log(`   ✅ PASS: Found ${count} reserves for source "${sourceMatch || 'overall'}" (Expected min: ${expected.validMinReserves}).`);
                                passed++;
                            } else {
                                console.error(`   ❌ FAIL: Found only ${count} reserves for source "${sourceMatch || 'overall'}" (Expected min: ${expected.validMinReserves}).`);
                                failed++;
                            }
                            continue;
                        }

                        if (!expected.Name) {
                            console.warn(`   ⚠️ Invalid test case found (missing expectedReserve.Name or validMinReserves)`);
                            continue;
                        }

                        const found = allReserves.find(r => r.Name.toLowerCase() === expected.Name.toLowerCase());

                        if (!found) {
                            console.error(`   ❌ FAIL: Could not find reserve named "${expected.Name}"`);
                            failed++;
                            continue;
                        }

                        let match = true;
                        let errors = [];

                        for (let key in expected) {
                            if (key === 'Description') {
                                const cleanExpected = expected[key].replace(/\[.*?\]/g, '').replace(/\s*\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
                                const cleanFound = found[key] || '';
                                const matchLen = Math.min(25, cleanExpected.length);
                                if (!cleanFound.includes(cleanExpected.substring(0, matchLen)) && cleanFound !== cleanExpected) {
                                    match = false; errors.push(`Mismatched Description:\nExpected: ${cleanExpected}\nGot: ${cleanFound}`);
                                }
                            } else if (Array.isArray(expected[key])) {
                                if (JSON.stringify(found[key]) !== JSON.stringify(expected[key])) { match = false; errors.push(`Mismatched ${key}`); }
                            } else if (found[key] !== expected[key]) {
                                match = false; errors.push(`Mismatched ${key}: Expected ${expected[key]}, got ${found[key]}`);
                            }
                        }

                        if (match) { console.log(`   ✅ PASS: "${expected.Name}" successfully extracted and verified.`); passed++; } 
                        else { console.error(`   ❌ FAIL: Data mismatch for "${expected.Name}".`); errors.forEach(err => console.error(`       - ${err}`)); failed++; }
                    } 
                    else if (testCase.notExpectedReserves || testCase.notExptectedReserves) {
                        const notExpectedArray = testCase.notExpectedReserves || testCase.notExptectedReserves;
                        if (Array.isArray(notExpectedArray)) {
                            for (let badName of notExpectedArray) {
                                if (allReserves.find(r => r.Name.toLowerCase() === badName.toLowerCase())) {
                                    console.error(`   ❌ FAIL: Found reserve named "${badName}" but it was expected NOT to be scraped (Should have been filtered!).`);
                                    failed++;
                                } else {
                                    console.log(`   ✅ PASS: "${badName}" was correctly ignored/filtered.`);
                                    passed++;
                                }
                            }
                        }
                    }
                }

                console.log(`\n📊 Test Summary: ${passed} passed, ${failed} failed.`);
                if (failed > 0 && TEST_MODE_ONLY) { console.log(`🛑 Stopping execution due to test failures.`); process.exit(1); }

            } catch (err) { console.error(`   ❌ Error running tests: ${err.message}`); }
        }
    }

    if (!TEST_MODE_ONLY) {
        console.log(`\n🚀 Crawling the ${TRUST_WIKI_PAGES.length} explicitly verified UK Wildlife Trust pages...`);
        for (let i = 0; i < TRUST_WIKI_PAGES.length; i++) {
            console.log(`\n💼 [Trust ${i + 1}/${TRUST_WIKI_PAGES.length}]`);
            allReserves = allReserves.concat(await scrapeTrustPage(TRUST_WIKI_PAGES[i]));
            await sleep(500); 
        }
    } else {
        console.log(`\n⚠️ TEST_MODE_ONLY is set to true. Skipping the live UK index crawl.`);
    }

    const uniqueReserves = [];
    const seenNames = new Set();
    for (let res of allReserves) {
        const key = res.Name.toLowerCase().trim();
        if (!seenNames.has(key)) { 
            seenNames.add(key); 
            const toSave = { ...res };
            delete toSave.SourceFile;
            uniqueReserves.push(toSave); 
        }
    }

    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(uniqueReserves, null, 2));
    console.log(`\n🎉 Process Complete! Saved ${uniqueReserves.length} unique reserves to: ${OUTPUT_FILE}`);
}

main();