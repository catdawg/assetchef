import * as fse from "fs-extra";

import { IFSWatch } from "../watch/ifswatch";
import { IFileInfo } from "./ifileinfo";
import { IPathTreeAsyncReadonly } from "./ipathtreeasyncreadonly";
import { PathUtils } from "./pathutils";

/**
 * Implementation of IPathTreeAsyncReadonly<Buffer> that reads from the
 * filesystem.
 */
export class FSPathTree implements IPathTreeAsyncReadonly<Buffer> {

    /**
     * Specifies the max expected delay for operations.
     * Part of IPathTreeAsyncReadonly
     */
    public delayMs: number = 2500;
    private absolutePath: string;

    /**
     * @param absolutePath the absolutepath in filesystem
     */
    constructor(absolutePath: string) {
        this.absolutePath = absolutePath;
    }

    /**
     * Part of IPathTreeAsyncReadonly
     */
    public async list(path: string): Promise<string[]> {
        return await fse.readdir(PathUtils.join(this.absolutePath, path));
    }

    /**
     * Part of IPathTreeAsyncReadonly
     */
    public async getInfo(path: string): Promise<IFileInfo> {
        return await fse.stat(PathUtils.join(this.absolutePath, path));
    }

    /**
     * Part of IPathTreeAsyncReadonly
     */
    public async get(path: string): Promise<Buffer> {
        return await fse.readFile(PathUtils.join(this.absolutePath, path));
    }
}
