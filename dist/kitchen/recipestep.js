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
function requireUncached(module) {
    delete require.cache[require.resolve(module)];
    return require(module);
}
class RecipeStep {
    setup(logger, prevStepTreeInterface, pluginName, config) {
        return __awaiter(this, void 0, void 0, function* () {
            this._plugin = requireUncached(pluginName);
            this.treeInterface = yield this._plugin.setup(logger, config, prevStepTreeInterface);
        });
    }
    update() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this._plugin.update();
        });
    }
    reset() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this._plugin.reset();
        });
    }
    destroy() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this._plugin.destroy();
        });
    }
}
exports.RecipeStep = RecipeStep;
//# sourceMappingURL=recipestep.js.map