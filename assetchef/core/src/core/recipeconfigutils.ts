import VError from "verror";

import { ISchemaDefinition } from "../ischemadefinition";

export abstract class RecipeConfigUtils {
    /**
     * Returns the base config schema before plugins are evaluated and their schemas determined.
     * @returns the base schema
     */
    public static getBaseConfigSchema(): ISchemaDefinition {
        return {
            additionalProperties: false,
            definitions: {
                step: {
                    additionalProperties:  {
                        properties: {
                            config: {
                                type: "object",
                            },
                        },
                        required: ["config"],
                        type: "object",
                    },
                    type: "object",
                    maxProperties: 1,
                    minProperties: 1,
                },
            },

            properties: {
                steps: {
                    items: { $ref: "#/definitions/step" },
                    type: "array",
                },
                dependencies: {
                    type: "object",
                    items: { type: "string"},
                },
                peerDependencies: {
                    type: "object",
                    items: { type: "string"},
                },
            },
            required: ["steps", "dependencies", "peerDependencies"],
        };
    }

    /**
     * Combines the plugin schemas into the base config schema and acquires the final base schema.
     * Will throw if parameter is null.
     * @param pluginSchemas the plugins schemas
     * @returns the full schema
     */
    public static getFullSchema(pluginSchemas: {[index: string]: ISchemaDefinition}): ISchemaDefinition {
        if (pluginSchemas == null) {
            throw new VError("pluginSchemas can't be null");
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
                },
                required: ["config"],
                type: "object",
            };
        }

        return schema;
    }
}
