import type { HttpResponse } from "./response.js";

export type HttpMethod = string;

export interface HttpRequest {
    method: HttpMethod;
    rawPath: string;
    path: string;
    httpVersion: string;
    headers: Record<string, string>;
    query: Record<string, string>;
    params: Record<string, string>;
    body: string;
    getHeader(name: string): string | undefined;
}

export type HandlerResult =
    | HttpResponse
    | Record<string, unknown>
    | unknown[]
    | string
    | number
    | boolean
    | null
    | void;

export type NextFunction = () => HandlerResult;

export type Middleware = (request: HttpRequest, response: HttpResponse, next: NextFunction) => HandlerResult;

export type RouteHandler = (request: HttpRequest, response: HttpResponse) => HandlerResult;

export interface RouteDefinition {
    method: HttpMethod;
    path: string;
    operationId: string;
    summary: string;
    description?: string;
    tags?: string[];
    responseDescription?: string;
    hideFromOpenApi?: boolean;
    controllerName?: string;
    handler: RouteHandler;
}
