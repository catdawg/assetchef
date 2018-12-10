"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const verror_1 = __importDefault(require("verror"));
class RecipeConfigUtils {
    /**
     * Returns the base config schema before plugins are evaluated and their schemas determined.
     * @returns the base schema
     */
    static getBaseConfigSchema() {
        return {
            additionalProperties: false,
            definitions: {
                step: {
                    additionalProperties: {
                        properties: {
                            config: {
                                type: "object",
                            },
                            next: {
                                items: { $ref: "#/definitions/step" },
                                type: "array",
                            },
                        },
                        required: ["config", "next"],
                        type: "object",
                    },
                    type: "object",
                    maxProperties: 1,
                    minProperties: 1,
                },
            },
            properties: {
                roots: {
                    items: { $ref: "#/definitions/step" },
                    type: "array",
                },
                plugins: {
                    type: "object",
                    items: { type: "string" },
                },
            },
            required: ["roots", "plugins"],
        };
    }
    /**
     * Combines the plugin schemas into the base config schema and acquires the final base schema.
     * Will throw if parameter is null.
     * @param pluginSchemas the plugins schemas
     * @returns the full schema
     */
    static getFullSchema(pluginSchemas) {
        if (pluginSchemas == null) {
            throw new verror_1.default("pluginSchemas can't be null");
        }
        const schema = RecipeConfigUtils.getBaseConfigSchema();
        schema.definitions.step.properties = {};
        schema.definitions.step.additionalProperties = false;
        for (const pluginName in pluginSchemas) {
            /* istanbul ignore next */
            if (!pluginSchemas.hasOwnProperty(pluginName)) {
                continue;
            }
            schema.definitions.step.properties[pluginName] = {
                properties: {
                    config: pluginSchemas[pluginName],
                    next: {
                        items: { $ref: "#/definitions/step" },
                        type: "array",
                    },
                },
                required: ["config", "next"],
                type: "object",
            };
        }
        return schema;
    }
}
exports.RecipeConfigUtils = RecipeConfigUtils;
//# sourceMappingURL=recipeconfigutils.js.map