import { VError } from "verror";

import { addPrefixToLogger } from "../comm/addprefixtologger";
import { ILogger } from "../comm/ilogger";
import { IRecipePlugin } from "../irecipeplugin";
import { IPathTreeAsyncRead } from "../path/ipathtreeasyncread";
import { IPathTreeAsyncWrite } from "../path/ipathtreeasyncwrite";
import { IPathTreeRead } from "../path/ipathtreeread";
import { IRecipeStepConfig } from "./irecipeconfig";
import { RecipeStep } from "./recipestep";

interface IStepLinkedListNode {
    node: RecipeStep;
    nextNodes: IStepLinkedListNode[];
}

/**
 * Handles "cooking a recipe". Receives a recipe and plugins, and sets up everything to
 * be able to "cook the recipe".
 */
export class RecipeCooker {
    public _actionForTestingMidCooking: () => Promise<void>;

    private firstLine: IStepLinkedListNode[] = [];

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
     * @param recipeStartingSteps the recipe
     * @param root all starting steps will read from this.
     * @param plugins the plugins
     */
    public async setup(
        logger: ILogger,
        projectTree: IPathTreeAsyncRead<Buffer> & IPathTreeAsyncWrite<Buffer>,
        recipeStartingSteps: IRecipeStepConfig[],
        root: IPathTreeRead<Buffer>,
        plugins: {[index: string]: IRecipePlugin}): Promise<void> {
        if (this.cooking) {
            throw new VError("Cooking in progress. Cancel the cooking or wait until it finishes.");
        }
        await setupLine(
            "", logger, projectTree, root, recipeStartingSteps, plugins, this.firstLine, () => {
                if (this.continueCookingPoke != null) {
                    this.continueCookingPoke();
                }
        });
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
        for (const root of this.firstLine) {
            await destroy(root);
        }

        this.firstLine = [];
    }

    /**
     * Resets the pipeline so that everything is processed again. Cannot be called while cooking. Please call
     * stopCooking first.
     */
    public async reset(): Promise<void> {
        if (this.cooking) {
            throw new VError("Cooking in progress. Cancel the cooking or wait until it finishes.");
        }
        for (const root of this.firstLine) {
            await reset(root);
        }
    }

    private async cook(continuously: boolean) {
        this.cooking = true;
        this.stopCook = false;

        while (!this.stopCook) {
            let didSomething = false;
            for (const root of this.firstLine) {
                const res = await updateRecursively(root);

                if (this._actionForTestingMidCooking != null) {
                    const action = this._actionForTestingMidCooking;
                    this._actionForTestingMidCooking = null;
                    await action();
                }

                if (this.stopCook) {
                    this.onCookingStopped();
                    return;
                }

                if (res.didSomething) {
                    didSomething = true;
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

async function reset(node: IStepLinkedListNode): Promise<void> {
    await node.node.reset();
    for (const next of node.nextNodes) {
        await reset(next);
    }
}

async function destroy(node: IStepLinkedListNode): Promise<void> {
    await node.node.destroy();
    for (const next of node.nextNodes) {
        await destroy(next);
    }
}

async function updateRecursively(node: IStepLinkedListNode): Promise<{didSomething: boolean}> {
    if (node.node.needsUpdate()) {
        await node.node.update();
        return {didSomething: true};
    }

    for (const next of node.nextNodes) {
        const nextRes = await updateRecursively(next);

        if (nextRes.didSomething) {
            return {didSomething: true};
        }
    }

    return {didSomething: false};
}

async function destroyRuntimeObject(runtimeObject: IStepLinkedListNode) {
    await runtimeObject.node.destroy();
}

async function setupLine(
    pipelinePath: string,
    logger: ILogger,
    projectTree: IPathTreeAsyncRead<Buffer> & IPathTreeAsyncWrite<Buffer>,
    prevTree: IPathTreeRead<Buffer>,
    configLine: IRecipeStepConfig[],
    plugins: {[index: string]: IRecipePlugin},
    runtimeObjects: IStepLinkedListNode[],
    nodeNeedsUpdateCallback: () => void): Promise<void> {

    for (let i = 0; i < configLine.length; ++i) {
        const cfg = configLine[i];
        const pluginName = Object.keys(cfg)[0];
        const pluginConfig = cfg[pluginName];
        let linkedListNode: IStepLinkedListNode = null;

        if (runtimeObjects.length <= i) {
            linkedListNode = {
                node: new RecipeStep(),
                nextNodes: [],
            };
            runtimeObjects.push(linkedListNode);
        } else {
            linkedListNode = runtimeObjects[i];
        }
        const nodePath = pipelinePath + "/" + pluginName + "_" + i;
        const nodePathPrefix = nodePath + ":";
        await linkedListNode.node.setup(
            addPrefixToLogger(logger, nodePathPrefix),
            projectTree,
            prevTree,
            plugins[pluginName],
            pluginConfig.config,
            nodeNeedsUpdateCallback);

        await setupLine(
            nodePath,
            logger,
            projectTree,
            linkedListNode.node.treeInterface,
            pluginConfig.next,
            plugins,
            linkedListNode.nextNodes,
            nodeNeedsUpdateCallback,
        );
    }

    for (let i = configLine.length; i < runtimeObjects.length; ++i) {
        await destroyRuntimeObject(runtimeObjects[i]);
    }
}
