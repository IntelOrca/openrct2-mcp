import { createApplication } from "./app.js";
import { HttpResponse } from "./http/response.js";

class ApiApplication {
    run(host: string, port: number) {
        const app = createApplication();
        console.log(`Starting API server on ${host}:${port}`);
        try {
            const server = network.createListener();
            server.on('connection', (socket) => {
                socket.setNoDelay(true);
                let responded = false;

                socket.on('data', (data) => {
                    if (responded) return;
                    responded = true;

                    try {
                        const result = app.handleSocketRequest((typeof data === 'string') ? data : String(data), socket);

                        if (!result.context.connection.hijacked) {
                            socket.end(result.response.toHttpString());
                        }
                    } catch (error) {
                        const response = this.createInternalServerErrorResponse(error);
                        try { socket.end(response.toHttpString()); } catch (e) { console.log('Socket end error: ' + e); }
                    }
                });

                socket.on('error', function (err) {
                    console.log('Socket error: ' + err);
                });
            });
            server.listen(port, host);
            console.log(`Server listening on ${host}:${port}`);
        } catch (e) {
            console.log('Failed to start server: ' + e);
        }
    }

    private createInternalServerErrorResponse(error: unknown): HttpResponse {
        console.log("Request handling error: " + error);
        return new HttpResponse().setJson({
            error: String(error)
        }, 500);
    }
}

function main() {
    const apiApp = new ApiApplication();
    apiApp.run("127.0.0.1", 8080);
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
