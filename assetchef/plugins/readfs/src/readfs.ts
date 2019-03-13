import { IRecipePlugin, IRecipePluginInstance, ISchemaDefinition } from "@assetchef/pluginapi";
import { ReadFSPluginInstance } from "./readfsinstance";

export class ReadFSPlugin implements IRecipePlugin {
    public apiLevel: number = 1;
    public configSchema: ISchemaDefinition = {
        type: "object",
        properties: {
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
            path: {
                type: "string",
                items: {
                    type: "string",
                },
            },
        },
        required: ["path"],
        additionalProperties: false,
    };

    public createInstance(): IRecipePluginInstance {
        return new ReadFSPluginInstance();
    }
}
