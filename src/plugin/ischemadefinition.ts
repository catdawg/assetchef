type PrimitiveType = number | boolean | string | null;

/**
 * Interface for a json schema object.
 */
export interface ISchemaDefinition {
    $id?: string;
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
