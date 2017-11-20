'use strict';

var jsonvalidation = require('./utils/jsonvalidation');

var recipe = module.exports = {};

const baseSchema = {
    "definitions": {
        /*
        "assetchef-testtextsplitter": {
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
        }, */
        "step": {
            "type": "object",
            "additionalProperties": {
                "type": "object",
                "properties": {
                    "version": {"type": "string"},
                    "options": {}
                },
                "required": ["version"],
                "additionalProperties": false
            },
            "minProperties": 1,
            "maxProperties": 1
        }
    },

    "properties": {
        "steps": {
            "type": "array",
            "items": { "$ref": "#/definitions/step" }
        }
    },
    "required": ["steps"],
    "additionalProperties": false
};

/**
 * @typedef ValidateBaseRecipeResult
 * @type {object}
 * @property {array} errors - The errors array returned by the underlying json schema validation engine, null if recipe is valid
 * @property {boolean} valid - If the recipe conforms to the schema
 */
/**
 * Validates the object using a json schema that represents the base structure of a recipe. 
 * This does not validate step options, that is done after the dependencies are resolved.
 * @param {object} recipeConfig - the config object
 * @return {ValidateBaseRecipeResult} - the result object
 * @throws {verror.VError} if argument is null
 */
recipe.validateBaseRecipeStructure = function(recipeConfig) {
    var result = jsonvalidation.validateJSON(recipeConfig, baseSchema);
    if (!result.valid) {
        return result;
    }

    return result;
}
