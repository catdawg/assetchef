import minimatch from "minimatch";
import { VError } from "verror";

import {
    addPrefixToLogger,
    IPathChangeEvent,
    IPathTreeRead,
    IRecipePluginInstance,
    IRecipePluginInstanceSetupParams,
    PathChangeQueue,
    PathEventType,
    PathInterfaceProxy,
    PathUtils,
} from "@assetchef/pluginapi";

interface IWriteFSPluginConfig {
    targetPath: string;
    include: string[];
    exclude: string[];
}

/* istanbul ignore next */
function populateConfigWithDefaults(config: IWriteFSPluginConfig): IWriteFSPluginConfig {
    return {
        targetPath: config.targetPath != null ? PathUtils.normalize(config.targetPath) : null,
        exclude: config.exclude != null ? config.exclude.map((s) => PathUtils.normalize(s)) : [],
        include: config.include != null ? config.include.map((s) => PathUtils.normalize(s)) : [],
    };
}

/**
 * Plugin instance of the WriteFS plugin.
 * Writes files into the Filesystem.
 */
export class WriteFSPluginInstance implements IRecipePluginInstance {
    /**
     * Part of the IRecipePluginInstance interface. Descendant nodes will connect here.
     */
    public readonly treeInterface: IPathTreeRead<Buffer>;

    private readonly proxy: PathInterfaceProxy<Buffer>;

    private params: IRecipePluginInstanceSetupParams;
    private config: IWriteFSPluginConfig;
    private queue: PathChangeQueue;
    private callbackUnlisten: {unlisten: () => void};

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
            await this.destroy();
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

        this.callbackUnlisten = this.params.prevStepTreeInterface.listenChanges((e: IPathChangeEvent) => {
            if (this.queue != null) {
                this.queue.push(e);
            }
            this.params.needsProcessingCallback();
        });

        this.proxy.setProxiedInterface(this.params.prevStepTreeInterface);

