import { ILogger } from "./ilogger";
import { IPathTreeReadonly } from "./ipathtreereadonly";
import { ISchemaDefinition } from "./ischemadefinition";

/**
 * The plugin interface. Defines any shared data between plugins of the same type.
 */
export interface IRecipePlugin {
    /**
     * The minimum API Level this plugin supports.
     */
    apiLevel: number;
    /**
     * The schema of the config of this plugin.
     */
    configSchema: ISchemaDefinition;

    /**
     * Creates an instance of the plugin that represents a node in the pipeline.
     */
    createInstance: () => IRecipePluginInstance;
}

/**
 * The plugin instance interface, there will be one of these active per node using the plugin.
 */
export interface IRecipePluginInstance {
    /**
     * The interface of this plugin, downstream plugin instances will receive this in their setup method.
     */
    treeInterface: IPathTreeReadonly<Buffer>;

    /**
     * Setup the plugin with a new configuration.
     */
    setup: (
        logger: ILogger,
        config: object,
        prevStepInterface: IPathTreeReadonly<Buffer>) => Promise<void>;

    /**
     * Reset the processing of this node. Next update will process everything.
     */
    reset: () => Promise<void>;

    /**
     * Execute the processing of the node.
     * This should execute one cycle, e.g. convert one file, returning finished as true when nothing else is left.
     */
    update: () => Promise<{finished: boolean}>;

    /**
     * Destroy the instance releasing any resources.
     */
    destroy: () => Promise<void>;
}
