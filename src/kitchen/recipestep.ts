import { ILogger } from "../plugin/ilogger";
import { IPathTreeReadonly } from "../plugin/ipathtreereadonly";
import { IRecipePlugin, IRecipePluginInstance } from "../plugin/irecipeplugin";

export class RecipeStep {
    public treeInterface: IPathTreeReadonly<Buffer>;
    private plugin: IRecipePlugin;
    private pluginInstance: IRecipePluginInstance;

    public async setup(
        logger: ILogger,
        prevStepTreeInterface: IPathTreeReadonly<Buffer>,
        plugin: IRecipePlugin,
        config: object): Promise<void> {

        this.plugin = plugin;
        this.pluginInstance = this.plugin.createInstance();
        await this.pluginInstance.setup(logger, config, prevStepTreeInterface);
        this.treeInterface = this.pluginInstance.treeInterface;
    }

    public async update(): Promise<{finished: boolean}> {
        return await this.pluginInstance.update();
    }

    public async reset(): Promise<void> {
        return await this.pluginInstance.reset();
    }

    public async destroy(): Promise<void> {
        return await this.pluginInstance.destroy();
    }
}
