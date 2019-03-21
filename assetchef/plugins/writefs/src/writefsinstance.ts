import * as fse from "fs-extra";
import minimatch from "minimatch";

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

async function getStat(path: string): Promise<fse.Stats> {
    let rootStat: fse.Stats = null;
    try {
        rootStat = await fse.stat(path);
    } catch (e) {
        return null;
    }

    return rootStat;
}

function getStatSync(path: string): fse.Stats {
    let rootStat: fse.Stats = null;
    try {
        rootStat = fse.statSync(path);
    } catch (e) {
        return null;
    }

    return rootStat;
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

        this.queue = new PathChangeQueue(() => {
            this.resetEventProcessing();
        }, addPrefixToLogger(this.params.logger, "pathchangequeue: "));

        this.callbackUnlisten = this.params.prevStepTreeInterface.listenChanges((e: IPathChangeEvent) => {
            this.queue.push(e);
            this.params.needsProcessingCallback();
        });

        this.proxy.setProxiedInterface(this.params.prevStepTreeInterface);

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
     * Part of the IRecipePluginInstance interface. Processes one event.
     */
    public async update(): Promise<void> {
        if (!this.isSetup())  {
            return;
        }
        this.params.logger.logInfo("update started");

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

        return this.queue.hasChanges();
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

    private isSetup() {
        return this.params != null;
    }

    private async handleEv(ev: IPathChangeEvent) {

        if (!this.isPathIncluded(
            ev.path, ev.eventType === PathEventType.AddDir || ev.eventType === PathEventType.UnlinkDir)) {
            return;
        }

        const projectRelativeEvPath = PathUtils.join(this.config.targetPath, ev.path);
        const fullEvPath = PathUtils.join(this.params.projectPath, projectRelativeEvPath);

        switch (ev.eventType) {
            case PathEventType.Add:
            case PathEventType.Change: {

                const stat = await getStat(fullEvPath);

                if (stat != null && stat.isDirectory()) {
                    try {
                        await fse.remove(fullEvPath);
                    } catch (error) /* istanbul ignore next */ {
                        this.params.logger.logError(
                            "failed to remove path '%s' with error '%s'. Resetting write", ev.path, error);
                        this.resetEventProcessing();
                        return;
                    }

                    this.params.logger.logInfo("removed '%s'", projectRelativeEvPath);
                }
                const content = this.params.prevStepTreeInterface.get(ev.path);
                try {
                    await fse.writeFile(fullEvPath, content);
                } catch (error) {
                    this.params.logger.logError(
                        "failed to write file '%s' with error '%s'. Resetting write", ev.path, error);
                    this.resetEventProcessing();
                    return;
                }
                this.params.logger.logInfo("wrote '%s'", projectRelativeEvPath);
                return;
            }
            case PathEventType.AddDir: {
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

                const stat = await getStat(fullEvPath);

                if (stat != null) {
                    try {
                        await fse.remove(fullEvPath);
                    } catch (error) /* istanbul ignore next */ {
                        this.params.logger.logError(
                            "failed to remove path '%s' with error '%s'. Resetting write", ev.path, error);
                        this.resetEventProcessing();
                        return;
                    }
                    this.params.logger.logInfo("removed '%s'", projectRelativeEvPath);
                }

                try {
                    await fse.mkdirs(fullEvPath);
                } catch (error) /* istanbul ignore next */ {
                    this.params.logger.logError(
                        "failed to write dir '%s' with error '%s'. Resetting write", ev.path, error);
                    this.resetEventProcessing();
                    return;
                }
                this.params.logger.logInfo("created dir '%s'", projectRelativeEvPath);

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
                const stat = await getStat(fullEvPath);

                if (stat != null) {
                    try {
                        await fse.remove(fullEvPath);
                    } catch (error) /* istanbul ignore next */ {

                        this.params.logger.logError(
                            "failed to remove path '%s' with error '%s'. Resetting write", ev.path, error);
                        this.resetEventProcessing();
                        return;
                    }
                    this.params.logger.logInfo("removed '%s'", projectRelativeEvPath);
                }
                return;
            }
        }
    }

    private resetEventProcessing() {

        if (this.params.prevStepTreeInterface.exists("")) {
            if (this.params.prevStepTreeInterface.isDir("")) {
                this.queue.push({eventType: PathEventType.AddDir, path: ""});
            } else {
                this.queue.push({eventType: PathEventType.Add, path: ""});
            }
        } else {
            const rootStat = getStatSync(PathUtils.join(this.params.projectPath, this.config.targetPath));

            if (rootStat != null) {
                if (rootStat.isDirectory()) {
                    this.queue.push({eventType: PathEventType.UnlinkDir, path: ""});
                } else {
                    this.queue.push({eventType: PathEventType.Unlink, path: ""});
                }
            }
        }
        this.dispatchNeedsProcessing();
    }

    private dispatchNeedsProcessing() {
        this.params.needsProcessingCallback();
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
