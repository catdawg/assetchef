import * as fse from "fs-extra";
import { Stats } from "fs-extra";
import minimatch from "minimatch";

import {
    addPrefixToLogger,
    IFSWatchListener,
    IPathChangeEvent,
    IPathChangeProcessorHandler,
    IPathTreeReadonly,
    IRecipePluginInstance,
    IRecipePluginInstanceSetupParams,
    PathChangeProcessingUtils,
    PathChangeQueue,
    PathEventType,
    PathInterfaceCombination,
    PathInterfaceProxy,
    PathRelationship,
    PathTree,
    PathUtils,
    ProcessCommitMethod} from "@assetchef/pluginapi";

interface IReadFSPluginConfig {
    include: string[];
    exclude: string[];
    path: string;
}

/* istanbul ignore next */
function normalizeConfig(config: IReadFSPluginConfig): IReadFSPluginConfig {
    return {
        exclude: config.exclude != null ? config.exclude.map((s) => PathUtils.normalize(s)) : [],
        include: config.include != null ? config.include.map((s) => PathUtils.normalize(s)) : [],
        path: config.path != null ? PathUtils.normalize(config.path) : "", // will never happen, since path is required
    };
}

/**
 * Plugin instance of the ReadFS plugin.
 * Reads files into the node from the Filesystem.
 */
export class ReadFSPluginInstance implements IRecipePluginInstance {
    /**
     * Methods used for testing.
     */
    public _syncActionForTestingBeforeFileRead: () => Promise<void>;
    public _syncActionForTestingBeforeDirRead: () => Promise<void>;
    public _syncActionForTestingBeforeStat: () => Promise<void>;
    public _syncActionMidProcessing: () => Promise<void>;

    /**
     * Part of the IRecipePluginInstance interface. Descendant nodes will connect here.
     */
    public readonly treeInterface: IPathTreeReadonly<Buffer>;

    /**
     * Part of the IRecipePluginInstance interface. The filesystem watcher for the current project
     * will dispatch all its events here.
     */
    public readonly projectWatchListener: IFSWatchListener = {
        onEvent: (ev) => this.onFSWatchEvent(ev),
        onReset: /* istanbul ignore next */ () =>  {
            this.onFSWatchReset();
        },
    };

    private readonly proxy: PathInterfaceProxy<Buffer>;

    private params: IRecipePluginInstanceSetupParams;
    private config: IReadFSPluginConfig;
    private pathParts: string[];
    private combinator: PathInterfaceCombination<Buffer>;
    private content: PathTree<Buffer>;
    private queue: PathChangeQueue;
    private processing: boolean = false;

    private includeMatchers: minimatch.IMinimatch[];
    private excludeMatchers: minimatch.IMinimatch[];

    public constructor() {
        this.proxy = new PathInterfaceProxy<Buffer>();
        this.treeInterface = this.proxy;
    }

    /**
     * Part of the IRecipePluginInstance interface. Setups the node.
     */
    public async setup(params: IRecipePluginInstanceSetupParams): Promise<void> {
        if (this.isSetup()) {
            await this.destroy();
        }

        this.params = params;
        this.config = normalizeConfig(params.config);
        this.pathParts = PathUtils.split(this.config.path);

        this.includeMatchers = [];
        this.excludeMatchers = [];

        /* istanbul ignore else */
        if (this.config.include != null) {
            for (const match of this.config.include) {
                this.includeMatchers.push(new minimatch.Minimatch(match));
            }
        }

        /* istanbul ignore else */
        if (this.config.exclude != null) {
            for (const match of this.config.exclude) {
                this.excludeMatchers.push(new minimatch.Minimatch(match));
            }
        }

        this.content = new PathTree<Buffer>();
        this.queue = new PathChangeQueue(
            () => this.resetEventProcessing(), addPrefixToLogger(this.params.logger, "pathchangequeue: "));

        this.combinator = new PathInterfaceCombination<Buffer>(this.content, this.params.prevStepTreeInterface);
        this.proxy.setProxiedInterface(this.combinator);

        this.resetEventProcessing();

        this.params.logger.logInfo("setup complete!");
    }

