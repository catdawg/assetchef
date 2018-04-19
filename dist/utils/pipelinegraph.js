"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const verror_1 = require("verror");
const pathtree_1 = require("./path/pathtree");
class PipelineGraph {
    constructor() {
        this.steps = [];
    }
    init(files) {
        const baseStep = new pathtree_1.PathTree();
        for (const f of files) {
            const currentNode = {
                content: f.content,
                produces: null,
                path: f.path,
            };
            baseStep.set(f.path, currentNode);
        }
        this.steps.push(baseStep);
        this.currentStep = 0;
        this.steps.push(new pathtree_1.PathTree());
        this.advanceStep();
    }
    reset() {
        this.currentStep = 0;
    }
    advanceStep() {
        // advance all that weren't processed and that don't have a file in the destination
        {
            const lhs = this.getLhsStep();
            const rhs = this.getRhsStep();
            for (const path of lhs.listAll()) {
                const lhsData = lhs.get(path);
                if (lhsData.produces == null && !rhs.exists(path)) {
                    const dataPassedOver = {
                        content: lhsData.content,
                        produces: null,
                        path,
                    };
                    rhs.set(path, dataPassedOver);
                }
            }
        }
        this.currentStep += 1;
        if (this.steps.length === this.currentStep + 1) {
            const nextStep = new pathtree_1.PathTree();
            this.steps.push(nextStep);
        }
        this.filesProcessed = new Set();
        this.filesProduced = new Set();
    }
    process(pathsToProcess, processCallback) {
        if (processCallback == null) {
            throw new verror_1.VError("Callback can't be null.");
        }
        if (!(pathsToProcess instanceof Array)) {
            pathsToProcess = [pathsToProcess];
        }
        const lhsStep = this.getLhsStep();
        const lhsNodes = [];
        for (const p of pathsToProcess) {
            if (this.filesProcessed.has(p)) {
                throw new verror_1.VError("Each path can only be processed once per step, and %s is more than once.", p);
            }
            if (!lhsStep.exists(p)) {
                throw new verror_1.VError("Path '%s' doesn't exist on current step.", p);
            }
            lhsNodes.push(lhsStep.get(p));
        }
        const lhsFiles = [];
        for (const n of lhsNodes) {
            lhsFiles.push({
                path: n.path,
                content: n.content,
            });
        }
        this.handleProcessResult(lhsNodes, processCallback(lhsFiles));
    }
    *listPathsInFolder(folder) {
        const tree = this.getLhsStep();
        for (const path of tree.list(folder)) {
            const data = tree.get(path);
            yield ({
                path,
                content: data.content,
            });
        }
    }
    *listAllPaths() {
        const tree = this.getLhsStep();
        for (const path of tree.listAll()) {
            const data = tree.get(path);
            yield ({
                path,
                content: data.content,
            });
        }
    }
    getLhsStep() {
        return this.steps[this.currentStep];
    }
    getRhsStep() {
        return this.steps[this.currentStep + 1];
    }
    removeFromRhsOnwards(path) {
        let step = this.currentStep + 1;
        let pathsToRemove = [path];
        while (step < this.steps.length) {
            const newPathsToRemove = [];
            const tree = this.steps[step];
            for (const p of pathsToRemove) {
                if (!tree.exists(p)) {
                    continue;
                }
                const node = tree.get(p);
                if (node.produces == null) {
                    newPathsToRemove.push(p);
                }
                else {
                    newPathsToRemove.push(...node.produces);
                }
                tree.remove(p);
            }
            pathsToRemove = newPathsToRemove;
            step++;
        }
    }
    handleProcessResult(lhsNodes, result) {
        if (result == null) {
            throw new verror_1.VError("Result of process can't be null.");
        }
        const rhsStep = this.getRhsStep();
        if (!(result instanceof Array)) {
            result = [result];
        }
        for (const f of result) {
            if (this.filesProduced.has(f.path)) {
                throw new verror_1.VError("Each path can only be produced once per step, and %s is more than once.", f.path);
            }
            if (rhsStep.exists(f.path)) {
                throw new verror_1.VError("Produced file $s which was already produced by another file.", f.path);
            }
        }
        const producedNodes = [];
        for (const n of lhsNodes) {
            this.removeFromRhsOnwards(n.path);
            if (n.produces != null) {
                for (const p of n.produces) {
                    this.removeFromRhsOnwards(p);
                }
            }
            n.produces = producedNodes;
        }
        for (const newFile of result) {
            const newNode = {
                path: newFile.path,
                content: newFile.content,
                produces: null,
            };
            rhsStep.set(newNode.path, newNode);
            producedNodes.push(newFile.path);
        }
        // from here, no errors can occur.
        for (const p of lhsNodes) {
            this.filesProcessed.add(p.path);
        }
        for (const f of result) {
            this.filesProduced.add(f.path);
        }
    }
}
exports.PipelineGraph = PipelineGraph;
//# sourceMappingURL=pipelinegraph.js.map