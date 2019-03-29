import { VError } from "verror";

import { addPrefixToLogger } from "../comm/addprefixtologger";
import { ILogger } from "../comm/ilogger";
import { IRecipePlugin } from "../irecipeplugin";
import { IPathTreeAsyncRead } from "../path/ipathtreeasyncread";
import { IPathTreeAsyncWrite } from "../path/ipathtreeasyncwrite";
import { IPathTreeRead } from "../path/ipathtreeread";
import { IRecipeStepConfig } from "./irecipeconfig";
import { RecipeStep } from "./recipestep";

/**
 * Handles "cooking a recipe". Receives a recipe and plugins, and sets up everything to
 * be able to "cook the recipe".
 */
export class RecipeCooker {
    public _actionForTestingMidCooking: () => Promise<void>;

    private activeSteps: RecipeStep[] = [];

    private cooking: boolean = false;

    private stopCook: boolean = false;
    private cookingStoppedCallback: () => void;

    private continueCookingPoke: () => void;

    /**
     * Sets up the cooker with the configuration. It tries to reutilize existing steps, in
     * case this is not the first time this is done. For example, if only the configuration
     * changes in one of the steps, everything else should remain the same.
     * The root is usually an empty tree, but certain files can be injected if necessary.
     * This assumes that all parameters are of adequate structure, meaning that, the steps
     * include only plugins that exist in the plugins parameter and that the structure of the
     * steps and configs is validated properly.
     * @param logger the logger instance
     * @param projectPath the absolute path to the project
     * @param projectWatch the filesystem watcher for the project
     * @param recipeSteps the recipe
     * @param root all starting steps will read from this.
     * @param plugins the plugins
     */
    public async setup(
        logger: ILogger,
        projectTree: IPathTreeAsyncRead<Buffer> & IPathTreeAsyncWrite<Buffer>,
        recipeSteps: IRecipeStepConfig[],
        root: IPathTreeRead<Buffer>,
        plugins: {[index: string]: IRecipePlugin}): Promise<void> {
        if (this.cooking) {
            throw new VError("Cooking in progress. Cancel the cooking or wait until it finishes.");
        }

        let prevTree = root;
        let path = "";
        for (let i = 0; i < recipeSteps.length; ++i) {
            const step = recipeSteps[i];
            const pluginName = Object.keys(step)[0];
            const pluginConfig = step[pluginName].config;

            const node = (() => {
                if (this.activeSteps.length <= i) {
                    this.activeSteps.push(new RecipeStep());
                }

                return this.activeSteps[i];
            })();

            path = path + "/" + pluginName + "_" + i;
            const nodePathPrefix = path + ":";
            await node.setup(
                addPrefixToLogger(logger, nodePathPrefix),
                projectTree,
                prevTree,
                plugins[pluginName],
                pluginConfig,
                () => {
                    if (this.continueCookingPoke != null) {
                        this.continueCookingPoke();
                    }
            });

            prevTree = node.treeInterface;
        }
        for (let i = recipeSteps.length; i < this.activeSteps.length; ++i) {
            await this.activeSteps[i].destroy();
        }

        this.activeSteps.slice(0, recipeSteps.length);
    }

    /**
     * Runs the pipeline until it doesn't have anything else to do. Can be stopped by stopCooking.
     */
    public async cookOnce(): Promise<void> {
        if (this.cooking) {
            throw new VError("Cooking in progress. Cancel the cooking or wait until it finishes.");
        }
        await this.cook(false);
    }

    /**
     * Runs the pipeline continuously. Nodes that consume external files, like reading from the filesystem,
     * will make the pipeline execute everytime something changes. Can be stopped by stopCooking.
     */
    public async cookContinuously(): Promise<void> {
        if (this.cooking) {
            throw new VError("Cooking in progress. Cancel the cooking or wait until it finishes.");
        }
        await this.cook(true);
    }

    /**
     * If cookOnce or cookContinuously have been called but haven't finished, then this will stop their execution.
     */
    public async stopCooking(): Promise<void> {
        if (!this.cooking) {
            return;
        }

        this.stopCook = true;

        if (this.continueCookingPoke != null) {
            this.continueCookingPoke();
        }
        await new Promise((resolve, reject) => {
            this.cookingStoppedCallback = resolve;
        });
    }

    /**
     * Destroys the pipeline, releasing any resources from the plugins. Cannot be called while cooking. Please call
     * stopCooking first.
     */
    public async destroy(): Promise<void> {
        if (this.cooking) {
            throw new VError("Cooking in progress. Cancel the cooking or wait until it finishes.");
        }
        for (const step of this.activeSteps) {
            await step.destroy();
        }

        this.activeSteps = [];
    }

    /**
     * Resets the pipeline so that everything is processed again. Cannot be called while cooking. Please call
     * stopCooking first.
     */
    public async reset(): Promise<void> {
        if (this.cooking) {
            throw new VError("Cooking in progress. Cancel the cooking or wait until it finishes.");
        }
        for (const step of this.activeSteps) {
            await step.reset();
        }
    }

    private async cook(continuously: boolean) {
        this.cooking = true;
        this.stopCook = false;

        while (!this.stopCook) {
            let didSomething = false;
            for (const step of this.activeSteps) {
                if (step.needsUpdate()) {
                    await step.update();
                    didSomething = true;
                }

                if (this._actionForTestingMidCooking != null) {
                    const action = this._actionForTestingMidCooking;
                    this._actionForTestingMidCooking = null;
                    await action();
                }

                if (this.stopCook) {
                    this.onCookingStopped();
                    return;
                }

                if (didSomething) {
                    break;
                }
            }
            if (!didSomething) {
                if (continuously) {
                    await new Promise((resolve, reject) => {
                        this.continueCookingPoke = resolve;
                    });
                    this.continueCookingPoke = null;
                } else {
                    break;
                }
            }
        }

        this.onCookingStopped();
    }

    private onCookingStopped() {
        this.cooking = false;
        this.stopCook = false;
        if (this.cookingStoppedCallback != null) {
            this.cookingStoppedCallback();
        }
        this.cookingStoppedCallback = null;
    }
}
