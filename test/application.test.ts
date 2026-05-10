import assert from "node:assert/strict";
import test from "node:test";

import { createApplication } from "../src/app.ts";
import { parseHttpRequest } from "../src/http/request.ts";
import { HttpRouter } from "../src/http/router.ts";

function parseJsonBody(response: { getBody(): string }): unknown {
    return JSON.parse(response.getBody());
}

test("parseHttpRequest parses method, headers, query parameters, and body", function () {
    var request = parseHttpRequest(
        "POST /v1/date?format=json HTTP/1.1\r\nHost: localhost\r\nContent-Type: application/json\r\nX-Test: hello\r\n\r\n{\"ok\":true}"
    );

    assert.equal(request.method, "POST");
    assert.equal(request.path, "/v1/date");
    assert.equal(request.query.format, "json");
    assert.equal(request.headers["x-test"], "hello");
    assert.equal(request.getHeader("content-type"), "application/json");
    assert.equal(request.body, "{\"ok\":true}");
});

test("HttpRouter applies path middleware and serializes object results", function () {
    var router = new HttpRouter();

    router.use("/v1", function (_request, response, next) {
        response.setHeader("X-Trace", "enabled");
        return next();
    });

    router.registerRoute({
        method: "GET",
        path: "/v1/ping",
        operationId: "getPing",
        summary: "Ping the API",
        handler: function (request) {
            assert.equal(request.headers["x-custom"], "abc");
            return { ok: true };
        }
    });

    var response = router.handleRawRequest("GET /v1/ping HTTP/1.1\r\nX-Custom: abc\r\n\r\n");

    assert.equal(response.statusCode, 200);
    assert.equal(response.getHeader("x-trace"), "enabled");
    assert.deepEqual(parseJsonBody(response), { ok: true });
});

test("HttpRouter returns 405 and Allow when a path exists for another method", function () {
    var router = new HttpRouter();

    router.registerRoute({
        method: "GET",
        path: "/v1/resource",
        operationId: "getResource",
        summary: "Get a resource",
        handler: function () {
            return { ok: true };
        }
    });

    var response = router.handleRawRequest("POST /v1/resource HTTP/1.1\r\n\r\n");

    assert.equal(response.statusCode, 405);
    assert.equal(response.getHeader("allow"), "GET");
    assert.deepEqual(parseJsonBody(response), { error: "Method Not Allowed" });
});

test("createApplication provides the automatic /v1 index and date controller response", function () {
    var originalDate = (globalThis as typeof globalThis & { date?: unknown }).date;
    (globalThis as typeof globalThis & { date?: unknown }).date = {
        ticksElapsed: 123,
        monthsElapsed: 4,
        yearsElapsed: 5,
        monthProgress: 6,
        day: 7,
        month: 8,
        year: 9
    };

    try {
        var app = createApplication();
        var indexResponse = app.handleRawRequest("GET /v1 HTTP/1.1\r\n\r\n");
        var dateResponse = app.handleRawRequest("GET /v1/date HTTP/1.1\r\n\r\n");

        assert.deepEqual(parseJsonBody(indexResponse), {
            controllers: [
                {
                    name: "date",
                    path: "/v1/date",
                    methods: ["GET"]
                },
                {
                    name: "eval",
                    path: "/v1/eval",
                    methods: ["GET"]
                }
            ]
        });
        assert.deepEqual(parseJsonBody(dateResponse), {
            ticksElapsed: 123,
            monthsElapsed: 4,
            yearsElapsed: 5,
            monthProgress: 6,
            day: 7,
            month: 8,
            year: 9
        });
    } finally {
        (globalThis as typeof globalThis & { date?: unknown }).date = originalDate;
    }
});

test("createApplication preserves the /v1/eval controller", function () {
    var app = createApplication();
    var evalResponse = app.handleRawRequest("GET /v1/eval?q=1%2B1 HTTP/1.1\r\n\r\n");
    var missingQueryResponse = app.handleRawRequest("GET /v1/eval HTTP/1.1\r\n\r\n");

    assert.deepEqual(parseJsonBody(evalResponse), {
        result: 2
    });
    assert.equal(missingQueryResponse.statusCode, 400);
    assert.deepEqual(parseJsonBody(missingQueryResponse), {
        error: "Missing q parameter"
    });
});

test("createApplication exposes generated OpenAPI YAML and the /swagger page", function () {
    var app = createApplication();
    var openApiResponse = app.handleRawRequest("GET /openapi.yaml HTTP/1.1\r\n\r\n");
    var swaggerResponse = app.handleRawRequest("GET /swagger HTTP/1.1\r\n\r\n");

    assert.match(app.getOpenApiYaml(), /"\/v1\/date":/);
    assert.match(openApiResponse.getBody(), /openapi: 3.1.0/);
    assert.equal(openApiResponse.getHeader("content-type"), "application/yaml; charset=utf-8");
    assert.equal(swaggerResponse.getHeader("content-type"), "text/html; charset=utf-8");
    assert.match(swaggerResponse.getBody(), /Generated OpenAPI YAML/);
    assert.match(swaggerResponse.getBody(), /\/openapi\.yaml/);
});

test("createApplication logs each request", function () {
    var app = createApplication();
    var originalLog = console.log;
    var messages: string[] = [];

    console.log = function (message?: unknown): void {
        messages.push(String(message));
    };

    try {
        app.handleRawRequest("GET /v1 HTTP/1.1\r\n\r\n");
    } finally {
        console.log = originalLog;
    }

    assert.equal(messages[messages.length - 1], "GET /v1 -- info");
});