    /**
     * Part of the IRecipePluginInstance interface. Resets the node processings.
     */
    public async reset(): Promise<void> {
        if (!this.isSetup())  {
            return;
        }

        this.queue.reset();
        this.params.logger.logInfo("reset complete!");
    }

    /**
     * Part of the IRecipePluginInstance interface. Processes one filesystem event.
     */
    public async update(): Promise<void> {
        if (!this.isSetup())  {
            return;
        }
        this.params.logger.logInfo("update started");

        const fileAddedAndChangedHandler = async (path: string): Promise<ProcessCommitMethod> => {
            // used for testing readFile error
            if (this._syncActionForTestingBeforeFileRead != null) {
                const syncAction = this._syncActionForTestingBeforeFileRead;
                this._syncActionForTestingBeforeFileRead = null;
                await syncAction();
            }

            if (!this.isPathIncluded(path, false)) {
                return () => {
                    return;
                };
            }

            const fullPath = PathUtils.join(this.params.projectPath, path);

            let filecontent: Buffer = null;
            try {
                filecontent = await fse.readFile(fullPath);
            } catch (err) {
                this.params.logger.logWarn("Failed to read %s with err %s", fullPath, err);
                return null;
            }

            return () => {
                const fixedPath = this.removeConfigPathPartFromPath(path);
                // usually an unlinkDir will come, but we put this here just in case
                /* istanbul ignore next */
                if (this.content.exists(fixedPath) && this.content.isDir(fixedPath)) {
                    this.content.remove(fixedPath); // there was a dir before
                }
                this.content.set(fixedPath, filecontent);
            };
        };

        const pathRemovedHandler = async (path: string): Promise<ProcessCommitMethod> => {
            return () => {
                const fixedPath = this.removeConfigPathPartFromPath(path);
                // unlinkDir can be handled before all the unlink events under it arrive.
                /* istanbul ignore next */
                if (this.content.exists(fixedPath)) {
                    this.content.remove(fixedPath);
                }
            };
        };

        const handler: IPathChangeProcessorHandler = {
            handleFileAdded: fileAddedAndChangedHandler,
            handleFileChanged: fileAddedAndChangedHandler,
            handleFileRemoved: pathRemovedHandler,
            handleFolderAdded: async (path): Promise<ProcessCommitMethod> => {
                return () => {
                    if (!this.isPathIncluded(path, true)) {
                        return;
                    }
                    const fixedPath = this.removeConfigPathPartFromPath(path);
                    // usually an unlink will come, but we put this here just in case
                    /* istanbul ignore next */
                    if (this.content.exists(fixedPath)) {
                        this.content.remove(fixedPath); // was a file before.
                    }
                    this.content.createFolder(fixedPath);
                };
            },
            handleFolderRemoved: pathRemovedHandler,
            isDir: async (path): Promise<boolean> => {
                /// used to test stat exception
                if (this._syncActionForTestingBeforeStat != null) {
                    const syncAction = this._syncActionForTestingBeforeStat;
                    this._syncActionForTestingBeforeStat = null;
                    await syncAction();
                }

                const fullPath = PathUtils.join(this.params.projectPath, path);
                try {
                    const stat = await fse.stat(fullPath);
                    return stat.isDirectory();
                } catch (err) {
                    this.params.logger.logWarn("Failed to stat file %s with err %s", fullPath, err);
                    return null;
                }
            },
            list: async (path): Promise<string[]> => {
                /// used to test readdir exception
                if (this._syncActionForTestingBeforeDirRead != null) {
                    const syncAction = this._syncActionForTestingBeforeDirRead;
                    this._syncActionForTestingBeforeDirRead = null;
                    await syncAction();
                }

                if (!this.isPathIncluded(path, true)) {
                    return [];
                }

                const fullPath = PathUtils.join(this.params.projectPath, path);
                try {
                    return await fse.readdir(fullPath);
                } catch (err) {
                    this.params.logger.logWarn("Failed to read dir %s with err %s", fullPath, err);
                    return null;
                }
            },
        };

        this.processing = true;
        const processSuccessful = await PathChangeProcessingUtils.processOne(
            this.queue, handler, addPrefixToLogger(this.params.logger, "processor: "), this._syncActionMidProcessing);
        this.processing = false;

        /* istanbul ignore next */
        if (!processSuccessful) {
            this.params.logger.logError("processing failed. Resetting...");
            this.queue.reset();
            return;
        }

        this.params.logger.logInfo("update finished");
    }

