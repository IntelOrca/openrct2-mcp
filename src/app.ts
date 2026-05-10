import type { ControllerDefinition } from "./controllers/index.js";
import { getControllers, registerControllers } from "./controllers/index.js";
import { generateOpenApiYaml } from "./http/openapi.js";
import { HttpRouter } from "./http/router.js";
import type { Middleware } from "./http/types.js";

function getControllerMethods(controller: ControllerDefinition): string[] {
    const seen: Record<string, boolean> = {};
    const methods: string[] = [];

    controller.routes.forEach(function (route) {
        if (!seen[route.method]) {
            seen[route.method] = true;
            methods.push(route.method);
        }
    });

    return methods.sort();
}

function createVersionIndex(controllers: ControllerDefinition[]): Record<string, unknown> {
    const sortedControllers = controllers.slice(0).sort(function (left, right) {
        if (left.name < right.name) {
            return -1;
        }
        if (left.name > right.name) {
            return 1;
        }
        return 0;
    });

    return {
        controllers: sortedControllers.map(function (controller) {
            return {
                name: controller.name,
                path: controller.basePath,
                methods: getControllerMethods(controller)
            };
        })
    };
}

function createSwaggerPage(): string {
    return `
        <!doctype html>
        <html lang="en">
        <head>
          <meta charset="utf-8">
          <title>API docs</title>
          <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist/swagger-ui.css">
        </head>
        <body>
          <div id="swagger"></div>
          <script src="https://unpkg.com/swagger-ui-dist/swagger-ui-bundle.js"></script>
          <script>
            SwaggerUIBundle({
              url: "/openapi.yaml",
              dom_id: "#swagger"
            });
          </script>
        </body>
        </html>
    `;
}

function createRequestLogger(): Middleware {
    return function (request, response, next) {
        const result = next();
        const level = response.statusCode >= 500 ? "error" : (response.statusCode >= 400 ? "warn" : "info");

        console.log(request.method + " " + request.path + " -- " + level);
        return result;
    };
}

export interface Application {
    handleRawRequest(rawRequest: string): ReturnType<HttpRouter["handleRawRequest"]>;
    getOpenApiYaml(): string;
}

export function createApplication(): Application {
    const router = new HttpRouter();
    const controllers = registerControllers(router, getControllers());

    router.use("/", createRequestLogger());

    router.registerRoute({
        method: "GET",
        path: "/",
        operationId: "getApiVersions",
        summary: "List available API versions",
        description: "Returns the available API versions and documentation endpoints.",
        responseDescription: "Available API versions",
        handler: function () {
            return {
                versions: [
                    {
                        version: "v1",
                        path: "/v1"
                    }
                ],
                documentation: {
                    openApi: "/openapi.yaml",
                    swagger: "/swagger"
                }
            };
        }
    });

    router.registerRoute({
        method: "GET",
        path: "/v1",
        operationId: "getV1Index",
        summary: "List v1 controllers",
        description: "Returns the registered v1 controllers and their supported methods.",
        responseDescription: "Registered v1 controllers",
        handler: function () {
            return createVersionIndex(controllers);
        }
    });

    router.registerRoute({
        method: "GET",
        path: "/openapi.yaml",
        operationId: "getOpenApiYaml",
        summary: "Get the generated OpenAPI YAML",
        hideFromOpenApi: true,
        handler: function (_request, response) {
            return response.setText(
                generateOpenApiYaml("mcp test api", "1.0.0", router.getRoutes()),
                200,
                "application/yaml; charset=utf-8"
            );
        }
    });

    router.registerRoute({
        method: "GET",
        path: "/swagger",
        operationId: "getSwaggerPage",
        summary: "Get the generated Swagger page",
        hideFromOpenApi: true,
        handler: function (_request, response) {
            return response.setText(
                createSwaggerPage(),
                200,
                "text/html; charset=utf-8"
            );
        }
    });

    return {
        handleRawRequest: function (rawRequest) {
            return router.handleRawRequest(rawRequest);
        },
        getOpenApiYaml: function () {
            return generateOpenApiYaml("mcp test api", "1.0.0", router.getRoutes());
        }
    };
}
