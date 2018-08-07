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
const verror_1 = require("verror");
const pathchangeevent_1 = require("../path/pathchangeevent");
const pathchangequeue_1 = require("../path/pathchangequeue");
/**
 * Base class for all nodes in the pipeline.
 */
class PipelineNode {
    /**
     * setup the node so it starts working, this will call setupTree on the subclass, which will set
     * this.tree allowing to setup the next node.
     * @param prevTree the previous tree in the pipeline
     */
    setup(prevTree) {
        return __awaiter(this, void 0, void 0, function* () {
            this._prevTree = prevTree;
            const reset = () => {
                this._prevTreeChangeQueue.push(new pathchangeevent_1.PathChangeEvent(pathchangeevent_1.PathEventType.AddDir, ""));
            };
            this._prevTreeChangeQueue = new pathchangequeue_1.PathChangeQueue(reset);
            this._prevTree.addChangeListener((e) => {
                this._prevTreeChangeQueue.push(e);
            });
            reset();
            this.tree = yield this.setupTree();
            if (this.tree == null) {
                throw new verror_1.VError("Node must setup it's tree.");
            }
        });
    }
}
exports.PipelineNode = PipelineNode;
//# sourceMappingURL=pipelinenode.js.map