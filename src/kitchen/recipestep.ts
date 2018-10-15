import { ILogger } from "../plugin/ilogger";
import { IPathTreeReadonly } from "../plugin/ipathtreereadonly";
import { IRecipePlugin } from "../plugin/irecipeplugin";

export class RecipeStep {
    public treeInterface: IPathTreeReadonly<Buffer>;
    private plugin: IRecipePlugin;

    public async setup(
        logger: ILogger,
        prevStepTreeInterface: IPathTreeReadonly<Buffer>,
        plugin: IRecipePlugin,
        config: object): Promise<void> {

        this.plugin = plugin;
        this.treeInterface = await plugin.setup(logger, config, prevStepTreeInterface);
    }

    public async update(): Promise<{finished: boolean}> {
        return await this.plugin.update();
    }

    public async reset(): Promise<void> {
        return await this.plugin.reset();
    }

    public async destroy(): Promise<void> {
        return await this.plugin.destroy();
    }
}
