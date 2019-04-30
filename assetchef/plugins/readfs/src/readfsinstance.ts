import minimatch from "minimatch";

import {
    addPrefixToLogger,
    AsyncToSyncConverter,
    IPathTreeRead,
    IRecipePluginInstance,
    IRecipePluginInstanceSetupParams,
    PathInterfaceCombination,
    PathInterfaceProxy,
    PathRelationship,
    PathTree,
    PathUtils} from "@assetchef/pluginapi";

interface IReadFSPluginConfig {
    include: string[];
    exclude: string[];
    path: string;
}

/* istanbul ignore next */
function normalizeConfig(config: IReadFSPluginConfig): IReadFSPluginConfig {
    const path = config.path != null ? PathUtils.normalize(config.path) : ""; // path should never be null
    return {
        exclude: config.exclude != null ? config.exclude.map((s) => PathUtils.normalize(s)) : [],
        include: config.include != null ? config.include.map((s) => PathUtils.normalize(s)) : [],
        path: path !== "." ? path : "",
    };
}

/**
 * Plugin instance of the ReadFS plugin.
 * Reads files into the node from the Filesystem.
 */
export class ReadFSPluginInstance implements IRecipePluginInstance {

    /**
     * Part of the IRecipePluginInstance interface. Descendant nodes will connect here.
     */
    public readonly treeInterface: IPathTreeRead<Buffer>;

    private readonly proxy: PathInterfaceProxy<Buffer>;

    private params: IRecipePluginInstanceSetupParams;
    private config: IReadFSPluginConfig;
    private combinator: PathInterfaceCombination<Buffer>;
    private content: PathTree<Buffer>;
    private asyncToSyncConverter: AsyncToSyncConverter<Buffer>;
    private cancelNeededUpdate: {cancel: () => void};

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
        if (this.params != null) {
            this.destroy();
        }

        this.params = params;
        this.config = normalizeConfig(params.config);

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
        this.asyncToSyncConverter = new AsyncToSyncConverter(
            addPrefixToLogger(this.params.logger, "asynctosync: "),
            params.projectTree,
            this.content,
            this.config.path,
            (path: string, partial: boolean) => {
                return this.isPathIncluded(path, partial);
            });

        this.cancelNeededUpdate = this.asyncToSyncConverter.listenToNeedsUpdate(params.needsProcessingCallback);
        this.combinator = new PathInterfaceCombination<Buffer>(
            this.content, this.params.prevStepTreeInterface);
        this.proxy.setProxiedInterface(this.combinator);

        this.params.logger.logInfo("setup complete!");
    }

    /**
     * Part of the IRecipePluginInstance interface. Resets the node processings.
     */
    public async reset(): Promise<void> {
        this.asyncToSyncConverter.reset();
        this.params.logger.logInfo("reset complete!");
    }

    /**
     * Part of the IRecipePluginInstance interface. Processes one filesystem event.
     */
    public async update(): Promise<void> {
        this.params.logger.logInfo("update started");

        await this.asyncToSyncConverter.update();

        this.params.logger.logInfo("update finished");
    }

    /**
     * Part of the IRecipePluginInstance interface. Checks if there's the need to run update on this node.
     */
    public needsUpdate(): boolean {
        return this.asyncToSyncConverter.needsUpdate();
    }

    /**
     * Part of the IRecipePluginInstance interface. Destroys the node, releasing resources.
     */
    public async destroy(): Promise<void> {
        this.proxy.removeProxiedInterface();
        this.cancelNeededUpdate.cancel();

        this.params.logger.logInfo("destroy complete");
        this.asyncToSyncConverter = null;
        this.combinator = null;
        this.config = null;
        this.params = null;
    }

    private isPathIncluded(filePath: string, partial: boolean): boolean {

        filePath = PathUtils.normalize(filePath);

        filePath = filePath === "." ? "" : filePath;

        if (filePath === this.config.path && partial) {
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
