import { AsyncToSyncConverter } from "../../src/path/asynctosyncconverter";
import { IPathTreeRead } from "../../src/path/ipathtreeread";
import { PathTree } from "../../src/path/pathtree";
import { PathUtils } from "../../src/path/pathutils";
import { MockAsyncPathTree } from "../../src/testutils/mockasyncpathtree";
import { winstonlogger } from "../../src/testutils/winstonlogger";

function checkTree<T>(actual: IPathTreeRead<T>, expected: IPathTreeRead<T>) {
    if (expected == null) {
        return; // not important
    }
    const listActual = [...actual.listAll()];
    const listExpected = [...expected.listAll()];

    expect(listActual).toIncludeSameMembers(listExpected);

    listActual.sort();
    listExpected.sort();

    for (const p of listActual) {
        if (actual.isDir(p)) {
            expect(expected.isDir(p)).toBeTrue();
        } else {
            expect(actual.get(p)).toEqual(expected.get(p));
        }
    }
}

describe("asynctosyncconverter", () => {
    it("test basic", async () => {
        const fakedPathTree = new PathTree<string>();
        const fakeAsyncPathTree = new MockAsyncPathTree(fakedPathTree);

        const syncPathTree = new PathTree<string>();
        const asyncToSyncPathTree = new AsyncToSyncConverter<string>(winstonlogger, fakeAsyncPathTree, syncPathTree);

        expect(asyncToSyncPathTree.needsUpdate()).toBeTrue();
        await asyncToSyncPathTree.update();

        expect(asyncToSyncPathTree.needsUpdate()).toBeFalse();
        let updateNeeded = false;
        const cancel = asyncToSyncPathTree.listenToNeedsUpdate(() => updateNeeded = true);

        fakedPathTree.set("file", "content");

        expect(asyncToSyncPathTree.needsUpdate()).toBeTrue();
        expect(updateNeeded).toBeTrue();
        cancel.cancel();

        while (asyncToSyncPathTree.needsUpdate()) {
            await asyncToSyncPathTree.update();
        }

        checkTree(syncPathTree, PathTree.stringTreeFrom( {
            file: "content",
        }));

        expect(syncPathTree.get("file")).toEqual("content");

        const nestedFile1 = PathUtils.join("dir", "file1");
        const nestedFile2 = PathUtils.join("dir", "file2");

        fakedPathTree.set(nestedFile1, "content2");
        fakedPathTree.set(nestedFile2, "content3");

        expect(asyncToSyncPathTree.needsUpdate()).toBeTrue();

        while (asyncToSyncPathTree.needsUpdate()) {
            await asyncToSyncPathTree.update();
        }

        checkTree(syncPathTree, PathTree.stringTreeFrom( {
            file: "content",
            dir: {
                file1: "content2",
                file2: "content3",
            },
        }));

        asyncToSyncPathTree.cancel();

        expect(asyncToSyncPathTree.needsUpdate()).toBeFalse();
        fakedPathTree.set(nestedFile1, "content3");
        expect(asyncToSyncPathTree.needsUpdate()).toBeFalse();
    });

    it("test filter", async () => {
        const fakedPathTree = new PathTree<string>();
        const fakeAsyncPathTree = new MockAsyncPathTree(fakedPathTree);

        const syncPathTree = new PathTree<string>();
        // partial is if the path is not final, example folders
        const asyncToSyncPathTree = new AsyncToSyncConverter<string>(
            winstonlogger, fakeAsyncPathTree, syncPathTree,
            (path, partial) => {
                if (partial) {
                    return !path.startsWith("excluded");
                } else {
                    return !path.endsWith("excluded");
                }
            });

        fakedPathTree.set("file", "content");
        fakedPathTree.set("excluded", "content");
        fakedPathTree.set(PathUtils.join("notexcluded", "file"), "content");
        fakedPathTree.set(PathUtils.join("notexcluded", "excluded"), "content");
        fakedPathTree.set(PathUtils.join("excludeddir", "file"), "content");

        while (asyncToSyncPathTree.needsUpdate()) {
            await asyncToSyncPathTree.update();
        }

        checkTree(syncPathTree, PathTree.stringTreeFrom( {
            file: "content",
            notexcluded: {
                file: "content",
            },
        }));
        asyncToSyncPathTree.cancel();
    });

    it("test get fails", async () => {
        const fakedPathTree = new PathTree<string>();
        const fakeAsyncPathTree = new MockAsyncPathTree(fakedPathTree);

        const syncPathTree = new PathTree<string>();
        const asyncToSyncPathTree = new AsyncToSyncConverter<string>(winstonlogger, fakeAsyncPathTree, syncPathTree);

        fakedPathTree.set("file", "content");

        fakeAsyncPathTree.throwNextGet = true;

        while (asyncToSyncPathTree.needsUpdate()) {
            await asyncToSyncPathTree.update();
        }

        checkTree(syncPathTree, PathTree.stringTreeFrom( {
            file: "content",
        }));
        asyncToSyncPathTree.cancel();
    });

    it("test list fails", async () => {
        const fakedPathTree = new PathTree<string>();
        const fakeAsyncPathTree = new MockAsyncPathTree(fakedPathTree);

        const syncPathTree = new PathTree<string>();
        const asyncToSyncPathTree = new AsyncToSyncConverter<string>(winstonlogger, fakeAsyncPathTree, syncPathTree);

        fakedPathTree.set("file", "content");

        while (asyncToSyncPathTree.needsUpdate()) {
            await asyncToSyncPathTree.update();
        }

        const nestedFile1 = PathUtils.join("dir", "file1");
        const nestedFile2 = PathUtils.join("dir", "file2");

        fakedPathTree.set(nestedFile1, "content2");
        fakedPathTree.set(nestedFile2, "content3");

        fakeAsyncPathTree.throwNextList = true;

        while (asyncToSyncPathTree.needsUpdate()) {
            await asyncToSyncPathTree.update();
        }

        checkTree(syncPathTree, PathTree.stringTreeFrom( {
            file: "content",
            dir: {
                file1: "content2",
                file2: "content3",
            },
        }));
        asyncToSyncPathTree.cancel();
    });

    it("test getInfo fails", async () => {
        const fakedPathTree = new PathTree<string>();
        const fakeAsyncPathTree = new MockAsyncPathTree(fakedPathTree);

        const syncPathTree = new PathTree<string>();
        const asyncToSyncPathTree = new AsyncToSyncConverter<string>(winstonlogger, fakeAsyncPathTree, syncPathTree);

        fakedPathTree.set("file", "content");

        while (asyncToSyncPathTree.needsUpdate()) {
            await asyncToSyncPathTree.update();
        }

        fakedPathTree.set(PathUtils.join("dir", "file"), "content");

        fakeAsyncPathTree.throwNextGetInfo = true;

        while (asyncToSyncPathTree.needsUpdate()) {
            await asyncToSyncPathTree.update();
        }

        checkTree(syncPathTree, PathTree.stringTreeFrom( {
            file: "content",
            dir: {
                file: "content",
            },
        }));
        asyncToSyncPathTree.cancel();
    });

    it("test reset case 1", async () => {
        const fakedPathTree = new PathTree<string>();
        const fakeAsyncPathTree = new MockAsyncPathTree(fakedPathTree);

        const syncPathTree = new PathTree<string>();
        const asyncToSyncPathTree = new AsyncToSyncConverter<string>(winstonlogger, fakeAsyncPathTree, syncPathTree);

        fakedPathTree.set("file", "content");

        while (asyncToSyncPathTree.needsUpdate()) {
            await asyncToSyncPathTree.update();
        }

        asyncToSyncPathTree.reset();

        while (asyncToSyncPathTree.needsUpdate()) {
            await asyncToSyncPathTree.update();
        }

        checkTree(syncPathTree, PathTree.stringTreeFrom( {
            file: "content",
        }));
        asyncToSyncPathTree.cancel();
    });

    it("test reset case 2", async () => {
        const fakedPathTree = new PathTree<string>();
        const fakeAsyncPathTree = new MockAsyncPathTree(fakedPathTree);

        const syncPathTree = new PathTree<string>();
        const asyncToSyncPathTree = new AsyncToSyncConverter<string>(winstonlogger, fakeAsyncPathTree, syncPathTree);

        fakedPathTree.set("", "content");

        while (asyncToSyncPathTree.needsUpdate()) {
            await asyncToSyncPathTree.update();
        }

        fakeAsyncPathTree.resetListen(); // should be the same as asyncToSyncPathTree.reset();

        while (asyncToSyncPathTree.needsUpdate()) {
            await asyncToSyncPathTree.update();
        }

        checkTree(syncPathTree, PathTree.stringTreeFrom("content"));
        asyncToSyncPathTree.cancel();
    });

    it("test reset case 3", async () => {
        const fakedPathTree = new PathTree<string>();
        const fakeAsyncPathTree = new MockAsyncPathTree(fakedPathTree);

        const syncPathTree = new PathTree<string>();
        const asyncToSyncPathTree = new AsyncToSyncConverter<string>(winstonlogger, fakeAsyncPathTree, syncPathTree);

        fakedPathTree.set("", "content");

        while (asyncToSyncPathTree.needsUpdate()) {
            await asyncToSyncPathTree.update();
        }

        fakedPathTree.remove("");

        asyncToSyncPathTree.reset();

        while (asyncToSyncPathTree.needsUpdate()) {
            await asyncToSyncPathTree.update();
        }

        checkTree(syncPathTree, new PathTree());

        fakedPathTree.set("file", "content");

        while (asyncToSyncPathTree.needsUpdate()) {
            await asyncToSyncPathTree.update();
        }
        checkTree(syncPathTree, PathTree.stringTreeFrom( {
            file: "content",
        }));
        asyncToSyncPathTree.cancel();
    });

    it("test reset case 4", async () => {
        const fakedPathTree = new PathTree<string>();
        const fakeAsyncPathTree = new MockAsyncPathTree(fakedPathTree);

        const syncPathTree = new PathTree<string>();
        const asyncToSyncPathTree = new AsyncToSyncConverter<string>(winstonlogger, fakeAsyncPathTree, syncPathTree);

        fakedPathTree.set("file", "content");

        while (asyncToSyncPathTree.needsUpdate()) {
            await asyncToSyncPathTree.update();
        }

        fakedPathTree.remove("");

        asyncToSyncPathTree.reset();

        while (asyncToSyncPathTree.needsUpdate()) {
            await asyncToSyncPathTree.update();
        }

        checkTree(syncPathTree, new PathTree());

        fakedPathTree.set("file", "content");

        while (asyncToSyncPathTree.needsUpdate()) {
            await asyncToSyncPathTree.update();
        }
        checkTree(syncPathTree, PathTree.stringTreeFrom( {
            file: "content",
        }));
        asyncToSyncPathTree.cancel();
    });

    it("test api", async () => {
        const fakedPathTree = new PathTree<string>();
        const fakeAsyncPathTree = new MockAsyncPathTree(fakedPathTree);

        const syncPathTree = new PathTree<string>();
        const asyncToSyncPathTree = new AsyncToSyncConverter<string>(winstonlogger, fakeAsyncPathTree, syncPathTree);

        fakedPathTree.set("file", "content");

        let called = false;
        const cancel = syncPathTree.listenChanges((ev) => {
            called = true;
        });

        while (asyncToSyncPathTree.needsUpdate()) {
            await asyncToSyncPathTree.update();
        }
        expect(called).toBeTrue();
        called = false;

        cancel.unlisten();

        expect(syncPathTree.exists("file")).toBeTrue();
        expect([...syncPathTree.list("")]).toIncludeSameMembers(["file"]);

        fakedPathTree.set("file", "content2");

        while (asyncToSyncPathTree.needsUpdate()) {
            await asyncToSyncPathTree.update();
        }
        expect(called).toBeFalse();
        asyncToSyncPathTree.cancel();
    });
});
