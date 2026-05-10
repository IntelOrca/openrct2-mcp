import { createDateController } from "./dateController.js";
import { createEvalController } from "./evalController.js";
import type { ControllerDefinition } from "./types.js";
import type { HttpRouter } from "../http/router.js";

export function getControllers(): ControllerDefinition[] {
    return [
        createDateController(),
        createEvalController()
    ];
}

export function registerControllers(router: HttpRouter, controllers: ControllerDefinition[]): void {
    controllers.forEach(function (controller) {
        controller.routes.forEach(function (route) {
            router.registerRoute({
                method: route.method,
                path: route.path,
                operationId: route.operationId,
                summary: route.summary,
                description: route.description,
                responseDescription: route.responseDescription,
                tags: [controller.name],
                controllerName: controller.name,
                handler: route.handler
            });
        });
    });
}

export type { ControllerDefinition } from "./types.js";
