#!/usr/bin/env node
// Shared image picker server for all National Trust sources.
//
// Usage:
//   node picker-server.js --data ../national-trust-england/data/national-trust-properties.json
//   node picker-server.js --data ../national-trust-scotland/data/national-trust-properties.json --port 8767
//
// Then open http://localhost:<port> in a browser.
// Press 1–9 / 0 to pick an image, → or S to skip.

const http = require('http');
const fs   = require('fs');
const path = require('path');

// --- Parse CLI args ---
const args = process.argv.slice(2);
let dataFilePath = null;
let port = 8766;

for (let i = 0; i < args.length; i++) {
    if (args[i] === '--data' && args[i + 1]) { dataFilePath = path.resolve(args[++i]); }
    else if (args[i] === '--port' && args[i + 1]) { port = parseInt(args[++i], 10); }
    else if (!args[i].startsWith('--')) { dataFilePath = path.resolve(args[i]); }
}

if (!dataFilePath) {
    console.error('Usage: node picker-server.js --data <path-to-properties.json> [--port <n>]');
    console.error('');
    console.error('Examples:');
    console.error('  node picker-server.js --data ../national-trust-england/data/national-trust-properties.json');
    console.error('  node picker-server.js --data ../national-trust-scotland/data/national-trust-properties.json --port 8767');
    process.exit(1);
}

const HTML_FILE = path.resolve(__dirname, 'image-picker.html');

const server = http.createServer((req, res) => {
    // CORS for local dev
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

    if (req.url === '/api/data' && req.method === 'GET') {
        try {
            const data = fs.readFileSync(dataFilePath, 'utf8');
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(data);
        } catch (e) {
            res.writeHead(500); res.end(JSON.stringify({ error: e.message }));
        }
        return;
    }

    if (req.url === '/api/data' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                JSON.parse(body); // validate before writing
                fs.writeFileSync(dataFilePath, body, 'utf8');
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end('{"ok":true}');
            } catch (e) {
                res.writeHead(400); res.end(JSON.stringify({ error: e.message }));
            }
        });
        return;
    }

    if (req.url === '/' || req.url === '/image-picker.html') {
        try {
            const html = fs.readFileSync(HTML_FILE, 'utf8');
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(html);
        } catch (e) {
            res.writeHead(500); res.end('Could not read image-picker.html');
        }
        return;
    }

    res.writeHead(404); res.end('Not found');
});

server.listen(port, () => {
    console.log(`🖼️  Image picker server running at http://localhost:${port}`);
    console.log(`📂 Data file: ${dataFilePath}`);
    console.log('');
    console.log('Open the URL above in your browser.');
    console.log('Press 1–9 (or 0 for 10th) to pick an image · → or S to skip');
});
