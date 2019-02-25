import { IRecipePlugin, IRecipePluginInstance, ISchemaDefinition } from "@assetchef/pluginapi";
import { WriteFSPluginInstance } from "./writefsinstance";

export class WriteFSPlugin implements IRecipePlugin {
    public apiLevel: number = 1;
    public configSchema: ISchemaDefinition = {
        type: "object",
        properties: {
            targetPath: {
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
    };

    public createInstance(): IRecipePluginInstance {
        return new WriteFSPluginInstance();
    }
}
