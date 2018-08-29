// tslint:disable:no-unused-expression
import * as chai from "chai";
const expect = chai.expect;
import { VError } from "verror";

import { ISchemaDefinition } from "../../src/plugin/ischemadefinition";
import { validateJSON } from "../../src/utils/jsonvalidation";

const exampleSchema: ISchemaDefinition = {
    $id: "http://mynet.com/schemas/user.json#",
    description: "User profile with connections",
    title: "User",
    type: "object",

    properties: {
        id: {
            description: "positive integer or string of digits",
            type: ["string", "integer"],

            minimum: 1,
            pattern: "^[1-9][0-9]*$",
        },

        email: { type: "string", format: "email" },
        name: { type: "string", maxLength: 128 },
        phone: { type: "string", pattern: "^[0-9()\\-\\.\\s]+$" },

        address: {
            type: "object",

            maxProperties: 6,
            required: ["street", "postcode", "city", "country"],

            additionalProperties: { type: "string" },
        },
        personal: {
            type: "object",

            properties: {
                DOB: { type: "string", format: "date" },
                age: { type: "integer", minimum: 13 },
                gender: { enum: ["female", "male"] },
            },
            required: ["DOB", "age"],

            additionalProperties: false,
        },

        connections: {
            type: "array",

            items: {
                title: "Connection",

                description: "User connection schema",
                type: "object",

                oneOf: [
                    {
                        dependencies: {
                            relation: ["close"],
                        },
                        properties: {
                            connType: { enum: ["relative"] },
                            relation: { type: "string" },
                        },
                    },
                    {
                        properties: {
                            close: { not: {} },
                            connType: { enum: ["friend", "colleague", "other"] },
                            relation: { not: {} },
                        },
                    },
                ],
                properties: {
                    id: {
                        type: ["string", "integer"],

                        minimum: 1,
                        pattern: "^[1-9][0-9]*$",
                    },
                    name: { type: "string", maxLength: 128 },

                    close: {},
                    connType: { type: "string" },
                    relation: {},
                    since: { type: "string", format: "date" },
                },
                required: ["id", "name", "since", "connType"],

                additionalProperties: false,
            },
            maxItems: 150,
        },
        feeds: {
            title: "feeds",

            description: "Feeds user subscribes to",
            type: "object",

            patternProperties: {
                "^[A-Za-z]+$": { type: "boolean" },
            },

            additionalProperties: false,
        },

        createdAt: { type: "string", format: "date-time" },
    },
};

const example = {
    id: 64209690,

    address: {
        city: "London",
        country: "United Kingdom",
        postcode: "W8 5AA",
        street: "Flat 1, 188 High Street Kensington",
    },
    email: "jane.smith@gmail.com",
    name: "Jane Smith",
    personal: {
        DOB: "1982-08-16",
        age: 33,
        gender: "female",
    },
    phone: "07777 888 999",

    connections: [
        {
            id: "35434004285760",
            name: "John Doe",

            connType: "friend",
            since: "2014-03-25",
        },
        {
            id: 13418315,
            name: "James Smith",

            close: "yes",
            connType: "relative",
            relation: "husband",
            since: "2012-07-03",
        },
    ],
    feeds: {
        fashion: false,
        news: true,
        sport: true,
    },

    createdAt: "2015-09-22T10:30:06.000Z",
};

describe("jsonvalidation", () => {
    it("should validate json object with schema object", () => {
        const result = validateJSON(example, exampleSchema);
        expect(result.valid).to.be.true;
    });
    it("should throw when parameters are null", () => {
        expect(validateJSON).to.throw(VError);
    });

    it("should throw when schema parameter is null", () => {
        expect(validateJSON.bind(null, example, null)).to.throw(VError);
    });

    it("should throw when schema is broken", () => {
        expect(validateJSON.bind(null, example, "{asdasd")).to.throw(VError);
    });

    it("should not be valid when json is broken", () => {
        // @ts-ignore
        const result = validateJSON("something", exampleSchema);
        expect(result.valid).to.be.false;
        expect(result.errors).to.be.an("array").that.is.not.empty;
    });

    it("should throw when schema is broken", () => {
        expect(validateJSON.bind(null, example, "something")).to.throw(VError);
    });
});
