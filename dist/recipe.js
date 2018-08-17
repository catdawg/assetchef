"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const verror_1 = require("verror");
const jsonvalidation_1 = require("./utils/jsonvalidation");
/**
 * Helper function to get the plugin list from the recipe
 * @param {object} recipeConfig the recipe
 * @returns {array} the list of plugins
 */
function getPlugins(recipeConfig) {
    return recipeConfig.steps.map((step) => Object.keys(step)[0]);
}
/**
 * Returns an instance of the base schema. It is a function, so you can alter the results.
 * If it was a variable, you would have to clone it.
 * @returns {object} the base schema
 */
function getBaseSchema() {
    return {
        additionalProperties: false,
        definitions: {
            step: {
                additionalProperties: {
                    type: "object",
                },
                maxProperties: 1,
                minProperties: 1,
                type: "object",
            },
        },
        properties: {
            steps: {
                items: { $ref: "#/definitions/step" },
                type: "array",
            },
        },
        required: ["steps"],
    };
}
/**
 * Validates the object using a json schema that represents the base structure of a recipe.
 * This does not validate step options, that is done after the Plugins are resolved.
 * @param {object} recipeConfig - the config object
 * @return {jsonvalidation.ValidateJSONRecipeResult} - the result object
 * @throws {verror.VError} if argument is null
 */
function validateBaseRecipeStructure(recipeConfig) {
    if (recipeConfig == null) {
        throw new verror_1.VError("recipeConfig parameter must not be null");
    }
    return jsonvalidation_1.validateJSON(recipeConfig, getBaseSchema());
}
exports.validateBaseRecipeStructure = validateBaseRecipeStructure;
/**
 * @typedef ValidatePluginsResult
 * @type {object}
 * @property {array} missingPlugins - The Plugins that could not be retrieved. Null if all valid
 * @property {boolean} valid - If all Plugins are requireable
 */
/**
 * This method checks if the dependecies specified in the config are requireable.
 * It assumes the base structure of the Recipe has been checked with {@link recipe.validateBaseRecipeStructure},
 * If the base structure of the recipe is not correct, an unspecified error will occur.
 * @param {object} recipeConfig - the config object
 * @throws {verror.VError} if argument is null
 * @return {ValidatePluginsResult} - the result object
 */
function validatePlugins(recipeConfig) {
    if (recipeConfig == null) {
        throw new verror_1.VError("recipeConfig parameter must not be null");
    }
    const plugins = getPlugins(recipeConfig);
    const missingPlugins = [];
    for (const plugin of plugins) {
        try {
            require(plugin);
        }
        catch (err) {
            missingPlugins.push(plugin);
            continue;
        }
    }
    return { valid: (missingPlugins.length === 0), missingPlugins: missingPlugins.length === 0 ? null : missingPlugins };
}
exports.validatePlugins = validatePlugins;
/**
 * Does the same as {@link validateBaseRecipeStructure} while also checking if the configs of
 * the plugins are correct by merging all of schemas provided by plugins in their getSchema method.
 * This method assumes that the dependencies are correct, so please make sure to run {@link validatePlugins} before.
 * @param {object} recipeConfig - the config object
 * @return {jsonvalidation.ValidateJSONRecipeResult} - the result object
 * @throws {verror.VError} if argument is null
 */
function validatePluginsRecipeStructure(recipeConfig) {
    if (recipeConfig == null) {
        throw new verror_1.VError("recipeConfig parameter must not be null");
    }
    const plugins = getPlugins(recipeConfig);
    const schema = getBaseSchema();
    schema.definitions.step.properties = {};
    delete (schema.definitions.step.additionalProperties);
    for (const pluginName of plugins) {
        const plugin = require(pluginName);
        schema.definitions.step.properties[pluginName] = plugin.getSchema();
    }
    return jsonvalidation_1.validateJSON(recipeConfig, schema);
}
exports.validatePluginsRecipeStructure = validatePluginsRecipeStructure;
//# sourceMappingURL=recipe.js.map