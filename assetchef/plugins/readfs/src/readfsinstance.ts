import minimatch from "minimatch";

import {
    addPrefixToLogger,
    AsyncToSyncPathTree,
    IPathTreeRead,
    IRecipePluginInstance,
    IRecipePluginInstanceSetupParams,
    PathInterfaceCombination,
    PathInterfaceProxy,
    PathRelationship,
    PathUtils} from "@assetchef/pluginapi";

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
     * Part of the IRecipePluginInstance interface. Descendant nodes will connect here.
     */
    public readonly treeInterface: IPathTreeRead<Buffer>;

    private readonly proxy: PathInterfaceProxy<Buffer>;

    private params: IRecipePluginInstanceSetupParams;
    private config: IReadFSPluginConfig;
    private combinator: PathInterfaceCombination<Buffer>;
    private asyncToSyncPathTree: AsyncToSyncPathTree<Buffer>;
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
        if (this.isSetup()) {
            await this.destroy();
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

        this.asyncToSyncPathTree = new AsyncToSyncPathTree(
            addPrefixToLogger(this.params.logger, "asynctosync: "),
            params.projectTree,
            (path, partial) => {
                return this.isPathIncluded(path, partial);
            });

        this.cancelNeededUpdate = this.asyncToSyncPathTree.listenToNeedsUpdate(params.needsProcessingCallback);
        this.combinator = new PathInterfaceCombination<Buffer>(
            this.asyncToSyncPathTree, this.params.prevStepTreeInterface);
        this.proxy.setProxiedInterface(this.combinator);

        this.params.logger.logInfo("setup complete!");
    }

    /**
     * Part of the IRecipePluginInstance interface. Resets the node processings.
     */
    public async reset(): Promise<void> {
        if (!this.isSetup())  {
            return;
        }

        this.asyncToSyncPathTree.reset();
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

        await this.asyncToSyncPathTree.update();

        this.params.logger.logInfo("update finished");
    }

    /**
     * Part of the IRecipePluginInstance interface. Checks if there's the need to run update on this node.
     */
    public needsUpdate(): boolean {
        if (!this.isSetup())  {
            return false;
        }

        return this.asyncToSyncPathTree.needsUpdate();
    }

    /**
     * Part of the IRecipePluginInstance interface. Destroys the node, releasing resources.
     */
    public async destroy(): Promise<void> {
        if (!this.isSetup())  {
            return;
        }
        this.proxy.removeProxiedInterface();
        this.cancelNeededUpdate.cancel();

        this.params.logger.logInfo("destroy complete");
        this.asyncToSyncPathTree = null;
        this.combinator = null;
        this.config = null;
        this.params = null;
    }

    private isSetup() {
        return this.asyncToSyncPathTree != null;
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
