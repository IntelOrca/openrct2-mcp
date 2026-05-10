import { createApplication } from "./app.js";
import { HttpResponse } from "./http/response.js";

function createInternalServerErrorResponse(error: unknown): HttpResponse {
    console.log("Request handling error: " + error);
    return new HttpResponse().setJson({
        error: String(error)
    }, 500);
}

function main() {
    var app = createApplication();

    console.log('Starting API server on port 8080');

    try {
        var server = network.createListener();
        server.on('connection', function (socket) {
            socket.setNoDelay(true);
            var responded = false;

            socket.on('data', function (data) {
                var response: HttpResponse;

                if (responded) return;
                responded = true;

                try {
                    response = app.handleRawRequest((typeof data === 'string') ? data : String(data));
                } catch (error) {
                    response = createInternalServerErrorResponse(error);
                }

                try { socket.end(response.toHttpString()); } catch (e) { console.log('Socket end error: ' + e); }
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
