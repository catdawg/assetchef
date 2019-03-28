import { VError } from "verror";

import { ChangeEmitter, createChangeEmitter } from "change-emitter";
import { IFileInfo } from "../path/ifileinfo";
import { IAsyncTreeChangeListener, IPathTreeAsyncRead } from "../path/ipathtreeasyncread";
import { IPathTreeAsyncWrite } from "../path/ipathtreeasyncwrite";
import { IPathTreeRead } from "../path/ipathtreeread";
import { IPathTreeWrite } from "../path/ipathtreewrite";
import { PathUtils } from "../path/pathutils";

export class MockAsyncPathTree<T> implements IPathTreeAsyncRead<T>, IPathTreeAsyncWrite<T> {

    public delayMs: number = 0;

    public throwNextGet: boolean = false;
    public throwNextList: boolean = false;
    public throwNextGetInfo: boolean = false;

    private syncTree: IPathTreeRead<T> & IPathTreeWrite<T>;
    private resetEmitter: ChangeEmitter;

    constructor(syncTree: IPathTreeRead<T> & IPathTreeWrite<T>) {
        this.syncTree = syncTree;
        this.resetEmitter = createChangeEmitter();
    }

    public listenChanges(delegate: IAsyncTreeChangeListener): { unlisten: () => void; } {
        const cancel = this.syncTree.listenChanges(delegate.onEvent);
        const cancel2 = this.resetEmitter.listen(delegate.onReset);

        return {
            unlisten: () => {
                cancel.unlisten();
                cancel2();
            },
        };
    }

    public resetListen() {
        this.resetEmitter.emit();
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

    public async remove(path: string): Promise<void> {
        this.syncTree.remove(path);
    }
    public async set(path: string, content: T): Promise<void> {
        const parent = this.getParent(path);
        if (parent != null && !this.syncTree.exists(parent)) {
            throw new VError("can't set to '%s', parent doesn't exist", path);
        }
        this.syncTree.set(path, content);
    }
    public async createFolder(path: string): Promise<void> {
        const parent = this.getParent(path);
        if (parent != null && !this.syncTree.exists(parent)) {
            throw new VError("can't create folder '%s', parent doesn't exist", path);
        }
        this.syncTree.createFolder(path);
    }

    private getParent(path: string): string {
        path = path.trim();
        if (path === "" || path === ".") {
            return null;
        }
        const pathSplit = PathUtils.split(path);
        pathSplit.pop();
        return PathUtils.join(...pathSplit);
    }
}
