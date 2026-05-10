# openrct2-mcp

`openrct2-mcp` is an OpenRCT2 local plugin that exposes a small HTTP API. The project started as a single-file prototype and is now organized around reusable HTTP parsing, middleware-based routing, controller registration, and generated API documentation.

## Architecture

- `src/index.ts` boots the OpenRCT2 listener and forwards raw socket data into the application layer.
- `src/app.ts` composes middleware, controllers, automatic index routes, and generated documentation routes.
- `src/http/` contains the HTTP core:
  - `request.ts` parses raw HTTP requests into a structured request object with normalized paths, query parameters, and header lookup.
  - `response.ts` builds HTTP responses with status codes, headers, and body serialization.
  - `router.ts` provides path-aware middleware registration plus method-specific route dispatch.
  - `openapi.ts` generates OpenAPI YAML from the registered routes.
- `src/controllers/` contains controller definitions. Each controller can register one or more method-specific handlers.
- `test/` contains Node-based unit tests for the environment-agnostic application and HTTP modules.

## Request flow

1. OpenRCT2 accepts a TCP connection and passes the raw request text to the application.
2. The HTTP module parses the request line, headers, query string, and body.
3. Matching middleware runs for the request path.
4. The router dispatches the request to the registered controller handler for the HTTP method and path.
5. If a handler returns a plain object, the response is automatically serialized as JSON.
6. Every request is logged with `console.log` in the format `METHOD /path -- level`.

## Endpoints

- `GET /` returns the available API versions and documentation links.
- `GET /v1` returns an automatic index of registered v1 controllers.
- `GET /v1/date` returns the current in-game date values.
- `GET /v1/eval?q=...` preserves the prototype evaluation endpoint.
- `GET /openapi.yaml` returns generated OpenAPI YAML.
- `GET /swagger` returns a lightweight HTML page that displays the generated OpenAPI YAML.

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
