import { ILogger } from "./comm/ilogger";
import { ISchemaDefinition } from "./ischemadefinition";
import { IPathTreeReadonly } from "./path/ipathtreereadonly";
import { IFSWatchListener } from "./watch/ifswatch";

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
 * Plugin instances are setup with this object
 */
export interface IRecipePluginInstanceSetupParams {
    /**
     * specifies the logger to use. All logging messages should go here.
     */
    logger: ILogger;
    /**
     * the absolute path to the project
     */
    projectPath: string;
    /**
     * the configuration of the plugin, it is in the structure specified by the schema in IRecipePlugin
     */
    config: any;
    /**
     * the interface of the previous step. Processing should occur on this data.
     */
    prevStepTreeInterface: IPathTreeReadonly<Buffer>;
    /**
     * whenever the plugin has something to do, it should call this.
     */
    needsProcessingCallback: () => void;
}

/**
 * The plugin instance interface, there will be one of these active per node using the plugin.
 */
export interface IRecipePluginInstance {
    /**
     * The interface of this plugin, downstream plugin instances will receive this in their setup method.
     * It should always be the same, regardless of the node being destroyed or reset.
     */
    readonly treeInterface: IPathTreeReadonly<Buffer>;

    /**
     * Setup the plugin with a new configuration.
     * @param params params required for the setup of a new instance
     */
    setup: (params: IRecipePluginInstanceSetupParams) => Promise<void>;

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

    /**
     * Implement to receive project file changes.
     */
    projectWatchListener?: IFSWatchListener;
}
