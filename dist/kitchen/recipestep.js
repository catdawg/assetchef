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
/**
 * Handles a step inside the recipe.
 * Takes care of directing relevant functions, like update or reset.
 * Manages setup calls using the same plugin to only update config.
 */
class RecipeStep {
    /**
     * Sets up the step. If it was called before, and the plugin is the same
     * object, then it doesn't create a new instance, e.g. so plugins can reload just the config.
     * @param logger the logger instance to use
     * @param prevStepTreeInterface the interface of the previous step
     * @param plugin the plugin
     * @param config the configuration.
     * @param needsProcessingCallback call whenever something changes. Called by the plugin
     */
    setup(logger, prevStepTreeInterface, plugin, config, needsProcessingCallback) {
        return __awaiter(this, void 0, void 0, function* () {
            if (plugin !== this.plugin) {
                this.plugin = plugin;
                this.pluginInstance = this.plugin.createInstance();
            }
            yield this.pluginInstance.setup(logger, config, prevStepTreeInterface, needsProcessingCallback);
            this.treeInterface = this.pluginInstance.treeInterface;
        });
    }
    /**
     * Checks if plugin needs update.
     */
    needsUpdate() {
        return this.pluginInstance.needsUpdate();
    }
    /**
     * Updates the plugin.
     */
    update() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.pluginInstance.update();
        });
    }
    /**
     * Resets the plugin.
     */
    reset() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pluginInstance.reset();
        });
    }
    /**
     * Destroys the plugin.
     */
    destroy() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.pluginInstance.destroy();
        });
    }
}
exports.RecipeStep = RecipeStep;
//# sourceMappingURL=recipestep.js.map