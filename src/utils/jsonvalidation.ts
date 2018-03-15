import Ajv from "ajv";
import { VError } from "verror";

const ajv = new Ajv({ allErrors: true, verbose: true });

interface IArgs {
    ref: boolean;
    aliasRef: boolean;
    topRef: boolean;
    titles: boolean;
    defaultProps: boolean;
    noExtraProps: boolean;
    propOrder: boolean;
    typeOfKeyword: boolean;
    required: boolean;
    strictNullChecks: boolean;
    ignoreErrors: boolean;
    out: string;
    validationKeywords: string[];
    excludePrivate: boolean;
}
type PartialArgs = Partial<IArgs>;
type PrimitiveType = number | boolean | string | null;
export interface ISchemaDefinition {
    $ref?: string;
    description?: string;
    allOf?: ISchemaDefinition[];
    oneOf?: ISchemaDefinition[];
    anyOf?: ISchemaDefinition[];
    title?: string;
    type?: string | string[];
    definitions?: {
        [key: string]: any;
    };
    format?: string;
    items?: ISchemaDefinition | ISchemaDefinition[];
    minItems?: number;
    additionalItems?: {
        anyOf: ISchemaDefinition[];
    };
    enum?: PrimitiveType[] | ISchemaDefinition[];
    default?: PrimitiveType | object;
    additionalProperties?: ISchemaDefinition | boolean;
    required?: string[];
    propertyOrder?: string[];
    properties?: {};
    defaultProperties?: string[];
    typeof?: "function";
}

/**
 * @typedef ValidateJSONResult
 * @type {object}
 * @property {array} [errors] errors - The errors array returned by the underlying json schema validation engine,
 * null if json is valid
 * @property {boolean} valid - If the json conforms to the schema
 */

/**
 * Validates the json using the schema. Both parameters can't be null and the schema has to be valid,
 * otherwise an expection is thrown.
 * @param {!object|!number|!boolean} json - the json object
 * @param {!object} schema - the schema
 * @return {ValidateJSONResult} - the result object that contains the validation result
 * @throws {verror.VError} if arguments are null, or schema is invalid
 */
export function validateJSON(json: object | number | boolean, schema: ISchemaDefinition) {

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
        errors: schemaValidator.errors,
        valid: false,
    };
}
