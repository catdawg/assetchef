import * as fse from "fs-extra";
import { Stats } from "fs-extra";
import minimatch from "minimatch";
import * as pathutils from "path";

import { IFSWatchListener } from "../plugin/ifswatch";
import { IPathChangeEvent, PathEventType } from "../plugin/ipathchangeevent";
import { IPathTreeReadonly } from "../plugin/ipathtreereadonly";
import { IRecipePluginInstance, IRecipePluginInstanceSetupParams } from "../plugin/irecipeplugin";
import addPrefixToLogger from "../utils/addprefixtologger";
import {
    IPathChangeProcessorHandler,
    PathChangeProcessingUtils,
    ProcessCommitMethod } from "../utils/path/pathchangeprocessingutils";
import { PathChangeQueue } from "../utils/path/pathchangequeue";
import { PathInterfaceCombination } from "../utils/path/pathinterfacecombination";
import { PathInterfaceProxy } from "../utils/path/pathinterfaceproxy";
import { PathTree } from "../utils/path/pathtree";

interface IReadFSPluginConfig {
    include: string[];
    exclude: string[];
    includeRootAsFile: boolean;
}

/* istanbul ignore next */
function populateConfigWithDefaults(config: IReadFSPluginConfig): IReadFSPluginConfig {
    return {
        exclude: config.exclude != null ? config.exclude : [],
        include: config.include != null ? config.include : [],
        includeRootAsFile: config.includeRootAsFile != null ? config.includeRootAsFile : false,
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
    public async setup(
        params: IRecipePluginInstanceSetupParams): Promise<void> {
        if (this.isSetup()) {
            this.destroy();
        }

        this.params = params;
        this.config = populateConfigWithDefaults(params.config);

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

            const fullPath = pathutils.join(this.params.projectPath, path);

            let filecontent: Buffer = null;
            try {
                filecontent = await fse.readFile(fullPath);
            } catch (err) {
                this.params.logger.logWarn("Failed to read %s with err %s", fullPath, err);
                return null;
            }

            return () => {
                // usually an unlinkDir will come, but we put this here just in case
                /* istanbul ignore next */
                if (this.content.exists(path) && this.content.isDir(path)) {
                    this.content.remove(path); // there was a dir before
                }
                this.content.set(path, filecontent);
            };
        };

        const pathRemovedHandler = async (path: string): Promise<ProcessCommitMethod> => {
            return () => {
                // unlinkDir can be handled before all the unlink events under it arrive.
                /* istanbul ignore next */
                if (this.content.exists(path)) {
                    this.content.remove(path);
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
                    // usually an unlink will come, but we put this here just in case
                    /* istanbul ignore next */
                    if (this.content.exists(path)) {
                        this.content.remove(path); // was a file before.
                    }
                    this.content.mkdir(path);
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

                const fullPath = pathutils.join(this.params.projectPath, path);
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

                const fullPath = pathutils.join(this.params.projectPath, path);
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
        if (filePath === "" && this.config.includeRootAsFile && !partial) {
            return true;
        }

        if (filePath === "" && partial) {
            return true;
        }

        let included = false;

        for (const includeMatch of this.includeMatchers) {
            if (includeMatch.match(filePath, partial)) {
                included = true;
                break;
            }
        }

        if (!included) {
            return false;
        }

        for (const excludeMatch of this.excludeMatchers) {
            if (excludeMatch.match(filePath, false)) {
                return false;
            }
        }

        return true;
    }
}
