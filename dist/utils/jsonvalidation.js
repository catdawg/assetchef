"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ajv_1 = __importDefault(require("ajv"));
const verror_1 = require("verror");
const ajv = new ajv_1.default({ allErrors: true, verbose: true });
/**
 * Validates the json using the schema. Both parameters can't be null and the schema has to be valid,
 * otherwise an expection is thrown.
 * @param {!object|!number|!boolean} json - the json object
 * @param {!ISchemaDefinition} schema - the schema
 * @return {IValidateJsonResult} - the result object that contains the validation result
 * @throws {verror.VError} if arguments are null, or schema is invalid
 */
function validateJSON(json, schema) {
    if (json == null) {
        throw new verror_1.VError("json parameter must not be null");
    }
    if (schema == null) {
        throw new verror_1.VError("schema parameter must not be null");
    }
    let schemaValidator = null;
    try {
        schemaValidator = ajv.compile(schema);
    }
    catch (err) {
        throw new verror_1.VError(err, "failed to compile schema");
    }
    const valid = schemaValidator(json);
    if (valid) {
        return {
            valid: true,
        };
    }
    return {
        errors: schemaValidator.errors,
        valid: false,
    };
}
exports.validateJSON = validateJSON;
//# sourceMappingURL=jsonvalidation.js.map