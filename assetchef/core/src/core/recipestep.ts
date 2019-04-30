import { ILogger } from "../comm/ilogger";
import { IRecipePlugin, IRecipePluginInstance } from "../irecipeplugin";
import { IPathTreeAsyncRead } from "../path/ipathtreeasyncread";
import { IPathTreeAsyncWrite } from "../path/ipathtreeasyncwrite";
import { IPathTreeRead } from "../path/ipathtreeread";

/**
 * Handles a step inside the recipe.
 * Takes care of directing relevant functions, like update or reset.
 * Manages setup calls using the same plugin to only update config.
 */
export class RecipeStep {
    /**
     * The exposed tree interface for this step.
     */
    public treeInterface: IPathTreeRead<Buffer>;
    private plugin: IRecipePlugin;
    private pluginInstance: IRecipePluginInstance;

    /**
     * Sets up the step. If it was called before, and the plugin is the same
     * object, then it doesn't create a new instance, e.g. so plugins can reload just the config.
     * @param logger the logger instance to use
     * @param projectPath the absolute path to the project
     * @param projectWatch the watcher for the project in case the plugin needs it
     * @param prevStepTreeInterface the interface of the previous step
     * @param plugin the plugin
     * @param config the configuration.
     * @param needsProcessingCallback call whenever something changes. Called by the plugin
     */
    public async setup(
        logger: ILogger,
        projectTree: IPathTreeAsyncRead<Buffer> & IPathTreeAsyncWrite<Buffer>,
        prevStepTreeInterface: IPathTreeRead<Buffer>,
        plugin: IRecipePlugin,
        config: object,
        needsProcessingCallback: () => void): Promise<void> {
        if (plugin !== this.plugin) {
            await this.destroy();
            this.plugin = plugin;
            this.pluginInstance = this.plugin.createInstance();
        }
        await this.pluginInstance.setup( {
            logger,
            projectTree,
            config,
            prevStepTreeInterface,
            needsProcessingCallback,
        });
        this.treeInterface = this.pluginInstance.treeInterface;
    }

    /**
     * Checks if plugin needs update.
     */
    public needsUpdate(): boolean {
        return this.pluginInstance.needsUpdate();
    }

    /**
     * Updates the plugin.
     */
    public async update(): Promise<void> {
        await this.pluginInstance.update();
    }

    /**
     * Resets the plugin.
     */
    public async reset(): Promise<void> {
        await this.pluginInstance.reset();
    }

    /**
     * Destroys the plugin.
     */
    public async destroy(): Promise<void> {
        if (this.pluginInstance != null) {
            await this.pluginInstance.destroy();
        }
    }
}
