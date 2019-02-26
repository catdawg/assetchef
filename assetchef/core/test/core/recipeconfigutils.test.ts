// tslint:disable:no-unused-expression
import * as chai from "chai";

import { RecipeConfigUtils } from "../../src/core/recipeconfigutils";
import { ISchemaDefinition } from "../../src/ischemadefinition";
import { validateJSON } from "../../src/jsonvalidation";

const expect = chai.expect;

async function runAndReturnError(f: () => Promise<any>): Promise<Error> {
    try {
        await f();
    } catch (e) {
        return e;
    }
    return null;
}

describe("recipeconfigutils", () => {
    it("test parameters", async () => {
        expect(
            await runAndReturnError(async () => await RecipeConfigUtils.getFullSchema(null)))
            .to.not.be.null;
    });

    it("test base schema invalid object", async () => {
        const res = validateJSON({something: 1}, RecipeConfigUtils.getBaseConfigSchema());

        expect(res.valid).to.be.false;
    });

    it("test base schema valid object", async () => {
        const res = validateJSON({
            dependencies: {
                testplugin: "1.0.0",
            },
            peerDependencies: {

            },
            roots: [
                {
                    testplugin: {
                        config: {},
                        next: [],
                    },
                },
                ],
            }, RecipeConfigUtils.getBaseConfigSchema());

        expect(res.valid).to.be.true;
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
            roots: [
                {
                    testplugin: {
                        config: {
                            astring: "something",
                        },
                        next: [],
                    },
                },
            ],
        }, RecipeConfigUtils.getFullSchema(pluginSchemas));

        expect(res.valid).to.be.true;
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
            roots: [
                {
                    unknownplugin: {
                        config: {
                            astring: "something",
                        },
                        next: [],
                    },
                },
            ],
        }, RecipeConfigUtils.getFullSchema(pluginSchemas));

        expect(res.valid).to.be.false;
    });
});
