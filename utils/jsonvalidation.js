"use strict";
var VError = require("verror").VError;
var Ajv = require("ajv");
var ajv = new Ajv({ allErrors: true });

var jsonvalidation = module.exports = {};

/**
 * @typedef ValidateJSONResult
 * @type {object}
 * @property {array} errors - The errors array returned by the underlying json schema validation engine, null if json is valid
 * @property {boolean} valid - If the json conforms to the schema
 */

/**
 * Validates the json using the schema. Both parameters can't be null and the schema has to be valid, otherwise an expection is thrown
 * @param {!object|!number|!boolean} json 
 * @param {!object} schema
 * @return {ValidateJSONResult} 
 * @throws {verror.VError} if arguments are null, or schema is invalid
 */
jsonvalidation.validateJSON = function(json, schema) {

    if (json == null) {
        throw new VError("json parameter must not be null");
    }
    if (schema == null) {
        throw new VError("schema parameter must not be null");
    } 
    
    var schemaValidator = null;
    try {
        schemaValidator = ajv.compile(schema);
    } catch (err) {
        throw new VError(err, "failed to compile schema");
    }

    var valid = schemaValidator(json);
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