import * as fse from "fs-extra";

import { ILogger } from "../plugin/ilogger";
import { IPathTreeReadonly } from "../plugin/ipathtreereadonly";
import { IRecipePluginInstance } from "../plugin/irecipeplugin";
import { MemDir } from "../utils/fs/memdir";
import { PathInterfaceCombination } from "../utils/path/pathinterfacecombination";
import { PathInterfaceProxy } from "../utils/path/pathinterfaceproxy";

interface IReadFolderPluginConfig {
    path: string;
    include: string[];
    exclude: string[];
}

export class ReadFSPluginInstance implements IRecipePluginInstance {
    public readonly treeInterface: IPathTreeReadonly<Buffer>;

    private readonly proxy: PathInterfaceProxy<Buffer>;

    private config: IReadFolderPluginConfig;
    private logger: ILogger;
    private memDir: MemDir;
    private unlistenOutOfSyncToken: {unlisten: () => void};
    private combinator: PathInterfaceCombination<Buffer>;

    public constructor() {
        this.proxy = new PathInterfaceProxy<Buffer>();
        this.treeInterface = this.proxy;
    }

    public async setup(
        logger: ILogger,
        config: any,
        prevStepInterface: IPathTreeReadonly<Buffer>,
        needsProcessingCallback: () => void): Promise<void> {
        this.config = config;
        this.logger = logger;

        if (this.isSetup()) {
            this.destroy();
        }

        if (this.config.path == null) {
            logger.logError("path configured is null");
            return;
        }

        let pathStat;
        try {
            pathStat = await fse.stat(this.config.path);
        } catch (e) {
            logger.logError("path '%s' not found.", this.config.path);
            return;
        }

        if (!pathStat.isDirectory) {
            logger.logError("path '%s' is a file, it should be a directory.", this.config.path);
            return;
        }

        const memDir = new MemDir(this.config.path, null);
        this.memDir = memDir;

        this.unlistenOutOfSyncToken = this.memDir.listenOutOfSync(() => {
            if (this.memDir === memDir) { // if it is setup again, it won't trigger anymore
                needsProcessingCallback();
            }
        });

        this.combinator = new PathInterfaceCombination<Buffer>(this.memDir.content, prevStepInterface);
        this.proxy.setProxiedInterface(this.combinator);

        this.memDir.start();
    }

    public async reset(): Promise<void> {
        if (!this.isSetup())  {
            return;
        }

        this.memDir.reset();
    }

    public async update(): Promise<void> {
        if (!this.isSetup())  {
            return;
        }

        await this.memDir.syncOne();
    }

    public needsUpdate(): boolean {
        if (!this.isSetup())  {
            return false;
        }

        return this.memDir.isOutOfSync();
    }

    public async destroy(): Promise<void> {
        if (!this.isSetup())  {
            return;
        }
        this.memDir.stop();
        this.unlistenOutOfSyncToken.unlisten();
        this.proxy.removeProxiedInterface();

        this.memDir = null;
        this.combinator = null;
        this.config = null;
        this.logger = null;
        this.unlistenOutOfSyncToken = null;
    }

    private isSetup() {
        return this.memDir != null;
    }
}
