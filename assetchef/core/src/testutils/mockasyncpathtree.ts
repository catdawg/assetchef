import { VError } from "verror";

import { IFileInfo } from "../path/ifileinfo";
import { IPathTreeAsyncReadonly } from "../path/ipathtreeasyncreadonly";
import { IPathTreeReadonly } from "../path/ipathtreereadonly";

export class MockAsyncPathTree<T> implements IPathTreeAsyncReadonly<T> {

    public delayMs: number = 0;

    public throwNextGet: boolean = false;
    public throwNextList: boolean = false;
    public throwNextGetInfo: boolean = false;

    private syncTree: IPathTreeReadonly<T>;

    constructor(syncTree: IPathTreeReadonly<T>) {
        this.syncTree = syncTree;
    }

    public async list(path: string): Promise<string[]> {
        if (this.throwNextList) {
            this.throwNextList = false;
            throw new VError("debugging error");
        }
        return [... this.syncTree.list(path)];
    }

    public async getInfo(path: string): Promise<IFileInfo> {
        if (this.throwNextGetInfo) {
            this.throwNextGetInfo = false;
            throw new VError("debugging error");
        }
        if (!this.syncTree.exists(path)) {
            throw new VError("File doesn't exist");
        }

        const dir = this.syncTree.isDir(path);
        return {
            isFile: () => !dir,
            isDirectory: () => dir,
            size: -1,
            mtimeMs: -1,
            birthtimeMs: -1,
        };
    }

    public async get(path: string): Promise<T> {
        if (this.throwNextGet) {
            this.throwNextGet = false;
            throw new VError("debugging error");
        }
        return this.syncTree.get(path);
    }
}
