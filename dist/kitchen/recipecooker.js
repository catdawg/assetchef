"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const verror_1 = require("verror");
const addprefixtologger_1 = __importDefault(require("../utils/addprefixtologger"));
const recipestep_1 = require("./recipestep");
/**
 * Handles "cooking a recipe". Receives a recipe and plugins, and sets up everything to
 * be able to "cook the recipe".
 */
class RecipeCooker {
    constructor() {
        this.firstLine = [];
        this.cooking = false;
        this.stopCook = false;
    }
    /**
     * Sets up the cooker with the configuration. It tries to reutilize existing steps, in
     * case this is not the first time this is done. For example, if only the configuration
     * changes in one of the steps, everything else should remain the same.
     * The root is usually an empty tree, but certain files can be injected if necessary.
     * This assumes that all parameters are of adequate structure, meaning that, the steps
     * include only plugins that exist in the plugins parameter and that the structure of the
     * steps and configs is validated properly.
     * @param logger the logger instance
     * @param recipeStartingSteps the recipe
     * @param root all starting steps will read from this.
     * @param plugins the plugins
     */
    setup(logger, recipeStartingSteps, root, plugins) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.cooking) {
                throw new verror_1.VError("Cooking in progress. Cancel the cooking or wait until it finishes.");
            }
            yield setupLine("", logger, root, recipeStartingSteps, plugins, this.firstLine, () => {
                if (this.continueCookingPoke != null) {
                    this.continueCookingPoke();
                }
            });
        });
    }
    /**
     * Runs the pipeline until it doesn't have anything else to do. Can be stopped by stopCooking.
     */
    cookOnce() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.cooking) {
                throw new verror_1.VError("Cooking in progress. Cancel the cooking or wait until it finishes.");
            }
            yield this.cook(false);
        });
    }
    /**
     * Runs the pipeline continuously. Nodes that consume external files, like reading from the filesystem,
     * will make the pipeline execute everytime something changes. Can be stopped by stopCooking.
     */
    cookContinuously() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.cooking) {
                throw new verror_1.VError("Cooking in progress. Cancel the cooking or wait until it finishes.");
            }
            yield this.cook(true);
        });
    }
    /**
     * If cookOnce or cookContinuously have been called but haven't finished, then this will stop their execution.
     */
    stopCooking() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.cooking) {
                return;
            }
            this.stopCook = true;
            if (this.continueCookingPoke != null) {
                this.continueCookingPoke();
            }
            yield new Promise((resolve, reject) => {
                this.cookingStoppedCallback = resolve;
            });
        });
    }
    /**
     * Destroys the pipeline, releasing any resources from the plugins. Cannot be called while cooking. Please call
     * stopCooking first.
     */
    destroy() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.cooking) {
                throw new verror_1.VError("Cooking in progress. Cancel the cooking or wait until it finishes.");
            }
            for (const root of this.firstLine) {
                yield destroy(root);
            }
            this.firstLine = [];
        });
    }
    /**
     * Resets the pipeline so that everything is processed again. Cannot be called while cooking. Please call
     * stopCooking first.
     */
    reset() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.cooking) {
                throw new verror_1.VError("Cooking in progress. Cancel the cooking or wait until it finishes.");
            }
            for (const root of this.firstLine) {
                yield reset(root);
            }
        });
    }
    cook(continuously) {
        return __awaiter(this, void 0, void 0, function* () {
            this.cooking = true;
            this.stopCook = false;
            while (!this.stopCook) {
                let didSomething = false;
                for (const root of this.firstLine) {
                    const res = yield updateRecursively(root);
                    if (this._actionForTestingMidCooking != null) {
                        const action = this._actionForTestingMidCooking;
                        this._actionForTestingMidCooking = null;
                        yield action();
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
                        yield new Promise((resolve, reject) => {
                            this.continueCookingPoke = resolve;
                        });
                        this.continueCookingPoke = null;
                    }
                    else {
                        break;
                    }
                }
            }
            this.onCookingStopped();
        });
    }
    onCookingStopped() {
        this.cooking = false;
        this.stopCook = false;
        if (this.cookingStoppedCallback != null) {
            this.cookingStoppedCallback();
        }
        this.cookingStoppedCallback = null;
    }
}
exports.RecipeCooker = RecipeCooker;
function reset(node) {
    return __awaiter(this, void 0, void 0, function* () {
        yield node.node.reset();
        for (const next of node.nextNodes) {
            yield reset(next);
        }
    });
}
function destroy(node) {
    return __awaiter(this, void 0, void 0, function* () {
        yield node.node.destroy();
        for (const next of node.nextNodes) {
            yield destroy(next);
        }
    });
}
function updateRecursively(node) {
    return __awaiter(this, void 0, void 0, function* () {
        if (node.node.needsUpdate()) {
            yield node.node.update();
            return { didSomething: true };
        }
        for (const next of node.nextNodes) {
            const nextRes = yield updateRecursively(next);
            if (nextRes.didSomething) {
                return { didSomething: true };
            }
        }
        return { didSomething: false };
    });
}
function destroyRuntimeObject(runtimeObject) {
    return __awaiter(this, void 0, void 0, function* () {
        yield runtimeObject.node.destroy();
    });
}
function setupLine(path, logger, prevTree, configLine, plugins, runtimeObjects, nodeNeedsUpdateCallback) {
    return __awaiter(this, void 0, void 0, function* () {
        for (let i = 0; i < configLine.length; ++i) {
            const cfg = configLine[i];
            const pluginName = Object.keys(cfg)[0];
            const pluginConfig = cfg[pluginName];
            let linkedListNode = null;
            if (runtimeObjects.length <= i) {
                linkedListNode = {
                    node: new recipestep_1.RecipeStep(),
                    nextNodes: [],
                };
                runtimeObjects.push(linkedListNode);
            }
            else {
                linkedListNode = runtimeObjects[i];
            }
            const nodePath = path + "/" + pluginName + "_" + i;
            const nodePathPrefix = nodePath + ":";
            yield linkedListNode.node.setup(addprefixtologger_1.default(logger, nodePathPrefix), prevTree, plugins[pluginName], pluginConfig.config, nodeNeedsUpdateCallback);
            setupLine(nodePath, logger, linkedListNode.node.treeInterface, pluginConfig.next, plugins, linkedListNode.nextNodes, nodeNeedsUpdateCallback);
        }
        for (let i = configLine.length; i < runtimeObjects.length; ++i) {
            yield destroyRuntimeObject(runtimeObjects[i]);
        }
    });
}
//# sourceMappingURL=recipecooker.js.map