        this.params.logger.logInfo("setup complete!");
    }

    /**
     * Part of the IRecipePluginInstance interface. Resets the node processings.
     */
    public async reset(): Promise<void> {
        if (!this.isSetup())  {
            return;
        }

        this.queue = null;
        this.params.needsProcessingCallback();
        this.params.logger.logInfo("reset complete!");
    }

    /**
     * Part of the IRecipePluginInstance interface. Processes one event.
     */
    public async update(): Promise<void> {
        if (!this.isSetup())  {
            return;
        }
        this.params.logger.logInfo("update started");

        if (this.queue == null) {
            await this.createQueue();
        }

        if (this.queue.hasChanges()) {
            const ev = this.queue.peek();
            const stageHandler = this.queue.stage(ev);
            stageHandler.finishProcessingStagedEvent();

            await this.handleEv(ev);
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

        return this.queue == null || this.queue.hasChanges();
    }

    /**
     * Part of the IRecipePluginInstance interface. Destroys the node, releasing resources.
     */
    public async destroy(): Promise<void> {
        if (!this.isSetup())  {
            return;
        }
        this.callbackUnlisten.unlisten();
        this.proxy.removeProxiedInterface();

        this.params.logger.logInfo("destroy complete");
        this.queue = null;
        this.config = null;
        this.params = null;
        this.callbackUnlisten = null;
    }

    private async createQueue() {

        this.queue = new PathChangeQueue(() => {
            this.reset();
        }, addPrefixToLogger(this.params.logger, "pathchangequeue: "));

        if (this.params.prevStepTreeInterface.exists("")) {
            if (this.params.prevStepTreeInterface.isDir("")) {
                this.queue.push({eventType: PathEventType.AddDir, path: ""});
            } else {
                this.queue.push({eventType: PathEventType.Add, path: ""});
            }
        } else {

            const stat = await (async () => {
                try {
                    return await this.params.projectTree.getInfo("");
                } catch (e) {
                    return null;
                }
            })();
            if (stat != null) {
                if (stat.isDirectory()) {
                    this.queue.push({eventType: PathEventType.UnlinkDir, path: ""});
                } else {
                    this.queue.push({eventType: PathEventType.Unlink, path: ""});
                }
            }
        }
        this.dispatchNeedsProcessing();

    }

    private isSetup() {
        return this.params != null;
    }

    private async handleEv(ev: IPathChangeEvent) {

        if (!this.isPathIncluded(
            ev.path, ev.eventType === PathEventType.AddDir || ev.eventType === PathEventType.UnlinkDir)) {
            return;
        }

        const fullEvPath = PathUtils.join(this.config.targetPath, ev.path);

        const stat = await (async () => {
            try {
                return await this.params.projectTree.getInfo(fullEvPath);
            } catch (e) {
                return null;
            }
        })();
        switch (ev.eventType) {
            case PathEventType.Add:
            case PathEventType.Change: {

                if (ev.path === "") {
                    try {
                        await this.recursivelyCreateTarget();
                    } catch (error) {
                        this.params.logger.logError(
                            "failed to write file '%s' with error '%s'. Resetting write", ev.path, error);
                        this.reset();
                        return;
                    }
                }
                if (stat != null && stat.isDirectory()) {
                    try {
                        await this.params.projectTree.remove(fullEvPath);
                    } catch (error) /* istanbul ignore next */ {
                        this.params.logger.logError(
                            "failed to remove path '%s' with error '%s'. Resetting write", ev.path, error);
                        this.reset();
                        return;
                    }

                    this.params.logger.logInfo("removed '%s'", fullEvPath);
                }
                const content = this.params.prevStepTreeInterface.get(ev.path);
                try {
                    await this.params.projectTree.set(fullEvPath, content);
                } catch (error) {
                    this.params.logger.logError(
                        "failed to write file '%s' with error '%s'. Resetting write", ev.path, error);
                    this.reset();
                    return;
                }
                this.params.logger.logInfo("wrote '%s'", fullEvPath);
                return;
            }
            case PathEventType.AddDir: {

                if (ev.path === "") {
                    try {
                        await this.recursivelyCreateTarget();
                    } catch (error) {
                        this.params.logger.logError(
                            "failed to write file '%s' with error '%s'. Resetting write", ev.path, error);
                        this.reset();
                        return;
                    }
                }
                const pathsUnder = [...this.params.prevStepTreeInterface.list(ev.path)];

                const filesUnder = [];
                const foldersUnder = [];

                for (const p of pathsUnder) {
                    const p2 = PathUtils.join(ev.path, p);
                    if (this.params.prevStepTreeInterface.isDir(p2)) {
                        if (this.isPathIncluded(p2, true)) {
                            foldersUnder.push(p2);
                        }
                    } else {
                        if (this.isPathIncluded(p2, false)) {
                            filesUnder.push(p2);
                        }
                    }
                }

                if (stat != null) {
                    try {
                        await this.params.projectTree.remove(fullEvPath);
                    } catch (error) /* istanbul ignore next */ {
                        this.params.logger.logError(
                            "failed to remove path '%s' with error '%s'. Resetting write", ev.path, error);
                        this.reset();
                        return;
                    }
                    this.params.logger.logInfo("removed '%s'", fullEvPath);
                }

                try {
                    await this.params.projectTree.createFolder(fullEvPath);
                } catch (error) /* istanbul ignore next */ {
                    this.params.logger.logError(
                        "failed to write dir '%s' with error '%s'. Resetting write", ev.path, error);
                    this.reset();
                    return;
                }
                this.params.logger.logInfo("created dir '%s'", fullEvPath);

                for (const p of filesUnder) {
                    this.queue.push({path: p, eventType: PathEventType.Add});
                }
                for (const p of foldersUnder) {
                    this.queue.push({path: p, eventType: PathEventType.AddDir});
                }
                return;
            }
            case PathEventType.UnlinkDir:
            case PathEventType.Unlink: {
                if (stat != null) {
                    try {
                        await this.params.projectTree.remove(fullEvPath);
                    } catch (error) /* istanbul ignore next */ {

                        this.params.logger.logError(
                            "failed to remove path '%s' with error '%s'. Resetting write", ev.path, error);
                        this.reset();
                        return;
                    }
                    this.params.logger.logInfo("removed '%s'", fullEvPath);
                }
                return;
            }
        }
    }

    private dispatchNeedsProcessing() {
        this.params.needsProcessingCallback();
    }

    private async recursivelyCreateTarget() {
        let tokens = PathUtils.split(this.config.targetPath);
        tokens = tokens.reverse();
        tokens.push("");

        let p = "";
        while (tokens.length > 1) {
            p = PathUtils.join(p, tokens.pop());

            const stat = await (async () => {
                try {
                    return await this.params.projectTree.getInfo(p);
                } catch (e) {
                    return null;
                }
            })();

            if (stat == null) {
                await this.params.projectTree.createFolder(p);
            } else if (stat.isFile()) {
                throw new VError("path %s is not a directory.", p);
            }
        }
    }

    private isPathIncluded(filePath: string, partial: boolean): boolean {
        if (filePath === "" && partial) {
            return true;
        }

        let included = true;

        for (const includeMatch of this.includeMatchers) {
            included = false;
            if ((includeMatch.match as any)(filePath, partial)) {
                included = true;
                break;
            }
        }

        if (!included) {
            return false;
        }

        for (const excludeMatch of this.excludeMatchers) {
            if ((excludeMatch.match as any)(filePath, false)) {
                return false;
            }
        }

        return true;
    }
}
