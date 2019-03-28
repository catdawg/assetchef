import * as fse from "fs-extra";

import { IFSWatch } from "../watch/ifswatch";
import { IFileInfo } from "./ifileinfo";
import { IAsyncTreeChangeListener, IPathTreeAsyncRead } from "./ipathtreeasyncread";
import { IPathTreeAsyncWrite } from "./ipathtreeasyncwrite";
import { PathUtils } from "./pathutils";

/**
 * Implementation of IPathTreeAsyncRead<Buffer> that reads from the
 * filesystem.
 */
export class FSPathTree implements IPathTreeAsyncRead<Buffer>, IPathTreeAsyncWrite<Buffer> {
    /**
     * Specifies the max expected delay for operations.
     * Part of IPathTreeAsyncRead
     */
    public delayMs: number = 2500;
    private absolutePath: string;
    private fsWatch: IFSWatch;

    /**
     * @param absolutePath the absolutepath in filesystem
     */
    constructor(absolutePath: string, fsWatch: IFSWatch) {
        this.absolutePath = absolutePath;
        this.fsWatch = fsWatch;
    }

    public listenChanges(delegate: IAsyncTreeChangeListener): { unlisten: () => void; } {
        return this.fsWatch.addListener(delegate);
    }

    /**
     * Part of IPathTreeAsyncRead
     */
    public async list(path: string): Promise<string[]> {
        return await fse.readdir(PathUtils.join(this.absolutePath, path));
    }

    /**
     * Part of IPathTreeAsyncRead
     */
    public async getInfo(path: string): Promise<IFileInfo> {
        return await fse.stat(PathUtils.join(this.absolutePath, path));
    }

    /**
     * Part of IPathTreeAsyncRead
     */
    public async get(path: string): Promise<Buffer> {
        return await fse.readFile(PathUtils.join(this.absolutePath, path));
    }

    /**
     * Part of IPathTreeAsyncWrite
     * @param path the path to remove
     */
    public async remove(path: string): Promise<void> {
        return await fse.remove(PathUtils.join(this.absolutePath, path));
    }

    /**
     * Part of IPathTreeAsyncWrite
     * @param path the path to set
     * @param content the content to set
     */
    public async set(path: string, content: Buffer): Promise<void> {
        return await fse.writeFile(PathUtils.join(this.absolutePath, path), content);
    }

    /**
     * Part of IPathTreeAsyncWrite
     * @param path the path to set
     * @param content the content to set
     */
    public async createFolder(path: string): Promise<void> {
        return await fse.mkdir(PathUtils.join(this.absolutePath, path));
    }
}
