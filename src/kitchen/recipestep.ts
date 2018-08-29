import { ILogger } from "../plugin/ilogger";
import { IPathTreeReadonly } from "../plugin/ipathtreereadonly";
import { IRecipePlugin } from "../plugin/irecipeplugin";

function requireUncached(module: string) {
    delete require.cache[require.resolve(module)];
    return require(module);
}

export class RecipeStep {
    public treeInterface: IPathTreeReadonly<Buffer>;

    private _plugin: IRecipePlugin;

    public async setup(
        logger: ILogger,
        prevStepTreeInterface: IPathTreeReadonly<Buffer>,
        pluginName: string,
        config: object): Promise<void> {

        this._plugin = requireUncached(pluginName);
        this.treeInterface = await this._plugin.setup(logger, config, prevStepTreeInterface);
    }

    public async update(): Promise<{finished: boolean}> {
        return await this._plugin.update();
    }

    public async reset(): Promise<void> {
        return await this._plugin.reset();
    }

    public async destroy(): Promise<void> {
        return await this._plugin.destroy();
    }
}
