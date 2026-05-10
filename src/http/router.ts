import { parseHttpRequest } from "./request.js";
import { matchRoutePath, normalizeRoutePath, pathMatchesPrefix } from "./path.js";
import { HttpResponse } from "./response.js";
import type { HandlerResult, HttpMethod, HttpRequest, Middleware, RouteDefinition } from "./types.js";

interface RegisteredMiddleware {
    path: string;
    handler: Middleware;
}

interface MatchedRoute {
    route: RouteDefinition;
    params: Record<string, string>;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value) && !(value instanceof HttpResponse);
}

function applyHandlerResult(response: HttpResponse, result: HandlerResult): void {
    if (typeof result === "undefined" || result instanceof HttpResponse) {
        return;
    }

    if (typeof result === "string") {
        response.setText(result);
        return;
    }

    if (typeof result === "number" || typeof result === "boolean" || result === null || Array.isArray(result) || isPlainObject(result)) {
        response.setJson(result);
    }
}

export class HttpRouter {
    private readonly middlewares: RegisteredMiddleware[];
    private readonly routes: RouteDefinition[];

    public constructor() {
        this.middlewares = [];
        this.routes = [];
    }

    public use(path: string | Middleware, handler?: Middleware): HttpRouter {
        if (typeof path === "function") {
            this.middlewares.push({
                path: "/",
                handler: path
            });
            return this;
        }

        if (typeof handler === "undefined") {
            throw new Error("Middleware handler is required when registering by path");
        }

        this.middlewares.push({
            path: normalizeRoutePath(path),
            handler: handler
        });
        return this;
    }

    public registerRoute(route: RouteDefinition): HttpRouter {
        this.routes.push({
            method: route.method,
            path: normalizeRoutePath(route.path),
            operationId: route.operationId,
            summary: route.summary,
            description: route.description,
            tags: route.tags,
            responseDescription: route.responseDescription,
            hideFromOpenApi: route.hideFromOpenApi,
            controllerName: route.controllerName,
            handler: route.handler
        });
        return this;
    }

    public getRoutes(): RouteDefinition[] {
        return this.routes.slice(0);
    }

    public handleRawRequest(rawRequest: string): HttpResponse {
        let request: HttpRequest;

        try {
            request = parseHttpRequest(rawRequest);
        } catch (error) {
            return new HttpResponse().setJson({
                error: String(error)
            }, 400);
        }

        return this.handleRequest(request);
    }

    public handleRequest(request: HttpRequest): HttpResponse {
        const response = new HttpResponse();
        const routeMatch = this.findRoute(request.method, request.path);
        const allowedMethods = this.findAllowedMethods(request.path);
        const stack: Middleware[] = [];

        for (const middleware of this.middlewares) {
            if (pathMatchesPrefix(request.path, middleware.path)) {
                stack.push(middleware.handler);
            }
        }

        stack.push(function (currentRequest, currentResponse) {
            if (routeMatch) {
                currentRequest.params = routeMatch.params;
                return routeMatch.route.handler(currentRequest, currentResponse);
            }

            if (allowedMethods.length > 0) {
                currentResponse
                    .setStatus(405)
                    .setHeader("Allow", allowedMethods.join(", "));
                return { error: "Method Not Allowed" };
            }

            currentResponse.setStatus(404);
            return { error: "Not Found" };
        });

        const result = this.dispatch(stack, request, response, 0);
        applyHandlerResult(response, result);
        return response;
    }

    private dispatch(stack: Middleware[], request: HttpRequest, response: HttpResponse, index: number): HandlerResult {
        const middleware = stack[index];

        if (typeof middleware === "undefined") {
            return;
        }

        return middleware(request, response, this.createNext(stack, request, response, index));
    }

    private createNext(stack: Middleware[], request: HttpRequest, response: HttpResponse, index: number): () => HandlerResult {
        return () => this.dispatch(stack, request, response, index + 1);
    }

    private findRoute(method: HttpMethod, path: string): MatchedRoute | undefined {
        for (const route of this.routes) {
            if (route.method === method && route.path === path) {
                return {
                    route: route,
                    params: {}
                };
            }
        }

        for (const route of this.routes) {
            if (route.method !== method) {
                continue;
            }

            const params = matchRoutePath(route.path, path);

            if (typeof params !== "undefined") {
                return {
                    route: route,
                    params: params
                };
            }
        }

        return undefined;
    }

    private findAllowedMethods(path: string): HttpMethod[] {
        const allowed: Record<string, boolean> = {};
        const methods: HttpMethod[] = [];

        for (const route of this.routes) {
            if (typeof matchRoutePath(route.path, path) !== "undefined" && !allowed[route.method]) {
                allowed[route.method] = true;
                methods.push(route.method);
            }
        }

        return methods;
    }
}
