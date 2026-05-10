import type { HttpMethod, RouteHandler } from "../http/types.js";

export interface ControllerRouteDefinition {
    method: HttpMethod;
    path: string;
    operationId: string;
    summary: string;
    description?: string;
    responseDescription?: string;
    handler: RouteHandler;
}

export interface ControllerDefinition {
    name: string;
    basePath: string;
    routes: ControllerRouteDefinition[];
}
