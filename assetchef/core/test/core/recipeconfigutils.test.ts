import { RecipeConfigUtils } from "../../src/core/recipeconfigutils";
import { ISchemaDefinition } from "../../src/ischemadefinition";
import { validateJSON, ValidateJsonResultType } from "../../src/jsonvalidation";

describe("recipeconfigutils", () => {
    it("test parameters", async () => {
        expect(() => RecipeConfigUtils.getFullSchema(null)).toThrow();
    });

    it("test base schema invalid object", async () => {
        const res = validateJSON({something: 1}, RecipeConfigUtils.getBaseConfigSchema());

        expect(res.res).toEqual(ValidateJsonResultType.JsonIsInvalid);
    });

    it("test base schema valid object", async () => {
        const res = validateJSON({
            dependencies: {
                testplugin: "1.0.0",
            },
            peerDependencies: {

            },
            steps: [
                {
                    testplugin: {
                        config: {},
                    },
                },
            ],
            }, RecipeConfigUtils.getBaseConfigSchema());

        expect(res.res).toEqual(ValidateJsonResultType.Valid);
    });

    it("test full schema valid object", async () => {
        const pluginSchemas: {[index: string]: ISchemaDefinition} = {
            testplugin: {
                type: "object",
                properties: {
                    astring: {
                        type: "string",
                    },
                },
                required: ["astring"],
            },
        };
        const res = validateJSON({
            dependencies: {
                testplugin: "1.0.0",
            },
            peerDependencies: {

            },
            steps: [
                {
                    testplugin: {
                        config: {
                            astring: "something",
                        },
                    },
                },
            ],
        }, RecipeConfigUtils.getFullSchema(pluginSchemas));

        expect(res.res).toEqual(ValidateJsonResultType.Valid);
    });

    it("test full schema unknown plugin", async () => {
        const pluginSchemas: {[index: string]: ISchemaDefinition} = {
            testplugin: {
                type: "object",
                properties: {
                    astring: {
                        type: "string",
                    },
                },
                required: ["astring"],
            },
        };
        const res = validateJSON({
            dependencies: {
                testplugin: "1.0.0",
            },
            peerDependencies: {},
            steps: [
                {
                    unknownplugin: {
                        config: {
                            astring: "something",
                        },
                    },
                },
            ],
        }, RecipeConfigUtils.getFullSchema(pluginSchemas));

        expect(res.res).toEqual(ValidateJsonResultType.JsonIsInvalid);
    });
});
