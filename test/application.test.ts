import assert from "node:assert/strict";
import test from "node:test";

import { createApplication } from "../src/app.ts";
import { httpGet, httpPath } from "../src/controllers/decorators.ts";
import { registerControllers } from "../src/controllers/index.ts";
import { HttpController, type ControllerContext } from "../src/controllers/types.ts";
import { parseHttpRequest } from "../src/http/request.ts";
import { HttpRouter } from "../src/http/router.ts";

function parseJsonBody(response: { getBody(): string }): unknown {
    return JSON.parse(response.getBody());
}

let testControllerInstanceCount = 0;

class TestController extends HttpController {
    private readonly instanceId: number;

    public constructor(context: ControllerContext) {
        super(context);
        this.instanceId = testControllerInstanceCount + 1;
        testControllerInstanceCount = this.instanceId;
        this.response.headers["X-Constructed"] = "yes";
        if (typeof context.params.id !== "undefined") {
            this.response.headers["X-Constructed-Id"] = context.params.id;
        }
    }

    public echo(context: ControllerContext) {
        context.response.headers["X-Instance-Id"] = String(this.instanceId);
        return {
            customHeader: this.request.headers["x-custom"],
            queryValue: context.request.query.name,
            instanceId: this.instanceId
        };
    }

    public lookup({ request, response, params }: ControllerContext) {
        response.headers["X-Instance-Id"] = String(this.instanceId);
        return {
            customHeader: request.headers["x-custom"],
            queryValue: request.query.name,
            paramId: params.id,
            requestParamId: request.params.id,
            instanceId: this.instanceId
        };
    }
}

httpPath("/v1/test")(TestController);
httpGet("/echo", {
    summary: "Echo request data",
    description: "Returns request header, query, and instance information.",
    responseDescription: "Echo response"
})(
    TestController.prototype,
    "echo",
    Object.getOwnPropertyDescriptor(TestController.prototype, "echo")
);
httpGet("/items/:id", {
    summary: "Lookup a param by id",
    description: "Returns the extracted URL parameter.",
    responseDescription: "Param lookup"
})(
    TestController.prototype,
    "lookup",
    Object.getOwnPropertyDescriptor(TestController.prototype, "lookup")
);

