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
     * @param logger specifies the logger to use. All logging messages should go here.
     * @param config the configuration of the plugin, it is in the structure specified by the schema in IRecipePlugin
     * @param prevStepInterface the interface of the previous step. Processing should occur on this data.
     * @param needsProcessingCallback whenever the plugin has something to do, it should call this.
     */
    setup: (
        logger: ILogger,
        config: any,
        prevStepInterface: IPathTreeReadonly<Buffer>,
        needsProcessingCallback: () => void) => Promise<void>;

    /**
     * Reset the processing of this node.
     */
    reset: () => Promise<void>;

    /**
     * Execute the processing of the node. SHould not do everything, just process one cycle.
     * E.g. compress one texture.
     */
    update: () => Promise<void>;

    /**
     * Check if there's anything to do.
     */
    needsUpdate: () => boolean;

    /**
     * Destroy the instance releasing any resources.
     */
    destroy: () => Promise<void>;
}
