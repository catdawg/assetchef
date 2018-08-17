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
     * setup the node so it starts working, this will call setupInterface on the subclass, which will set
     * this.treeInterface allowing to setup the next node.
     * @param prevInterface the previous tree in the pipeline
     */
    setup(prevInterface) {
        return __awaiter(this, void 0, void 0, function* () {
            this._prevTreeInterface = prevInterface;
            const reset = () => {
                this._prevTreeInterfaceChangeQueue.push(new pathchangeevent_1.PathChangeEvent(pathchangeevent_1.PathEventType.AddDir, ""));
            };
            this._prevTreeInterfaceChangeQueue = new pathchangequeue_1.PathChangeQueue(reset);
            this._prevTreeInterface.addChangeListener((e) => {
                this._prevTreeInterfaceChangeQueue.push(e);
            });
            reset();
            this.treeInterface = yield this.setupInterface();
            if (this.treeInterface == null) {
                throw new verror_1.VError("Node must setup it's tree.");
            }
        });
    }
}
exports.PipelineNode = PipelineNode;
//# sourceMappingURL=pipelinenode.js.map