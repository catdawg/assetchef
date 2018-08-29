import { ILogger } from "./ilogger";
import { IPathTreeReadonly } from "./ipathtreereadonly";
import { ISchemaDefinition } from "./ischemadefinition";

/**
 * The plugin interface.
 */
export interface IRecipePlugin {
    configSchema: ISchemaDefinition;
    setup: (logger: ILogger,
            config: object,
            prevStepInterface: IPathTreeReadonly<Buffer>) => Promise<IPathTreeReadonly<Buffer>>;
    reset: () => Promise<void>;
    update: () => Promise<{finished: boolean}>;
    destroy: () => Promise<void>;
}
