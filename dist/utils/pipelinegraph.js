/*import * as pathutils from "path";
import { VError } from "verror";

import * as logger from "./logger";
import { PathChangeEvent, PathEventType } from "./path/pathchangeevent";
import { PathChangeProcessor } from "./path/pathchangeprocessor";
import { PathTree } from "./path/pathtree";

export interface IFile<TContent> {
    path: string;
    content: TContent;
}

interface INode<TContent> {
    path: string;
    content: TContent;
    produces: string[];
}

type ProcessCallback<TContent> = (filesToProcess: Array<IFile<TContent>>) => Array<IFile<TContent>> | IFile<TContent>;

interface IStep<TContent> {
    tree: PathTree<INode<TContent>>;
    processor?: PathChangeProcessor;
    index: number;
}

export enum StepMode {
    OneFileInput = "OneFileInput",
    FolderInput = "FolderInput",
}

export type IFileProductionInput

export interface IFileProduction<TContent> {
    from: Array<IFile<TContent>> | IFile<TContent> | null;
    to: Array<IFile<TContent>> | IFile<TContent> | null;
}

export type OneFileInputCallback<TContent> = (file: IFile<TContent>) => Promise<IFileProduction<TContent>>;
export type FolderFileInputCallback<TContent> = (filesInFolder: IFile<TContent>) => Promise<IFileProduction<TContent>>;

export interface IStepConfig<TContent> {
    mode: StepMode;
    processCallback: OneFileInputCallback<TContent> | FolderFileInputCallback<TContent>;
}

abstract class PipelineStep<TContent> {
    public readonly tree: PathTree<INode<TContent>>;
    public readonly stepAfter: PipelineStep<TContent>;

    private readonly processor: PathChangeProcessor;

    constructor(stepAfter: PipelineStep<TContent>) {
        this.stepAfter = stepAfter;
        this.tree = new PathTree<INode<TContent>>();
        const reset = () => {
            this.processor.push(new PathChangeEvent(PathEventType.AddDir, ""));
        };

        this.processor = new PathChangeProcessor(reset);
        this.tree.addListener("treechanged", this.processor.push);
    }
}

abstract class PipelineProcessingStep extends

class FileModePipelineStep<TContent> extends PipelineStep<TContent> {
    public constructor(stepAfter: PipelineStep<TContent>) {
        super(stepAfter);
    }
}

export class PipelineGraph<TContent> {
    private currentStep: number;
    private filesProcessed: Set<string>;
    private filesProduced: Set<string>;

    private startTree: PathTree<IFile<TContent>>;
    private steps: Array<IStep<TContent>> = [];

    public init(startTree: PathTree<IFile<TContent>>, config: IStepConfig[]) {
        this.setup(startTree);
        this.steps.push({tree: start, processor: new PathChangeProcessor()})

        const baseStep: PathTree<INode<TContent>> = new PathTree<INode<TContent>>();

        for (const f of start.listAll()) {
            const currentNode: INode<TContent> = {
                content: start.get(f).content,
                produces: null,
                path: f,
            };
            baseStep.set(f.path, currentNode);
        }
        this.steps.push(baseStep);
        this.currentStep = 0;

        this.steps.push(new PathTree<INode<TContent>>());

        this.advanceStep();
    }

    private setup(startTree: PathTree<IFile<TContent>>) {
        this.startTree = startTree;

        this.startTree.addListener("treechanged", (e) => {

        });
    }

    private addStep(prevTree: PathTree<INode<TContent>>) {
        let processor: PathChangeProcessor = null;

        const reset = () => {
            processor.push(new PathChangeEvent(PathEventType.AddDir, ""));
        };

        processor = new PathChangeProcessor(reset);
        prevTree.addListener("treechanged", processor.push);
    }

    public reset() {
        this.currentStep = 0;
    }

    public advanceStep() {
        // advance all that weren't processed and that don't have a file in the destination
        {
            const lhs = this.getLhsStep();
            const rhs = this.getRhsStep();

            for (const path of lhs.listAll()) {
                const lhsData = lhs.get(path);

                if (lhsData.produces == null && !rhs.exists(path)) {
                    const dataPassedOver: INode<TContent> = {
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
            const nextStep: PathTree<INode<TContent>> = new PathTree<INode<TContent>>();
            this.steps.push(nextStep);
        }
        this.filesProcessed = new Set<string>();
        this.filesProduced = new Set<string>();
    }

    public process(pathsToProcess: string | string[], processCallback: ProcessCallback<TContent>): void {
        if (processCallback == null) {
            throw new VError("Callback can't be null.");
        }

        if (!(pathsToProcess instanceof Array)) {
            pathsToProcess = [pathsToProcess as string];
        }

        const lhsStep = this.getLhsStep();

        const lhsNodes: Array<INode<TContent>> = [];
        for (const p of pathsToProcess) {
            if (this.filesProcessed.has(p)) {
                throw new VError("Each path can only be processed once per step, and %s is more than once.", p);
            }

            if (!lhsStep.exists(p)) {
                throw new VError("Path '%s' doesn't exist on current step.", p);

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

    public *listPathsInFolder(folder: string): IterableIterator<IFile<TContent>> {
        const tree = this.getLhsStep();

        for (const path of tree.list(folder)) {
            const data = tree.get(path);

            yield({
                path,
                content: data.content,
            });
        }
    }

    public *listAllPaths(): IterableIterator<IFile<TContent>> {
        const tree = this.getLhsStep();

        for (const path of tree.listAll()) {
            const data = tree.get(path);

            yield({
                path,
                content: data.content,
            });
        }
    }

    private getLhsStep(): PathTree<INode<TContent>> {
        return this.steps[this.currentStep];
    }

    private getRhsStep(): PathTree<INode<TContent>> {
        return this.steps[this.currentStep + 1];
    }

    private removeFromRhsOnwards(path: string) {
        let step = this.currentStep + 1;

        let pathsToRemove = [path];
        while (step < this.steps.length) {

            const newPathsToRemove: string[] = [];
            const tree = this.steps[step];
            for (const p of pathsToRemove) {
                if (!tree.exists(p)) {
                    continue;
                }
                const node = tree.get(p);
                if (node.produces == null) {
                    newPathsToRemove.push(p);
                } else {
                    newPathsToRemove.push(...node.produces);
                }

                tree.remove(p);
            }

            pathsToRemove = newPathsToRemove;
            step++;
        }
    }

    private handleProcessResult(lhsNodes: Array<INode<TContent>>, result: Array<IFile<TContent>> | IFile<TContent>) {
        if (result == null) {
            throw new VError("Result of process can't be null.");
        }

        const rhsStep = this.getRhsStep();

        if (!(result instanceof Array)) {
            result = [result as IFile<TContent>];
        }

        for (const f of result) {
            if (this.filesProduced.has(f.path)) {
                throw new VError("Each path can only be produced once per step, and %s is more than once.", f.path);
            }

            if (rhsStep.exists(f.path)) {
                throw new VError("Produced file $s which was already produced by another file.", f.path);
            }
        }

        const producedNodes: string[] = [];

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
            const newNode: INode<TContent> = {
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
*/
//# sourceMappingURL=pipelinegraph.js.map