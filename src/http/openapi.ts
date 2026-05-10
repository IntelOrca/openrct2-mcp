import type { RouteDefinition } from "./types.js";

function quoteYaml(value: string): string {
    return JSON.stringify(value);
}

export function generateOpenApiYaml(title: string, version: string, routes: RouteDefinition[]): string {
    var lines = [
        "openapi: 3.1.0",
        "info:",
        "  title: " + quoteYaml(title),
        "  version: " + quoteYaml(version),
        "paths:"
    ];
    var visibleRoutes = routes
        .filter(function (route) {
            return route.hideFromOpenApi !== true;
        })
        .sort(function (left, right) {
            if (left.path === right.path) {
                if (left.method < right.method) {
                    return -1;
                }
                if (left.method > right.method) {
                    return 1;
                }
                return 0;
            }

            if (left.path < right.path) {
                return -1;
            }
            return 1;
        });
    var currentPath = "";
    var i: number;
    var route: RouteDefinition;
    var responseDescription: string;

    if (visibleRoutes.length === 0) {
        lines.push("  {}");
        return lines.join("\n");
    }

    for (i = 0; i < visibleRoutes.length; i++) {
        route = visibleRoutes[i];
        if (route.path !== currentPath) {
            currentPath = route.path;
            lines.push("  " + quoteYaml(route.path) + ":");
        }

        lines.push("    " + route.method.toLowerCase() + ":");
        lines.push("      operationId: " + quoteYaml(route.operationId));
        lines.push("      summary: " + quoteYaml(route.summary));

        if (typeof route.description !== "undefined") {
            lines.push("      description: " + quoteYaml(route.description));
        }

        if (typeof route.tags !== "undefined" && route.tags.length > 0) {
            lines.push("      tags:");
            route.tags.forEach(function (tag) {
                lines.push("        - " + quoteYaml(tag));
            });
        }

        responseDescription = route.responseDescription || "Successful response";
        lines.push("      responses:");
        lines.push("        '200':");
        lines.push("          description: " + quoteYaml(responseDescription));
        lines.push("          content:");
        lines.push("            application/json:");
        lines.push("              schema:");
        lines.push("                type: object");
    }

    return lines.join("\n");
}
