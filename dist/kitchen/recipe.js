"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const recipestep_1 = require("./recipestep");
class Recipe {
    constructor() {
        this.roots = [];
    }
    setup(logger, recipeConfig) {
        return __awaiter(this, void 0, void 0, function* () {
            yield setupLine(logger, null, recipeConfig.roots, this.roots);
        });
    }
    update() {
        return __awaiter(this, void 0, void 0, function* () {
            for (const root of this.roots) {
                const res = yield update(root);
                if (!res.finished) {
                    return { finished: false };
                }
            }
            return { finished: true };
        });
    }
    destroy() {
        return __awaiter(this, void 0, void 0, function* () {
            for (const root of this.roots) {
                yield destroy(root);
            }
            this.roots = [];
        });
    }
    reset() {
        return __awaiter(this, void 0, void 0, function* () {
            for (const root of this.roots) {
                yield reset(root);
            }
        });
    }
}
exports.Recipe = Recipe;
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
function update(node) {
    return __awaiter(this, void 0, void 0, function* () {
        const res = yield node.node.update();
        if (!res.finished) {
            return { finished: false };
        }
        for (const next of node.nextNodes) {
            const nextRes = yield update(next);
            if (!nextRes.finished) {
                return { finished: false };
            }
        }
        return { finished: true };
    });
}
function destroyRuntimeObject(runtimeObject) {
    return __awaiter(this, void 0, void 0, function* () {
        yield runtimeObject.node.destroy();
    });
}
function setupLine(logger, prevTree, configLine, runtimeObjects) {
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
            yield linkedListNode.node.setup(logger, prevTree, pluginName, pluginConfig);
            setupLine(logger, linkedListNode.node.treeInterface, pluginConfig.next, linkedListNode.nextNodes);
        }
        for (let i = configLine.length; i < runtimeObjects.length; ++i) {
            yield destroyRuntimeObject(runtimeObjects[i]);
        }
    });
}
//# sourceMappingURL=recipe.js.map