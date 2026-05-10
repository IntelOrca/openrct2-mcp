import type { ControllerDefinition } from "./types.js";

export function createDateController(): ControllerDefinition {
    return {
        name: "date",
        basePath: "/v1/date",
        routes: [
            {
                method: "GET",
                path: "/v1/date",
                operationId: "getDate",
                summary: "Get the current in-game date",
                description: "Returns the current OpenRCT2 date values from the running game.",
                responseDescription: "Current game date values",
                handler: function () {
                    return {
                        ticksElapsed: date.ticksElapsed,
                        monthsElapsed: date.monthsElapsed,
                        yearsElapsed: date.yearsElapsed,
                        monthProgress: date.monthProgress,
                        day: date.day,
                        month: date.month,
                        year: date.year
                    };
                }
            }
        ]
    };
}
