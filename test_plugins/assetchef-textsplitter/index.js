"use strict";

const assetchefsimple = module.exports = {};

assetchefsimple.getSchema = function() {
    return {
        "type": "object",
        "properties": {
            "splits": {
                "type": "object",
                "patternProperties": {
                    ".*": { "type": "number" }
                },
                "additionalProperties": false
            },
        },
        "additionalProperties": false,
        "required": ["splits"]
    };
};