import { ILogger } from "../plugin/ilogger";
import { IPathTreeReadonly } from "../plugin/ipathtreereadonly";
import { IRecipePlugin, IRecipePluginInstance } from "../plugin/irecipeplugin";

/**
 * Handles a step inside the recipe.
 * Takes care of directing relevant functions, like update or reset.
 * Manages setup calls using the same plugin to only update config.
 */
export class RecipeStep {
    /**
     * The exposed tree interface for this step.
     */
    public treeInterface: IPathTreeReadonly<Buffer>;
    private plugin: IRecipePlugin;
    private pluginInstance: IRecipePluginInstance;

    /**
     * Sets up the step. If it was called before, and the plugin is the same
     * object, then it doesn't create a new instance, e.g. so plugins can reload just the config.
     * @param logger the logger instance to use
     * @param prevStepTreeInterface the interface of the previous step
     * @param plugin the plugin
     * @param config the configuration.
     * @param needsProcessingCallback call whenever something changes. Called by the plugin
     */
    public async setup(
        logger: ILogger,
        prevStepTreeInterface: IPathTreeReadonly<Buffer>,
        plugin: IRecipePlugin,
        config: object,
        needsProcessingCallback: () => void): Promise<void> {

        if (plugin !== this.plugin) {
            this.plugin = plugin;
            this.pluginInstance = this.plugin.createInstance();
        }
        await this.pluginInstance.setup(logger, config, prevStepTreeInterface, needsProcessingCallback);
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
        return await this.pluginInstance.reset();
    }

    /**
     * Destroys the plugin.
     */
    public async destroy(): Promise<void> {
        return await this.pluginInstance.destroy();
    }
}
