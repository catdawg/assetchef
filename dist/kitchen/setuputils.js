"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function getBaseConfigSchema() {
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
        },
        required: ["steps"],
    };
}
exports.getBaseConfigSchema = getBaseConfigSchema;
function getFullSchema(config) {
}
exports.getFullSchema = getFullSchema;
//# sourceMappingURL=setuputils.js.map