test("parseHttpRequest parses method, headers, query parameters, and body", function () {
    const request = parseHttpRequest(
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
    const router = new HttpRouter();

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

    const response = router.handleRawRequest("GET /v1/ping HTTP/1.1\r\nX-Custom: abc\r\n\r\n");

    assert.equal(response.statusCode, 200);
    assert.equal(response.getHeader("x-trace"), "enabled");
    assert.deepEqual(parseJsonBody(response), { ok: true });
});

test("HttpRouter returns 405 and Allow when a path exists for another method", function () {
    const router = new HttpRouter();

    router.registerRoute({
        method: "GET",
        path: "/v1/resource",
        operationId: "getResource",
        summary: "Get a resource",
        handler: function () {
            return { ok: true };
        }
    });

    const response = router.handleRawRequest("POST /v1/resource HTTP/1.1\r\n\r\n");

    assert.equal(response.statusCode, 405);
    assert.equal(response.getHeader("allow"), "GET");
    assert.deepEqual(parseJsonBody(response), { error: "Method Not Allowed" });
});

test("registerControllers uses decorated controller classes and creates a new instance per request", function () {
    testControllerInstanceCount = 0;
    const router = new HttpRouter();
    const controllers = registerControllers(router, [TestController]);
    const firstResponse = router.handleRawRequest("GET /v1/test/echo?name=alpha HTTP/1.1\r\nX-Custom: abc\r\n\r\n");
    const secondResponse = router.handleRawRequest("GET /v1/test/echo?name=beta HTTP/1.1\r\nX-Custom: def\r\n\r\n");
    const paramResponse = router.handleRawRequest("GET /v1/test/items/21?name=gamma HTTP/1.1\r\nX-Custom: ghi\r\n\r\n");

    assert.equal(controllers[0].basePath, "/v1/test");
    assert.equal(controllers[0].routes[0].fullPath, "/v1/test/echo");
    assert.equal(controllers[0].routes[1].fullPath, "/v1/test/items/:id");
    assert.equal(firstResponse.getHeader("x-constructed"), "yes");
    assert.equal(firstResponse.getHeader("x-instance-id"), "1");
    assert.equal(secondResponse.getHeader("x-instance-id"), "2");
    assert.equal(paramResponse.getHeader("x-constructed"), "yes");
    assert.equal(paramResponse.getHeader("x-constructed-id"), "21");
    assert.equal(paramResponse.getHeader("x-instance-id"), "3");
    assert.deepEqual(parseJsonBody(firstResponse), {
        customHeader: "abc",
        queryValue: "alpha",
        instanceId: 1
    });
    assert.deepEqual(parseJsonBody(secondResponse), {
        customHeader: "def",
        queryValue: "beta",
        instanceId: 2
    });
    assert.deepEqual(parseJsonBody(paramResponse), {
        customHeader: "ghi",
        queryValue: "gamma",
        paramId: "21",
        requestParamId: "21",
        instanceId: 3
    });
});

test("createApplication provides the automatic /v1 index and date controller response", function () {
    const originalDate = (globalThis as typeof globalThis & { date?: unknown }).date;
    const originalMap = (globalThis as typeof globalThis & { map?: unknown }).map;
    (globalThis as typeof globalThis & { date?: unknown }).date = {
        ticksElapsed: 123,
        monthsElapsed: 4,
        yearsElapsed: 5,
        monthProgress: 6,
        day: 7,
        month: 8,
        year: 9
    };
    (globalThis as typeof globalThis & { map?: unknown }).map = {
        rides: [{}, {}],
        getRide: function (index: number) {
            if (index === 0) {
                return {
                    object: { identifier: "ride-1" },
                    id: 10,
                    type: "thrill",
                    classification: "coaster",
                    name: "Spiral",
                    status: "open",
                    price: 3.5
                };
            }

            if (index === 1) {
                return {
                    object: { identifier: "ride-21" },
                    id: 21,
                    type: "gentle",
                    classification: "family",
                    name: "Carousel",
                    status: "open",
                    price: 2.5
                };
            }

            return undefined;
        }
    };

    try {
        const app = createApplication();
        const indexResponse = app.handleRawRequest("GET /v1 HTTP/1.1\r\n\r\n");
        const dateResponse = app.handleRawRequest("GET /v1/date HTTP/1.1\r\n\r\n");

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
                },
                {
                    name: "rides",
                    path: "/v1/rides",
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
        const ridesResponse = app.handleRawRequest("GET /v1/rides/21 HTTP/1.1\r\n\r\n");
        assert.deepEqual(parseJsonBody(ridesResponse), {
            object: "ride-21",
            id: 21,
            type: "gentle",
            classification: "family",
            name: "Carousel",
            status: "open",
            price: 2.5
        });
    } finally {
        (globalThis as typeof globalThis & { date?: unknown }).date = originalDate;
        (globalThis as typeof globalThis & { map?: unknown }).map = originalMap;
    }
});

test("createApplication preserves the /v1/eval controller", function () {
    const app = createApplication();
    const evalResponse = app.handleRawRequest("GET /v1/eval?q=1%2B1 HTTP/1.1\r\n\r\n");
    const missingQueryResponse = app.handleRawRequest("GET /v1/eval HTTP/1.1\r\n\r\n");

    assert.equal(evalResponse.getHeader("x-eval-endpoint"), "true");
    assert.deepEqual(parseJsonBody(evalResponse), {
        result: 2
    });
    assert.equal(missingQueryResponse.statusCode, 400);
    assert.deepEqual(parseJsonBody(missingQueryResponse), {
        error: "Missing q parameter"
    });
});

test("createApplication supports parameterized routes in OpenAPI output", function () {
    const app = createApplication();

    assert.match(app.getOpenApiYaml(), /"\/v1\/rides\/\{id\}":/);
    assert.match(app.getOpenApiYaml(), /name: "id"/);
});

test("createApplication exposes generated OpenAPI YAML and the /swagger page", function () {
    const app = createApplication();
    const openApiResponse = app.handleRawRequest("GET /openapi.yaml HTTP/1.1\r\n\r\n");
    const swaggerResponse = app.handleRawRequest("GET /swagger HTTP/1.1\r\n\r\n");

    assert.match(app.getOpenApiYaml(), /"\/v1\/date":/);
    assert.match(app.getOpenApiYaml(), /"\/v1\/eval":/);
    assert.match(openApiResponse.getBody(), /openapi: 3.1.0/);
    assert.equal(openApiResponse.getHeader("content-type"), "application/yaml; charset=utf-8");
    assert.equal(swaggerResponse.getHeader("content-type"), "text/html; charset=utf-8");
    assert.match(swaggerResponse.getBody(), /SwaggerUIBundle/);
    assert.match(swaggerResponse.getBody(), /\/openapi\.yaml/);
});

test("createApplication logs each request", function () {
    const app = createApplication();
    const originalLog = console.log;
    const messages: string[] = [];

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
