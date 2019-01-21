import { IRecipePlugin, IRecipePluginInstance } from "../plugin/irecipeplugin";
import { ISchemaDefinition } from "../plugin/ischemadefinition";
import { ReadFSPluginInstance } from "./readfsinstance";

export class ReadFSPlugin implements IRecipePlugin {
    public apiLevel: number = 1;
    public configSchema: ISchemaDefinition = {
        type: "object",
        properties: {
            path: {
                type: "string",
            },
            include: {
                type: "array",
                items: {
                    type: "string",
                },
            },
            exclude: {
                type: "array",
                items: {
                    type: "string",
                },
            },
        },
        additionalProperties: false,
        required: ["path"],
    };

    public createInstance(): IRecipePluginInstance {
        return new ReadFSPluginInstance();
    }
}
