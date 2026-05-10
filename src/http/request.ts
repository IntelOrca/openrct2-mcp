import type { HttpMethod, HttpRequest } from "./types.js";

function safeDecodeURIComponent(value: string): string {
    try {
        return decodeURIComponent(value);
    } catch (error) {
        return value;
    }
}

function normalizeMethod(method: string): HttpMethod {
    var normalized = method.toUpperCase();
    return normalized === "" ? "GET" : normalized;
}

export function parseQueryParameters(rawPath: string): Record<string, string> {
    var query: Record<string, string> = {};
    var index = rawPath.indexOf("?");
    var queryString: string;
    var parts: string[];
    var i: number;
    var pair: string[];
    var key: string;
    var value: string;

    if (index === -1) {
        return query;
    }

    queryString = rawPath.substring(index + 1);
    if (queryString === "") {
        return query;
    }

    parts = queryString.split("&");
    for (i = 0; i < parts.length; i++) {
        if (parts[i] === "") {
            continue;
        }

        pair = parts[i].split("=");
        key = safeDecodeURIComponent(pair[0] || "");
        value = safeDecodeURIComponent(pair.length > 1 ? pair.slice(1).join("=") : "");
        query[key] = value;
    }

    return query;
}

export function normalizePath(rawPath: string): string {
    var withoutQuery = rawPath.split("?")[0] || "/";
    var decoded = safeDecodeURIComponent(withoutQuery);
    var normalized = decoded.replace(/\/+$/, "");

    if (normalized === "") {
        return "/";
    }

    if (normalized.charAt(0) !== "/") {
        return "/" + normalized;
    }

    return normalized;
}

function parseHeaders(headerLines: string[]): Record<string, string> {
    var headers: Record<string, string> = {};
    var i: number;
    var line: string;
    var separatorIndex: number;
    var name: string;
    var value: string;

    for (i = 0; i < headerLines.length; i++) {
        line = headerLines[i];
        if (line === "") {
            continue;
        }

        separatorIndex = line.indexOf(":");
        if (separatorIndex === -1) {
            continue;
        }

        name = line.substring(0, separatorIndex).trim().toLowerCase();
        value = line.substring(separatorIndex + 1).trim();
        headers[name] = value;
    }

    return headers;
}

export function parseHttpRequest(rawRequest: string): HttpRequest {
    var sections = rawRequest.split("\r\n\r\n");
    var head = sections[0] || "";
    var body = sections.slice(1).join("\r\n\r\n");
    var lines = head.split("\r\n");
    var requestLine = lines.shift() || "";
    var parts = requestLine.split(" ");
    var method: HttpMethod;
    var rawPath: string;
    var headers: Record<string, string>;

    if (requestLine.trim() === "") {
        throw new Error("Invalid HTTP request line");
    }

    method = normalizeMethod(parts[0] || "GET");
    rawPath = parts[1] || "/";
    headers = parseHeaders(lines);

    return {
        method: method,
        rawPath: rawPath,
        path: normalizePath(rawPath),
        httpVersion: parts[2] || "HTTP/1.1",
        headers: headers,
        query: parseQueryParameters(rawPath),
        body: body,
        getHeader: function (name: string): string | undefined {
            return headers[name.toLowerCase()];
        }
    };
}
