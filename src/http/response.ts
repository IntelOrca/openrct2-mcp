function getUtf8ByteLength(value: string): number {
    return unescape(encodeURIComponent(value)).length;
}

function getStatusText(statusCode: number): string {
    switch (statusCode) {
        case 200:
            return "OK";
        case 201:
            return "Created";
        case 204:
            return "No Content";
        case 400:
            return "Bad Request";
        case 404:
            return "Not Found";
        case 405:
            return "Method Not Allowed";
        case 500:
            return "Internal Server Error";
        default:
            return "OK";
    }
}

function formatHeaderName(name: string): string {
    return name.replace(/(^|-)([a-z])/g, function (_match: string, prefix: string, letter: string) {
        return prefix + letter.toUpperCase();
    });
}

export class HttpResponse {
    public statusCode: number;
    private readonly headers: Record<string, string>;
    private body: string;

    public constructor() {
        this.statusCode = 200;
        this.headers = {};
        this.body = "";
    }

    public setStatus(statusCode: number): HttpResponse {
        this.statusCode = statusCode;
        return this;
    }

    public setHeader(name: string, value: string): HttpResponse {
        this.headers[name.toLowerCase()] = value;
        return this;
    }

    public getHeader(name: string): string | undefined {
        return this.headers[name.toLowerCase()];
    }

    public getHeaders(): Record<string, string> {
        return this.headers;
    }

    public getBody(): string {
        return this.body;
    }

    public setBody(body: string, contentType?: string): HttpResponse {
        this.body = body;
        if (typeof contentType !== "undefined") {
            this.setHeader("Content-Type", contentType);
        }
        return this;
    }

    public setJson(payload: unknown, statusCode?: number): HttpResponse {
        if (typeof statusCode !== "undefined") {
            this.setStatus(statusCode);
        }

        return this.setBody(JSON.stringify(payload), "application/json; charset=utf-8");
    }

    public setText(body: string, statusCode?: number, contentType?: string): HttpResponse {
        if (typeof statusCode !== "undefined") {
            this.setStatus(statusCode);
        }

        return this.setBody(body, contentType || "text/plain; charset=utf-8");
    }

    public toHttpString(): string {
        var headerNames = Object.keys(this.headers);
        var responseLines = [
            "HTTP/1.1 " + this.statusCode + " " + getStatusText(this.statusCode)
        ];
        var i: number;
        var headerName: string;

        if (typeof this.getHeader("connection") === "undefined") {
            this.setHeader("Connection", "close");
        }

        if (typeof this.getHeader("content-length") === "undefined") {
            this.setHeader("Content-Length", String(getUtf8ByteLength(this.body)));
        }

        headerNames = Object.keys(this.headers);
        for (i = 0; i < headerNames.length; i++) {
            headerName = headerNames[i];
            responseLines.push(formatHeaderName(headerName) + ": " + this.headers[headerName]);
        }

        responseLines.push("");
        responseLines.push(this.body);

        return responseLines.join("\r\n");
    }
}
