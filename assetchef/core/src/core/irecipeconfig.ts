/**
 * Structure of each step in the config. The config object will be later "typed",
 * depending on whatever the plugin specifies as it's config schema.
 */
export interface IRecipeStepConfig {
    [propName: string]: {
        config: object;
    };
}

/**
 * The list of plugins
 */
export interface IRecipePlugins {
    [propName: string]: string;
}

/**
 * Base structure of a recipe config.
 */
export interface IRecipeConfig {
    dependencies: IRecipePlugins;
    peerDependencies: IRecipePlugins;
    steps: IRecipeStepConfig[];
}
