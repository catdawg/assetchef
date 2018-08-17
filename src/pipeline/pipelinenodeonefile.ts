import * as pathutils from "path";
import { VError } from "verror";

import { IPathTreeReadonly } from "../path/ipathtreereadonly";
import { PathChangeEvent, PathEventType } from "../path/pathchangeevent";
import { PathChangeProcessor, ProcessCommitMethod } from "../path/pathchangeprocessor";
import { PathTree } from "../path/pathtree";
import { IPipelineProduct } from "./ipipelineproduct";
import { PipelineNode } from "./pipelinenode";

/**
 * Base implementation for nodes that operate on only one file and don't need to know about other
 * files. Sub classes simply need to implement the cookFile method
 */
export abstract class PipelineNodeOneFileMode<TContent> extends PipelineNode<TContent> {
    private actualTree: PathTree<TContent>;
    private productionTree: PathTree<string[]> = new PathTree<string[]>();
    private eventProcessor: PathChangeProcessor;

    /**
     * Call to run a cycle, calling the cookFile method on each new or changed file.
     */
    public async update(): Promise<void> {

        const fileAddedAndChangedHandler = async (path: string): Promise<ProcessCommitMethod> => {

            const content = this._prevTreeInterface.get(path);
            const result: Array<IPipelineProduct<TContent>> = this.shouldCook(path, content) ?
                await this.cookFile(path, content) :
                [{
                    path,
                    content,
                }];
            return () => {
                const resultPaths = result.map((r) => r.path);
                const pathsToDelete = [];
                const pathsProducedBeforeAndNow = [];

                if (this.productionTree.exists(path)) {
                    for (const previouslyResultingPath of this.productionTree.get(path)) {
                        if (resultPaths.indexOf(previouslyResultingPath) === -1) {
                            pathsToDelete.push(previouslyResultingPath);
                        } else {
                            pathsProducedBeforeAndNow.push(previouslyResultingPath);
                        }
                    }

                    for (const pathToDelete of pathsToDelete) {
                        this.deleteFileAndPurgeEmptyDirectories(pathToDelete);
                    }
                }
                for (const r of result) {
                    if (this.actualTree.exists(r.path) &&
                        pathsProducedBeforeAndNow.indexOf(r.path) === -1) {
                        throw new VError(
                            "Node created the same file from different sources '%s'", r.path);
                    }
                    this.actualTree.set(r.path, r.content);
                }

                this.productionTree.set(path, resultPaths);
            };
        };

        await this.eventProcessor.processAll({
            handleFileAdded: fileAddedAndChangedHandler,
            handleFileChanged: fileAddedAndChangedHandler,
            handleFileRemoved: async (path: string): Promise<ProcessCommitMethod> => {
                return () => {
                    /* istanbul ignore else */ // an unlink should never appear without being added first.
                    if (this.productionTree.exists(path)) {
                        for (const previouslyResultingPath of this.productionTree.get(path)) {
                            this.deleteFileAndPurgeEmptyDirectories(previouslyResultingPath);
                        }
                    }
                };
            },
            handleFolderAdded: async (path): Promise<ProcessCommitMethod> => {
                return () => {
                    if (this.productionTree.exists(path)) {
                        for (const f of this.getAllFilesProducedByFolderRecursively(path)) {
                            this.deleteFileAndPurgeEmptyDirectories(f);
                        }

                        this.productionTree.remove(path);
                    }
                };
            },
            handleFolderRemoved: async (path): Promise<ProcessCommitMethod> => {
                return () => {
                    /* istanbul ignore next */ // an unlink should never appear without being added first.
                    if (!this.productionTree.exists(path)) {
                        return;
                    }

                    for (const f of this.getAllFilesProducedByFolderRecursively(path)) {
                        this.deleteFileAndPurgeEmptyDirectories(f);
                    }

                    this.productionTree.remove(path);
                };
            },
            isDir: async (path): Promise<boolean> => {
                return this._prevTreeInterface.isDir(path);
            },
            list: async (path): Promise<string[]> => {
                return [...this._prevTreeInterface.list(path)];
            },
        });
    }

    /**
     * reset the node, processing everything again.
     */
    public reset(): void {
        this._prevTreeInterfaceChangeQueue.push(new PathChangeEvent(PathEventType.AddDir, ""));
    }

    protected async setupInterface(): Promise<IPathTreeReadonly<TContent>> {
        this.actualTree = new PathTree<TContent>();

        this.eventProcessor = new PathChangeProcessor(this._prevTreeInterfaceChangeQueue);

        return this.actualTree.getReadonlyInterface();
    }

    protected abstract shouldCook(path: string, content: TContent): boolean;

    protected abstract async cookFile(path: string, content: TContent): Promise<Array<IPipelineProduct<TContent>>>;

    private getAllFilesProducedByFolderRecursively(path: string): string[] {
        const filesProduced = [];
        const foldersToProcess = [path];

        while (foldersToProcess.length > 0) {
            const folder = foldersToProcess.pop();
            for (const f of this.productionTree.list(folder)) {
                const fFullPath = pathutils.join(folder, f);
                if (this.productionTree.isDir(fFullPath)) {
                    foldersToProcess.push(fFullPath);
                } else {
                    for (const p of this.productionTree.get(fFullPath)) {
                        filesProduced.push(p);
                    }
                }
            }
        }

        return filesProduced;
    }

    private deleteFileAndPurgeEmptyDirectories(path: string) {
        this.actualTree.remove(path);

        let folder = pathutils.dirname(path);

        if (folder === ".") {
            folder = "";
        }

        while (true) {
            if (this.actualTree.list(folder).next().done && !this._prevTreeInterface.exists(folder)) {
                this.actualTree.remove(folder);
            }

            if (folder === "") {
                break;
            }

            folder = pathutils.dirname(folder);

            if (folder === ".") {
                folder = "";
            }
        }
    }
}
