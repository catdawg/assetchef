import Ajv from "ajv";
import { VError } from "verror";

import { ISchemaDefinition } from "./ischemadefinition";

const ajv = new Ajv({ allErrors: true, verbose: true });

export interface IValidateJsonResult {
    /**
     * The errors returned by the underlying json schema validation engine, null if json is valid
     */
    errors?: string;

    /**
     * True if the Json conforms to the schema.
     */
    valid: boolean;
}

/**
 * Validates the json using the schema. Both parameters can't be null and the schema has to be valid,
 * otherwise an expection is thrown.
 * @param {!object|!number|!boolean} json - the json object
 * @param {!ISchemaDefinition} schema - the schema
 * @return {IValidateJsonResult} - the result object that contains the validation result
 * @throws {verror.VError} if arguments are null, or schema is invalid
 */
export function validateJSON(json: object | number | boolean, schema: ISchemaDefinition): IValidateJsonResult {

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
            valid: true,
        };
    }
    return {
        errors: ajv.errorsText(schemaValidator.errors, {separator: ", "}),
        valid: false,
    };
}
