import resolve from "@rollup/plugin-node-resolve";
import terser from "@rollup/plugin-terser";
import typescript from "@rollup/plugin-typescript";

/**
 * @type {import("rollup").RollupOptions}
 */
const config = {
    input: "./src/index.ts",
    output: [
        {
            file: "out/mcp.js",
            format: "iife",
        },
        {
            file: "out/mcp.min.js",
            format: "iife",
            plugins: [
                terser()
            ]
        }
    ],
    plugins: [
        resolve(),
        typescript()
    ],
    treeshake: "smallest"
};
export default config;
