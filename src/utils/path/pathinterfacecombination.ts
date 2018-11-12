import * as pathutils from "path";
import { VError } from "verror";

import { IPathChangeEvent, PathEventType } from "../../plugin/ipathchangeevent";
import { IPathTreeReadonly } from "../../plugin/ipathtreereadonly";

/**
 * Can combine two interfaces to be accessed as one.
 * For example, if there is a tree that contains a file "folder/file1" and another tree contains
 * "folder/file2", then calling "list" with "folder" will result in "file1" and "file2". If both
 * trees include the same file, then the first tree will take precedence. If one tree includes a file and
 * another includes a folder with the same name, then the first one will take precedence.
 */
export class PathInterfaceCombination<TContent> implements IPathTreeReadonly<TContent> {
    private primaryTree: IPathTreeReadonly<TContent>;
    private secondaryTree: IPathTreeReadonly<TContent>;

    /**
     * Create the combinator.
     * @param primaryTree first tree, everything is checked first on this one, it takes precedence
     * @param secondaryTree second tree
     */
    constructor(primaryTree: IPathTreeReadonly<TContent>, secondaryTree: IPathTreeReadonly<TContent>) {
        if (primaryTree == null || secondaryTree == null) {
            throw new VError("parameters can't be null");
        }
        this.primaryTree = primaryTree;
        this.secondaryTree = secondaryTree;
    }

    /**
     * Part of the readonly interface API, registers the events on both, and triggers changes as one.
     * Ignores events on secondaryTree if they are overridden by primaryTree. The logic for this quite complex,
     * but it is mostly about figuring out if the path meant something before on the combination.
     * E.g. if a path was blocked by the primaryTree (is a file) and on secondaryTree it is a folder and something
     * changes inside, then nothing will be emitted.
     * E.g. if a folder exists in both trees, and it is removed on secondaryTree, then instead of a UnlinkDir event
     * being triggered, a AddDir will be triggered, since the folders aren't merged anymore and the contents
     * need to be reprocessed.
     * @param cb the callback for events
     */
    public listenChanges(cb: (ev: IPathChangeEvent) => void): { unlisten: () => void; } {
        const unlisten1 = this.primaryTree.listenChanges(this.handleEventFromPrimaryTree.bind(this, cb));
        const unlisten2 = this.secondaryTree.listenChanges(this.handleEventFromSecondaryTree.bind(this, cb));
        return {unlisten: () => {
            unlisten1.unlisten();
            unlisten2.unlisten();
        }};
    }

    /**
     * Part of the readonly interface API, lists the contents of a path in both trees.
     * @param path the path to list.
     */
    public *list(path: string): IterableIterator<string> {
        if (!this.exists(path) || !this.isDir(path)) {
            yield this.primaryTree.list(path).next().value; // will throw just like the spec says
        }

        if (this.primaryTree.exists(path)) {
            for (const p of this.primaryTree.list(path)) {
                yield p;
            }
        }

        if (this.secondaryTree.exists(path) && this.secondaryTree.isDir(path)) {
            for (const p of this.secondaryTree.list(path)) {
                const fullPath = pathutils.join(path, p);
                if (this.primaryTree.exists(fullPath)) {
                    continue; // already yielded.
                }
                yield p;
            }
        }
    }

    /**
     * Part of the readonly interface API, lists all entries in both trees.
     */
    public *listAll(): IterableIterator<string> {

        for (const p of this.primaryTree.listAll()) {
            yield p;
        }

        for (const p of this.secondaryTree.listAll()) {
            if (this.primaryTree.exists(p)) {
                continue; // already yielded.
            }

            if (this.doesFirstTreeHaveLeafAncestor(p)) {
                continue;
            }

            yield p;
        }
    }

    /**
     * Part of the readonly interface API, checks if a path is a directory.
     * @param path the path to check
     */
    public isDir(path: string): boolean {
        if (this.primaryTree.exists(path)) {
            return this.primaryTree.isDir(path);
        }
        return this.secondaryTree.isDir(path);
    }

    /**
     * Part of the readonly interface API, checks if a path exists in the combination.
     * @param path the path to check
     */
    public exists(path: string): boolean {
        if (this.primaryTree.exists(path)) {
            return true;
        }

        if (this.secondaryTree.exists(path)) {
            if (this.doesFirstTreeHaveLeafAncestor(path)) {
                return false;
            }
            return true;
        }

        return false;
    }

    /**
     * Part of the readonly interface API, gets the result of a path in the combination.
     * @param path the path to request
     */
    public get(path: string): TContent {
        if (this.primaryTree.exists(path)) {
            return this.primaryTree.get(path);
        }
        return this.secondaryTree.get(path);
    }

    private doesFirstTreeHaveLeafAncestor(path: string): boolean {
        const tokens = path.split(pathutils.sep);

        for (let tokenEndIndex = tokens.length - 1; tokenEndIndex >= 0; --tokenEndIndex) {
            const slicedPath = tokens.slice(0, tokenEndIndex).join(pathutils.sep);

            if (this.primaryTree.exists(slicedPath)) {
                if (this.primaryTree.isDir(slicedPath)) {
                    return false;
                } else {
                    return true; // is overridden by leaf
                }
            }
        }

        return false;
    }

    private handleEventFromPrimaryTree(cb: (ev: IPathChangeEvent) => void, ev: IPathChangeEvent) {
        switch (ev.eventType) {
            case PathEventType.Unlink:
            case PathEventType.UnlinkDir:
                if (this.exists(ev.path)) { // check if second tree is now primary for this path.
                    if (this.isDir(ev.path)) {
                        cb({eventType: PathEventType.AddDir, path: ev.path});
                    } else {
                        cb({eventType: PathEventType.Change, path: ev.path});
                    }
                    return;
                }
            case PathEventType.Add:
            case PathEventType.Change:
            case PathEventType.AddDir:
                cb(ev);
                return;

        }
    }

    private handleEventFromSecondaryTree(cb: (ev: IPathChangeEvent) => void, ev: IPathChangeEvent) {
        switch (ev.eventType) {
            case PathEventType.Add:
            case PathEventType.Change:
                if (this.exists(ev.path) && !this.primaryTree.exists(ev.path)) {
                    cb(ev); // secondaryTree is primary for this path
                }
                return;
            case PathEventType.UnlinkDir:
                if (this.primaryTree.exists(ev.path) && this.primaryTree.isDir(ev.path)) {
                    cb({eventType: PathEventType.AddDir, path: ev.path});  // paths were merged, this will demerge them
                    return;
                }
            case PathEventType.Unlink:
                if (!this.primaryTree.exists(ev.path)) {
                    if (this.doesFirstTreeHaveLeafAncestor(ev.path)) {
                        return; // was a shadowed path
                    }
                    cb(ev);  // primaryTree wasn't shadowing this path.
                } // else primaryTree was primary for this, so we can ignore
                return;
            case PathEventType.AddDir:
                if (!this.exists(ev.path) || !this.isDir(ev.path)) {
                    return; // path is blocked by ancestor in primaryTree or is a file a primaryTree
                }

                cb(ev); // even if the path exists in primaryTree, we the contents are now merged.
                return;

        }
    }
}
