"use strict";
const VError = require("verror").VError;
const Ajv = require("ajv");
const ajv = new Ajv({ allErrors: true });

const jsonvalidation = module.exports = {};

/**
 * @typedef ValidateJSONResult
 * @type {object}
 * @property {array} errors - The errors array returned by the underlying json schema validation engine, null if json is valid
 * @property {boolean} valid - If the json conforms to the schema
 */

/**
 * Validates the json using the schema. Both parameters can't be null and the schema has to be valid, otherwise an expection is thrown
 * @param {!object|!number|!boolean} json - the json object
 * @param {!object} schema - the schema
 * @return {ValidateJSONResult} - the result object that contains the validation result
 * @throws {verror.VError} if arguments are null, or schema is invalid
 */
jsonvalidation.validateJSON = function(json, schema) {

    if (json == null) {
        throw new VError("json parameter must not be null");
    }
    if (schema == null) {
        throw new VError("schema parameter must not be null");
    } 
    
    let schemaValidator = null;
    try {
        schemaValidator = ajv.compile(schema);
    } catch (err) {
        throw new VError(err, "failed to compile schema");
    }

    const valid = schemaValidator(json);

    if (valid) {
        return {
            valid: true
        };
    }
    return {
        valid: false,
        errors: schemaValidator.errors
    };
};