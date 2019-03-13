import { ChangeEmitterOf1, createChangeEmitter } from "change-emitter";
import * as fse from "fs-extra";

import { ICancelWatch, IFSWatch, IFSWatchListener } from "../watch/ifswatch";
import { IPathChangeEvent } from "./ipathchangeevent";
import { IPathTreeAsyncReadonly } from "./ipathtreeasyncreadonly";
import { PathUtils } from "./pathutils";

/**
 * Implementation of IPathTreeAsyncReadonly<Buffer> that reads from the
 * filesystem.
 */
export class FSPathTree implements IPathTreeAsyncReadonly<Buffer> {

    /**
     * Use this watch to listen to changes in the tree.
     * Part of IPathTreeAsyncReadonly
     */
    public fswatch: IFSWatch;
    private absolutePath: string;

    /**
     * @param absolutePath the absolutepath in filesystem
     */
    constructor(absolutePath: string, fswatch: IFSWatch) {
        this.absolutePath = absolutePath;
        this.fswatch = fswatch;
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
    public async getInfo(path: string): Promise<fse.Stats> {
        return await fse.stat(PathUtils.join(this.absolutePath, path));
    }

    /**
     * Part of IPathTreeAsyncReadonly
     */
    public async get(path: string): Promise<Buffer> {
        return await fse.readFile(PathUtils.join(this.absolutePath, path));
    }
}
