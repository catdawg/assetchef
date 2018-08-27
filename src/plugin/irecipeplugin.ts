import { IPathTreeReadonly } from "./ipathtreereadonly";

/**
 * The plugin interface.
 */
export interface IRecipePlugin {
    configSchema: object;
    setup: (
        logger: ILogger,
        config: object,
        prevStepInterface: IPathTreeReadonly<Buffer>,
    ) => Promise<IPathTreeReadonly<Buffer>>;
    reset: () => Promise<void>;
    update: () => Promise<{finished: boolean}>;
    destroy: () => Promise<void>;
}
