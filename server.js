const http = require('http');

const PORT = 8080;
const LM_STUDIO_URL = 'http://127.0.0.1:1234';

// Read static files
const fs = require('fs');
const path = require('path');

const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
};

const server = http.createServer(async (req, res) => {
    // Add CORS headers to all responses
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // Proxy API requests to LM Studio
    if (req.url.startsWith('/v1/') || req.url.startsWith('/api/')) {
        const targetUrl = LM_STUDIO_URL + req.url;

        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            const options = {
                method: req.method,
                headers: {
                    'Content-Type': 'application/json',
                }
            };

            const proxyReq = http.request(targetUrl, options, (proxyRes) => {
                res.writeHead(proxyRes.statusCode, {
                    'Content-Type': proxyRes.headers['content-type'] || 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Transfer-Encoding': proxyRes.headers['transfer-encoding'] || 'identity'
                });
                proxyRes.pipe(res);
            });

            proxyReq.on('error', (err) => {
                console.error('Proxy error:', err.message);
                res.writeHead(502);
                res.end(JSON.stringify({
                    error: 'LM Studio is not responding',
                    message: 'Make sure LM Studio is running on port 1234 with CORS enabled'
                }));
            });

            if (body) {
                proxyReq.write(body);
            }
            proxyReq.end();
        });
        return;
    }

    // Serve static files
    let filePath = req.url === '/' ? '/index.html' : req.url;
    filePath = path.join(__dirname, filePath);

    const ext = path.extname(filePath);
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    try {
        const data = fs.readFileSync(filePath);
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
    } catch (err) {
        res.writeHead(404);
        res.end('File not found');
    }
});

server.listen(PORT, () => {
    console.log(`\n🚀 Server running at http://localhost:${PORT}`);
    console.log(`📡 Proxying API requests to ${LM_STUDIO_URL}`);
    console.log('\nOpen http://localhost:3000 in your browser\n');
});
