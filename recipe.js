"use strict";

const VError = require("verror").VError;
const jsonvalidation = require("./utils/jsonvalidation");
const recipe = module.exports = {};

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
    const result = jsonvalidation.validateJSON(recipeConfig, baseSchema);
    if (!result.valid) {
        return result;
    }

    return result;
};

/**
 * @typedef ValidateDependenciesResult
 * @type {object}
 * @property {array} missingDependencies - The dependencies that could not be retrieved. Null if all valid
 * @property {boolean} valid - If all dependencies are requireable
 */

/**
 * This method checks if the dependecies specified in the config are requireable.
 * @param {object} recipeConfig - the config object
 * @throws {verror.VError} if argument is null
 * @return {ValidateDependenciesResult} - the result object
 */
recipe.validateDependencies = function(recipeConfig) {

    if (recipeConfig == null) {
        throw new VError("recipeConfig parameter must not be null");
    }

    const plugins = recipeConfig.steps.map((step) => {return Object.keys(step)[0];});

    const missingPlugins = [];

    for (const plugin of plugins) {

        try {
            require(plugin);
        } catch (err) {
            missingPlugins.push(plugin);
            continue;
        }
    }

    return {valid: (missingPlugins.length === 0), missingDependencies: missingPlugins.length === 0 ? null : missingPlugins};
};
