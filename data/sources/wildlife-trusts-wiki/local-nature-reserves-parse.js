const fs = require('fs');
const path = require('path');

// --- CONFIGURATION ---
const INPUT_GEOJSON = path.join(process.cwd(), 'Local_Nature_Reserves_England_-3356783718690584235.geojson');
const OUTPUT_STUBS = path.join(process.cwd(), 'data', 'lnr-stubs.json');

/**
 * Robustly converts an all-caps name into Standard Proper/Title Case.
 * Automatically handles words inside parentheses, skips minor conjunctions/prepositions, 
 * and preserves proper capitalization for statutory designations like LNR/NNR/SSSI.
 */
function toTitleCase(str) {
    if (!str) return "";
    
    // Normalize spaces and convert to lowercase
    str = str.replace(/\s+/g, ' ').trim();
    const minorWords = new Set(["and", "or", "but", "the", "a", "an", "in", "on", "at", "to", "for", "of"]);
    const words = str.toLowerCase().split(' ');
    
    const casedWords = words.map((word, index) => {
        // Skip minor joining words unless they are the first or last word
        if (minorWords.has(word) && index !== 0 && index !== words.length - 1) {
            return word;
        }
        // Capitalize the first alphabetical character in the word (handles parentheses cleanly)
        return word.replace(/[a-z]/, char => char.toUpperCase());
    });

    return casedWords.join(' ')
        .replace(/\bLnr\b/g, 'LNR')
        .replace(/\bNnr\b/g, 'NNR')
        .replace(/\bSssi\b/g, 'SSSI');
}

/**
 * Programmatically calculates the geographical centroid (center of gravity)
 * of a GeoJSON Geometry (handling both Point, Polygon, and MultiPolygon structures).
 */
function calculateCentroid(geometry) {
    if (!geometry || !geometry.coordinates) return null;

    let sumLat = 0;
    let sumLon = 0;
    let totalPoints = 0;

    const addPoints = (points) => {
        for (let pt of points) {
            if (Array.isArray(pt) && typeof pt[0] === 'number' && typeof pt[1] === 'number') {
                sumLon += pt[0];
                sumLat += pt[1];
                totalPoints++;
            }
        }
    };

    if (geometry.type === 'Point') {
        return { lat: geometry.coordinates[1], lon: geometry.coordinates[0] };
    }

    if (geometry.type === 'Polygon') {
        // Average coordinates of the outer ring boundary
        addPoints(geometry.coordinates[0]);
    } else if (geometry.type === 'MultiPolygon') {
        // Average coordinates across outer rings of all polygon sections
        for (let polygon of geometry.coordinates) {
            addPoints(polygon[0]);
        }
    } else if (geometry.type === 'LineString' || geometry.type === 'MultiPoint') {
        addPoints(geometry.coordinates);
    }

    if (totalPoints > 0) {
        return {
            lat: parseFloat((sumLat / totalPoints).toFixed(6)),
            lon: parseFloat((sumLon / totalPoints).toFixed(6))
        };
    }

    return null;
}

function main() {
    console.log(`⏳ Reading GeoJSON file from: ${INPUT_GEOJSON}...`);

    if (!fs.existsSync(INPUT_GEOJSON)) {
        console.error(`❌ Error: Input GeoJSON file not found at path: ${INPUT_GEOJSON}`);
        console.log(`Please place the uploaded GeoJSON file in your root folder or adjust INPUT_GEOJSON config.`);
        return;
    }

    let geojson;
    try {
        const rawContent = fs.readFileSync(INPUT_GEOJSON, 'utf8');
        geojson = JSON.parse(rawContent);
    } catch (err) {
        console.error("❌ Error parsing the GeoJSON file structure:", err.message);
        return;
    }

    if (!geojson.features || !Array.isArray(geojson.features)) {
        console.error("❌ Invalid GeoJSON structure: Could not find 'features' array.");
        return;
    }

    console.log(`✅ Loaded ${geojson.features.length} features. Converting to stubs structure...`);

    const outputRecords = [];
    let centroidFailures = 0;

    for (let feature of geojson.features) {
        const props = feature.properties || {};
        const centroid = calculateCentroid(feature.geometry);

        if (!centroid) {
            centroidFailures++;
            continue; // Skip features where coordinates cannot be resolved
        }

        const name = props.NAME || props.LABEL || "Unnamed Local Nature Reserve";
        
        // Formulate Description text focusing strictly on standard size and structure to the nearest hectare
        let descriptionText = "A local nature reserve.";
        let numericArea = null;

        if (props.MEASURE) {
            const rawHectares = parseFloat(props.MEASURE);
            if (!isNaN(rawHectares)) {
                numericArea = parseFloat(rawHectares.toFixed(4)); // Keeps up to 4 decimal places for high precision
                const roundedHectares = Math.round(rawHectares);
                
                if (roundedHectares === 0) {
                    descriptionText = "A local nature reserve of less than 1 hectare.";
                } else if (roundedHectares === 1) {
                    descriptionText = "A local nature reserve of approximately 1 hectare.";
                } else {
                    descriptionText = `A local nature reserve of approximately ${roundedHectares} hectares.`;
                }
            }
        }

        // Construct cleaned, simplified baseline records to prevent Airtable formatting issues
        const stubRecord = {
            Name: toTitleCase(name),
            Lat: centroid.lat,
            Long: centroid.lon,
            Area: numericArea, // Store the numerical area value in hectares
            Description: descriptionText,
            "Suggestion-Tags": ["Baseline statutory LNR"],
            "AI-Notes": `[GIS Imported]: This record was programmatically created from the official Natural England Local Nature Reserves spatial database. Centroid coordinate computed directly from the source polygon bounds (ID: ${props.REF_CODE || 'N/A'}).`
        };

        outputRecords.push(stubRecord);
    }

    // Ensure target folder exists
    const outputDir = path.dirname(OUTPUT_STUBS);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    // Save output JSON
    fs.writeFileSync(OUTPUT_STUBS, JSON.stringify(outputRecords, null, 2));

    console.log(`\n🎉 Conversion complete!`);
    console.log(`💾 Saved ${outputRecords.length} records to: ${OUTPUT_STUBS}`);
    if (centroidFailures > 0) {
        console.log(`⚠️ Skipped ${centroidFailures} features due to missing or unparsable geometry coordinate bounds.`);
    }
}

main();