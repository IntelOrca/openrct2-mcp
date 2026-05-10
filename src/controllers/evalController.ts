import type { ControllerDefinition } from "./types.js";

function evaluateExpression(expression: string): unknown {
    try {
        return new Function("return (" + expression + ");")();
    } catch (_error) {
        return new Function(expression)();
    }
}

export function createEvalController(): ControllerDefinition {
    return {
        name: "eval",
        basePath: "/v1/eval",
        routes: [
            {
                method: "GET",
                path: "/v1/eval",
                operationId: "evaluateExpression",
                summary: "Evaluate a JavaScript expression",
                description: "Evaluates the q query parameter and returns the resulting value.",
                responseDescription: "Evaluation result",
                handler: function (request, response) {
                    const expression = request.query.q;
                    let result: unknown;

                    if (typeof expression === "undefined") {
                        response.setStatus(400);
                        return {
                            error: "Missing q parameter"
                        };
                    }

                    try {
                        result = evaluateExpression(expression);
                    } catch (error) {
                        response.setStatus(400);
                        return {
                            error: String(error)
                        };
                    }

                    return {
                        result: result
                    };
                }
            }
        ]
    };
}
