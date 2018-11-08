import * as pathutils from "path";
import { VError } from "verror";

import { ILogger } from "../../plugin/ilogger";
import { IPathChangeEvent, PathEventType } from "../../plugin/ipathchangeevent";
import { IPathTreeReadonly } from "../../plugin/ipathtreereadonly";
import { IRecipePlugin, IRecipePluginInstance } from "../../plugin/irecipeplugin";
import { ISchemaDefinition } from "../../plugin/ischemadefinition";
import { PathChangeProcessingUtils, ProcessCommitMethod } from "../../utils/path/pathchangeprocessingutils";
import { PathChangeQueue } from "../../utils/path/pathchangequeue";
import { PathTree } from "../../utils/path/pathtree";

/**
 * Instance of the plugin base "OneFile". Makes it easier to implement plugin instances that
 * just operate on one file as input. Plugins will then simply implement the abstract methods, cookFile,
 * shouldCook, setupOneFilePlugin, destroyOneFilePlugin
 */
export abstract class OneFilePluginBaseInstance implements IRecipePluginInstance {
    public readonly treeInterface: IPathTreeReadonly<Buffer>;

    private readonly actualTree: PathTree<Buffer>;

    private productionTree: PathTree<string[]>;
    private logger: ILogger;
    private prevTree: IPathTreeReadonly<Buffer>;
    private changeQueue: PathChangeQueue;
    private needsUpdateCallback: () => void;
    private callbackUnlisten: {unlisten: () => void};

    constructor() {
        this.actualTree = new PathTree<Buffer>();
        this.treeInterface = this.actualTree;
        this.productionTree = new PathTree<string[]>();
    }

    public async setup(
        inLogger: ILogger,
        config: any,
        prevStepInterface: IPathTreeReadonly<Buffer>,
        needsUpdateCallback: () => void,
    ): Promise<void> {

        if (inLogger == null) {
            throw new VError("inLogger parameter can't be null");
        }

        if (config == null) {
            throw new VError("config parameter can't be null");
        }

        if (prevStepInterface == null) {
            throw new VError("prevStepInterface parameter can't be null");
        }

        if (needsUpdateCallback == null) {
            throw new VError("needsUpdateCallback parameter can't be null");
        }

        if (this.callbackUnlisten != null) {
            this.callbackUnlisten.unlisten();
        }

        this.logger = inLogger;
        this.prevTree = prevStepInterface;
        this.needsUpdateCallback = needsUpdateCallback;

        this.callbackUnlisten = this.prevTree.listenChanges((e: IPathChangeEvent) => {
            this.changeQueue.push(e);
            this.needsUpdateCallback();
        });

        this.changeQueue = new PathChangeQueue(() => {
            if (this.prevTree.exists("")) {
                this.changeQueue.push({eventType: PathEventType.AddDir, path: ""});
            } else {
                this.changeQueue.push({eventType: PathEventType.UnlinkDir, path: ""});
            }
            this.needsUpdateCallback();
        }, this.logger);

        this.reset();

        await this.setupOneFilePlugin(config);
    }

    /**
     * Part of the IRecipePluginInstance interface. Calling the cookFile/shouldCook method on each new or changed file.
     * And also takes care of cleaning up files that are removed.
     */
    public async update(): Promise<void> {
        if (!this.isSetup()) {
            return; // not setup.
        }
        const fileAddedAndChangedHandler = async (path: string): Promise<ProcessCommitMethod> => {
            const content = this.prevTree.get(path);
            const result = this.shouldCook(path, content) ?
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
                            "Plugin created the same file from different sources '%s'", r.path);
                    }
                    this.actualTree.set(r.path, r.content);
                }

                this.productionTree.set(path, resultPaths);
            };
        };

        await PathChangeProcessingUtils.processOne(this.changeQueue, {
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
                return this.prevTree.isDir(path);
            },
            list: async (path): Promise<string[]> => {
                return [...this.prevTree.list(path)];
            },
        }, this.logger);
    }

    /**
     * Part of the IRecipePluginInstance interface. Checks if there's anything to do.
     */
    public needsUpdate(): boolean {
        if (!this.isSetup()) {
            return false;
        }
        return this.changeQueue.hasChanges();
    }

    /**
     * Part of the IRecipePluginInstance interface. Resets the plugin, processing everything again.
     */
    public async reset(): Promise<void> {
        if (!this.isSetup()) {
            return;
        }
        this.changeQueue.reset();
    }

    /**
     * Part of the IRecipePluginInstance interface. Will call destroyOnFilePlugin method.
     */
    public async destroy(): Promise<void> {
        if (!this.isSetup()) {
            return;
        }
        await this.destroyOneFilePlugin();
        this.callbackUnlisten.unlisten();

        if (this.actualTree.exists("")) {
            this.actualTree.remove("");
        }

        this.logger = null;
        this.needsUpdateCallback = null;
        this.prevTree = null;
        this.callbackUnlisten = null;
        this.changeQueue = null;
    }

    /**
     * Should be implemented by the subclass. Determines if the file should be processed.
     * @param path path to the file
     * @param content the content of the file
     */
    protected abstract shouldCook(path: string, content: Buffer): boolean;

    /**
     * Should be implemented by the subclass. Processes the file, outputing one or more files (or none).
     * @param path the path to the file to be cooked
     * @param content the content of the file
     */
    protected abstract async cookFile(path: string, content: Buffer): Promise<Array<{path: string, content: Buffer}>>;

    /**
     * Should be implemented by the subclass. It should do any initial setup necessary for the plugin.
     * @param config the plugin config
     */
    protected abstract async setupOneFilePlugin(config: any): Promise<void>;

    /**
     * Should be implemented by the subclass. It should clear up any resources used by the plugin.
     */
    protected abstract async destroyOneFilePlugin(): Promise<void>;

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

        /* istanbul ignore next */
        if (folder === ".") {
            folder = "";
        }

        while (true) {
            if (this.actualTree.list(folder).next().done && !this.prevTree.exists(folder)) {
                this.actualTree.remove(folder);
            }

            if (folder === "") {
                break;
            }

            folder = pathutils.dirname(folder);

            /* istanbul ignore next */
            if (folder === ".") {
                folder = "";
            }
        }
    }

    private isSetup(): boolean {
        return this.prevTree != null;
    }
}

/**
 * Base implementation for plugins that operate on only one file and don't need to know about other
 * files. Subclasses should provide a getConfigSchema method and a createTypedBaseInstance implementation.
 * The latter is necessary due to typescript / javascript limitation of not being able to instantiate
 * a type through generics. i.e. just return "new <plugininstance>()""
 */
export abstract class OneFilePluginBase<TInstance extends OneFilePluginBaseInstance> implements IRecipePlugin {
    /**
     * part of the IRecipePlugin interface. Specifies the compatibility level.
     */
    public apiLevel: number = 1;
    /**
     * part of the IRecipePlugin interface. Specifies the config schema.
     */
    public configSchema: ISchemaDefinition = this.getConfigSchema();

    /**
     * part of the IRecipePlugin~ interface. ~Instantiates an instance of this plugin.
     */
    public createInstance(): IRecipePluginInstance {
        return this.createTypedBaseInstance();
    }

    /**
     * Should be implemented by the subclass. Returns the schema for the config.
     */
    protected abstract getConfigSchema(): ISchemaDefinition;

    /**
     * Needed due to typescript not being able to instatiate generic type.
     * Just return a new instance of the type.
     */
    protected abstract createTypedBaseInstance(): TInstance;

}