    /**
     * Part of the IRecipePluginInstance interface. Checks if there's the need to run update on this node.
     */
    public needsUpdate(): boolean {
        if (!this.isSetup())  {
            return false;
        }

        return this.queue.hasChanges();
    }

    /**
     * Part of the IRecipePluginInstance interface. Destroys the node, releasing resources.
     */
    public async destroy(): Promise<void> {
        if (!this.isSetup())  {
            return;
        }
        this.proxy.removeProxiedInterface();

        this.params.logger.logInfo("destroy complete");
        this.queue = null;
        this.combinator = null;
        this.content = null;
        this.config = null;
        this.params = null;
    }

    private isSetup() {
        return this.content != null;
    }

    private onFSWatchEvent(ev: IPathChangeEvent) {
        if (!this.isSetup())  {
            return;
        }
        this.params.logger.logInfo("fs ev %s:'%s'", ev.eventType, ev.path);

        switch (ev.eventType) {
            case PathEventType.Add:
            case PathEventType.Change:
            case PathEventType.Unlink:
                if (!this.isPathIncluded(ev.path, false)) {
                    this.params.logger.logInfo("...ignored");
                    return;
                }
                break;
            case PathEventType.AddDir:
            case PathEventType.UnlinkDir:
                if (!this.isPathIncluded(ev.path, true)) {
                    this.params.logger.logInfo("...ignored");
                    return;
                }
                break;
        }

        this.queue.push(ev);
        this.dispatchNeedsProcessing();
    }

    private onFSWatchReset() {
        if (!this.isSetup())  {
            return;
        }
        this.params.logger.logInfo("fs reset");
        this.resetEventProcessing();
    }

    private resetEventProcessing() {

        let rootStat: Stats = null;

        try {
            rootStat = fse.statSync(this.params.projectPath);
        } catch (e) {
            rootStat = null;
        }

        if (rootStat == null) {
            if (this.content.exists("")) {
                if (this.content.isDir("")) {
                    this.queue.push({eventType: PathEventType.UnlinkDir, path: ""});
                } else {
                    this.queue.push({eventType: PathEventType.Unlink, path: ""});
                }
                this.dispatchNeedsProcessing();
            }
        } else {
            if (this.content.exists("")) {
                if (this.content.isDir("")) {
                    this.queue.push({eventType: PathEventType.UnlinkDir, path: ""});
                } else {
                    this.queue.push({eventType: PathEventType.Unlink, path: ""});
                }
            }

            if (rootStat.isDirectory()) {
                this.queue.push({eventType: PathEventType.AddDir, path: ""});
            } else {
                this.queue.push({eventType: PathEventType.Add, path: ""});
            }
            this.dispatchNeedsProcessing();
        }
    }

    private dispatchNeedsProcessing() {
        if (this.processing) {
            return;
        }
        this.params.needsProcessingCallback();
    }

    private isPathIncluded(filePath: string, partial: boolean): boolean {

        filePath = PathUtils.normalize(filePath);

        const pathRelation = PathUtils.getPathRelationship(this.config.path, filePath);

        switch (pathRelation) {
            case PathRelationship.Different:
                return false;
            case PathRelationship.Equal:
                return true;
            case PathRelationship.Path1DirectlyInsidePath2:
            case PathRelationship.Path1InsidePath2:
                return partial;
            case PathRelationship.Path2DirectlyInsidePath1:
            case PathRelationship.Path2InsidePath1:
                break;
        }

        const filePathWithoutConfigPath = this.removeConfigPathPartFromPath(filePath);

        let included = true;

        for (const includeMatch of this.includeMatchers) {
            included = false;
            if ((includeMatch.match as any)(filePathWithoutConfigPath, partial)) {
                included = true;
                break;
            }
        }

        if (!included) {
            return false;
        }

        for (const excludeMatch of this.excludeMatchers) {
            if ((excludeMatch.match as any)(filePathWithoutConfigPath, false)) {
                return false;
            }
        }

        return true;
    }

    private removeConfigPathPartFromPath(path: string): string {
        return path.substring(
            this.config.path !== "." ? this.config.path.length : 0);
    }
}
