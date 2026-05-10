// Parse query parameters from a raw path like "/v1/eval?q=1%2B1&x=2"
function getQueryParameters(rawPath: string) {
    var q: Record<string, string> = {};
    if (!rawPath) return q;
    var idx = rawPath.indexOf('?');
    if (idx === -1) return q;
    var qs = rawPath.substring(idx + 1);
    var parts = qs.split('&');
    for (var i = 0; i < parts.length; i++) {
        if (!parts[i]) continue;
        var kv = parts[i].split('=');
        var key = kv[0] ? kv[0] : '';
        var val = kv.length > 1 ? kv.slice(1).join('=') : '';
        try { key = decodeURIComponent(key); } catch (e) { /* leave as-is */ }
        try { val = decodeURIComponent(val); } catch (e) { /* leave as-is */ }
        q[key] = val;
    }
    return q;
}

function main() {
    console.log('Starting API server on port 8080');

    try {
        var server = network.createListener();
        server.on('connection', function (socket) {
            socket.setNoDelay(true);
            var responded = false;

            socket.on('data', function (data) {
                if (responded) return;
                responded = true;

                var reqText = (typeof data === 'string') ? data : String(data);
                var firstLine = (reqText.split('\r\n')[0] || '');
                var parts = firstLine.split(' ');
                var method = parts[0] || 'GET';
                var rawPath = parts[1] || '/';

                var queryParameters = getQueryParameters(rawPath);
                var decodedPath;
                try { decodedPath = decodeURIComponent(rawPath); } catch (e) { decodedPath = rawPath; }
                var path = decodedPath.split('?')[0];
                // Trim trailing slashes, but keep leading slash (so '/v1' stays '/v1', '/' becomes '')
                path = path.replace(/\/+$/, '');
                // If path was just '/', path becomes '' which matches earlier behaviour

                var status = 200;
                var respBody = '';

                if (method !== 'GET') {
                    status = 405;
                    respBody = JSON.stringify({ error: 'Method Not Allowed' });
                } else {
                    if (path === '') {
                        respBody = JSON.stringify({ versions: ['/v1'] });
                    } else if (path === '/v1') {
                        respBody = JSON.stringify({ date: '/date' });
                    } else if (path === '/v1/date' || path === '/v1/date/') {
                        var d = date;
                        respBody = JSON.stringify({
                            ticksElapsed: d.ticksElapsed,
                            monthsElapsed: d.monthsElapsed,
                            yearsElapsed: d.yearsElapsed,
                            monthProgress: d.monthProgress,
                            day: d.day,
                            month: d.month,
                            year: d.year
                        });
                    } else if (path === '/v1/eval' || path === '/v1/eval/') {
                        var q = queryParameters.q;
                        if (typeof q === 'undefined') {
                            status = 400;
                            respBody = JSON.stringify({ error: 'Missing q parameter' });
                        } else {
                            try {
                                var result = new Function(q)();
                                try {
                                    respBody = JSON.stringify({ result: result });
                                } catch (e) {
                                    respBody = JSON.stringify({ result: String(result) });
                                }
                            } catch (e) {
                                status = 400;
                                respBody = JSON.stringify({ error: String(e) });
                            }
                        }
                    } else {
                        status = 404;
                        respBody = JSON.stringify({ error: 'Not Found' });
                    }
                }

                var statusText = (status === 200) ? 'OK' : (status === 404 ? 'Not Found' : (status === 405 ? 'Method Not Allowed' : 'Error'));
                var resp = 'HTTP/1.1 ' + status + ' ' + statusText + '\r\n' +
                    'Content-Type: application/json; charset=utf-8\r\n' +
                    'Content-Length: ' + respBody.length + '\r\n' +
                    'Connection: close\r\n' +
                    '\r\n' +
                    respBody;

                try { socket.end(resp); } catch (e) { console.log('Socket end error: ' + e); }
            });

            socket.on('error', function (err) {
                console.log('Socket error: ' + err);
            });
        });

        server.listen(8080, '127.0.0.1');
        console.log('Server listening on 127.0.0.1:8080');
    } catch (e) {
        console.log('Failed to start server: ' + e);
    }
}

registerPlugin({
    name: 'mcp test api',
    version: '1.0',
    authors: ['IntelOrca'],
    type: 'local',
    licence: 'MIT',
    targetApiVersion: 66,
    main: main
});
