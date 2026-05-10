# openrct2-mcp

`openrct2-mcp` is an OpenRCT2 local plugin that exposes a small HTTP API. The project started as a single-file prototype and is now organized around reusable HTTP parsing, middleware-based routing, class-based controllers, and generated API documentation.

## Architecture

- `src/index.ts` boots the OpenRCT2 listener and forwards raw socket data into the application layer.
- `src/app.ts` composes middleware, decorator-registered controllers, automatic index routes, and generated documentation routes.
- `src/http/` contains the HTTP core:
  - `request.ts` parses raw HTTP requests into a structured request object with normalized paths, query parameters, and header lookup.
  - `response.ts` builds HTTP responses with status codes, headers, and body serialization. Controllers can use `response.headers` directly as an object.
  - `connection.ts` exposes a reusable socket takeover abstraction for long-lived transports when needed.
  - `router.ts` provides path-aware middleware registration plus method-specific route dispatch.
  - `openapi.ts` generates OpenAPI YAML from the registered routes.
- `src/controllers/` contains controller classes and decorators:
  - `decorators.ts` defines `@httpPath`, `@httpGet`, and the other HTTP method decorators.
  - `types.ts` provides the base `HttpController` class and the `{ request, response, params }` controller context object.
  - Each controller class declares its base path once and exposes one instance method per endpoint.
- `src/mcp.ts` implements a minimal MCP 2025-11-25 Streamable HTTP endpoint for initialization, ping, `tools/list`, and `tools/call`.
- `src/tools/` contains decorator-registered MCP tool classes that are exposed automatically by the MCP server.
- `test/` contains Node-based unit tests for the environment-agnostic application and HTTP modules.

## Request flow

1. OpenRCT2 accepts a TCP connection and passes the raw request text to the application.
2. The HTTP module parses the request line, headers, query string, and body.
3. Matching middleware runs for the request path.
4. The router creates a fresh controller instance for the request and dispatches to the decorated instance method for the HTTP method and path.
5. Controllers can use `this.request`, `this.response`, or the injected `{ request, response, params }` context object.
6. If a handler returns a plain object, the response is automatically serialized as JSON.
7. `POST /mcp` handles MCP JSON-RPC messages over Streamable HTTP and uses `MCP-Session-Id` to preserve initialization state across requests.
8. MCP tools are discovered from decorator-registered classes in `src/tools/`, with optional input and output schemas.
9. Every request is logged with `console.log` in the format `METHOD /path -- level`.

## Endpoints

- `GET /` returns the available API versions and documentation links.
- `GET /v1` returns an automatic index of registered v1 controllers.
- `GET /v1/date` returns the current in-game date values.
- `GET /v1/eval?q=...` preserves the prototype evaluation endpoint.
- `GET /v1/rides/:id` looks up a ride by URL parameter.
- `POST /mcp` implements a minimal MCP endpoint with `initialize`, `notifications/initialized`, `ping`, `tools/list`, and `tools/call`.
- `GET /openapi.yaml` returns generated OpenAPI YAML.
- `GET /swagger` returns a Swagger UI page backed by the generated OpenAPI YAML.

## Controller style

Controllers use an ASP.NET-style pattern where a controller-level path is combined with a method-level path:

```ts
@httpPath("/v1/date")
class DateController extends HttpController {
    @httpGet("/", {
        summary: "Get the current in-game date"
    })
    public getDate() {
        return {
            year: date.year
        };
    }
}
```

For each request, the router creates a new controller instance with:

```ts
{ request, response, params }
```

- `request.headers` is a header dictionary.
- `request.query` is a dictionary of query parameters.
- `params.id` contains the value extracted from `:id` in the path.
- `response.headers` can be assigned directly.
- Returning an object from the endpoint method sends that object as a JSON response.

## Development

Install dependencies:

```bash
npm install
```

Run the unit tests:

```bash
npm test
```

Build the plugin bundle:

```bash
npm run build
```
