import * as pathutils from "path";
import { VError } from "verror";

import { IPathTreeReadonly } from "../path/ipathtreereadonly";
import { PathChangeEvent, PathEventType } from "../path/pathchangeevent";
import { ProcessCommitMethod } from "../path/pathchangeprocessor";
import { PathTree } from "../path/pathtree";
import { IPipelineProduct } from "./ipipelineproduct";
import { PipelineNode } from "./pipelinenode";

/**
 * Base implementation for nodes that operate on only one file and don't need to know about other
 * files. Base classes simply need to implement the cookFile method
 */
export abstract class PipelineNodeOneFileMode<TContent> extends PipelineNode<TContent> {
    private actualTree: PathTree<TContent>;
    private productionTree: PathTree<string[]> = new PathTree<string[]>();

    /**
     * Call to run a cycle, calling the cookFile method on each new or changed file.
     */
    public async update(): Promise<void> {
        await this._prevTreeEventProcessor.process(async (
            event: PathChangeEvent): Promise<ProcessCommitMethod> => {
                switch (event.eventType) {
                    case (PathEventType.Add):
                    case (PathEventType.Change): {
                        const content = this._prevTree.get(event.path);
                        const result: Array<IPipelineProduct<TContent>> = this.shouldCook(event.path, content) ?
                            await this.cookFile(event.path, content) :
                            [{
                                path: event.path,
                                content,
                            }];
                        return () => {
                            const resultPaths = result.map((res) => res.path);
                            const pathsToDelete = [];
                            const pathsProducedBeforeAndNow = [];

                            if (this.productionTree.exists(event.path)) {
                                for (const previouslyResultingPath of this.productionTree.get(event.path)) {
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
                            for (const res of result) {
                                if (this.actualTree.exists(res.path) &&
                                    pathsProducedBeforeAndNow.indexOf(res.path) === -1) {
                                    throw new VError(
                                        "Node created the same file from different sources '%s'", res.path);
                                }
                                this.actualTree.set(res.path, res.content);
                            }

                            this.productionTree.set(event.path, resultPaths);
                        };
                    }
                    case (PathEventType.Unlink): {
                        return () => {
                            /* istanbul ignore else */ // an unlink should never appear without being added first.
                            if (this.productionTree.exists(event.path)) {
                                for (const previouslyResultingPath of this.productionTree.get(event.path)) {
                                    this.deleteFileAndPurgeEmptyDirectories(previouslyResultingPath);
                                }
                            }
                        };
                    }
                    case (PathEventType.UnlinkDir): {
                        return () => {
                            /* istanbul ignore next */ // an unlink should never appear without being added first.
                            if (!this.productionTree.exists(event.path)) {
                                return;
                            }

                            for (const f of this.getAllFilesProducedByFolderRecursively(event.path)) {
                                this.deleteFileAndPurgeEmptyDirectories(f);
                            }

                            this.productionTree.remove(event.path);
                        };
                    }
                    case (PathEventType.AddDir): {

                        const newEvents: PathChangeEvent[] = [];
                        for (const entry of this._prevTree.list(event.path)) {
                            const fullEntryPath = pathutils.join(event.path, entry);
                            if (this._prevTree.isDir(fullEntryPath)) {
                                newEvents.push(new PathChangeEvent(PathEventType.AddDir, fullEntryPath));
                            } else {
                                newEvents.push(new PathChangeEvent(PathEventType.Add, fullEntryPath));
                            }
                        }
                        return () => {
                            if (this.productionTree.exists(event.path)) {
                                for (const f of this.getAllFilesProducedByFolderRecursively(event.path)) {
                                    this.deleteFileAndPurgeEmptyDirectories(f);
                                }

                                this.productionTree.remove(event.path);
                            }

                            for (const ev of newEvents) {
                                this._prevTreeEventProcessor.push(ev);
                            }
                        };
                    }
                }
            });
    }

    public reset(): void {
        this._prevTreeEventProcessor.push(new PathChangeEvent(PathEventType.AddDir, ""));
    }

    protected async setupTree(): Promise<IPathTreeReadonly<TContent>> {
        this.actualTree = new PathTree<TContent>();

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

        while (folder !== ".") {
            if (this.actualTree.list(folder).next().done && !this._prevTree.exists(folder)) {
                this.actualTree.remove(folder);
            }

            folder = pathutils.dirname(folder);
        }
    }
}
