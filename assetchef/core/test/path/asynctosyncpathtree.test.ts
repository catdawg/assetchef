import { AsyncToSyncPathTree } from "../../src/path/asynctosyncpathtree";
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

describe("asynctosyncpathtree", () => {
    it("test basic", async () => {
        const fakedPathTree = new PathTree<string>();
        const fakeAsyncPathTree = new MockAsyncPathTree(fakedPathTree);

        const asyncToSyncPathTree = new AsyncToSyncPathTree<string>(winstonlogger, fakeAsyncPathTree);

        fakedPathTree.listenChanges((ev) => {
            asyncToSyncPathTree.pushPathChangeEvent(ev);
        });

        expect(asyncToSyncPathTree.needsUpdate()).toBeTrue();
        await asyncToSyncPathTree.update();

        expect(asyncToSyncPathTree.needsUpdate()).toBeFalse();

        fakedPathTree.set("file", "content");

        expect(asyncToSyncPathTree.needsUpdate()).toBeTrue();

        while (asyncToSyncPathTree.needsUpdate()) {
            await asyncToSyncPathTree.update();
        }

        checkTree(asyncToSyncPathTree, PathTree.stringTreeFrom( {
            file: "content",
        }));

        expect(asyncToSyncPathTree.get("file")).toEqual("content");

        const nestedFile1 = PathUtils.join("dir", "file1");
        const nestedFile2 = PathUtils.join("dir", "file2");

        fakedPathTree.set(nestedFile1, "content2");
        fakedPathTree.set(nestedFile2, "content3");

        expect(asyncToSyncPathTree.needsUpdate()).toBeTrue();

        while (asyncToSyncPathTree.needsUpdate()) {
            await asyncToSyncPathTree.update();
        }

        checkTree(asyncToSyncPathTree, PathTree.stringTreeFrom( {
            file: "content",
            dir: {
                file1: "content2",
                file2: "content3",
            },
        }));
    });

    it("test filter", async () => {
        const fakedPathTree = new PathTree<string>();
        const fakeAsyncPathTree = new MockAsyncPathTree(fakedPathTree);

        // partial is if the path is not final, example folders
        const asyncToSyncPathTree = new AsyncToSyncPathTree<string>(winstonlogger, fakeAsyncPathTree,
            (path, partial) => {
                if (partial) {
                    return !path.startsWith("excluded");
                } else {
                    return !path.endsWith("excluded");
                }
            });

        fakedPathTree.listenChanges((ev) => {
            asyncToSyncPathTree.pushPathChangeEvent(ev);
        });

        fakedPathTree.set("file", "content");
        fakedPathTree.set("excluded", "content");
        fakedPathTree.set(PathUtils.join("notexcluded", "file"), "content");
        fakedPathTree.set(PathUtils.join("notexcluded", "excluded"), "content");
        fakedPathTree.set(PathUtils.join("excludeddir", "file"), "content");

        while (asyncToSyncPathTree.needsUpdate()) {
            await asyncToSyncPathTree.update();
        }

        checkTree(asyncToSyncPathTree, PathTree.stringTreeFrom( {
            file: "content",
            notexcluded: {
                file: "content",
            },
        }));
    });

    it("test get fails", async () => {
        const fakedPathTree = new PathTree<string>();
        const fakeAsyncPathTree = new MockAsyncPathTree(fakedPathTree);

        const asyncToSyncPathTree = new AsyncToSyncPathTree<string>(winstonlogger, fakeAsyncPathTree);

        fakedPathTree.listenChanges((ev) => {
            asyncToSyncPathTree.pushPathChangeEvent(ev);
        });

        fakedPathTree.set("file", "content");

        fakeAsyncPathTree.throwNextGet = true;

        while (asyncToSyncPathTree.needsUpdate()) {
            await asyncToSyncPathTree.update();
        }

        checkTree(asyncToSyncPathTree, PathTree.stringTreeFrom( {
            file: "content",
        }));
    });

    it("test list fails", async () => {
        const fakedPathTree = new PathTree<string>();
        const fakeAsyncPathTree = new MockAsyncPathTree(fakedPathTree);

        const asyncToSyncPathTree = new AsyncToSyncPathTree<string>(winstonlogger, fakeAsyncPathTree);

        fakedPathTree.listenChanges((ev) => {
            asyncToSyncPathTree.pushPathChangeEvent(ev);
        });

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

        checkTree(asyncToSyncPathTree, PathTree.stringTreeFrom( {
            file: "content",
            dir: {
                file1: "content2",
                file2: "content3",
            },
        }));
    });

    it("test getInfo fails", async () => {
        const fakedPathTree = new PathTree<string>();
        const fakeAsyncPathTree = new MockAsyncPathTree(fakedPathTree);

        const asyncToSyncPathTree = new AsyncToSyncPathTree<string>(winstonlogger, fakeAsyncPathTree);

        fakedPathTree.listenChanges((ev) => {
            asyncToSyncPathTree.pushPathChangeEvent(ev);
        });

        fakedPathTree.set("file", "content");

        while (asyncToSyncPathTree.needsUpdate()) {
            await asyncToSyncPathTree.update();
        }

        fakedPathTree.set(PathUtils.join("dir", "file"), "content");

        fakeAsyncPathTree.throwNextGetInfo = true;

        while (asyncToSyncPathTree.needsUpdate()) {
            await asyncToSyncPathTree.update();
        }

        checkTree(asyncToSyncPathTree, PathTree.stringTreeFrom( {
            file: "content",
            dir: {
                file: "content",
            },
        }));
    });

    it("test reset case 1", async () => {
        const fakedPathTree = new PathTree<string>();
        const fakeAsyncPathTree = new MockAsyncPathTree(fakedPathTree);

        const asyncToSyncPathTree = new AsyncToSyncPathTree<string>(winstonlogger, fakeAsyncPathTree);

        fakedPathTree.listenChanges((ev) => {
            asyncToSyncPathTree.pushPathChangeEvent(ev);
        });

        fakedPathTree.set("file", "content");

        while (asyncToSyncPathTree.needsUpdate()) {
            await asyncToSyncPathTree.update();
        }

        asyncToSyncPathTree.resetEventProcessing();

        while (asyncToSyncPathTree.needsUpdate()) {
            await asyncToSyncPathTree.update();
        }

        checkTree(asyncToSyncPathTree, PathTree.stringTreeFrom( {
            file: "content",
        }));
    });

    it("test reset case 2", async () => {
        const fakedPathTree = new PathTree<string>();
        const fakeAsyncPathTree = new MockAsyncPathTree(fakedPathTree);

        const asyncToSyncPathTree = new AsyncToSyncPathTree<string>(winstonlogger, fakeAsyncPathTree);

        fakedPathTree.listenChanges((ev) => {
            asyncToSyncPathTree.pushPathChangeEvent(ev);
        });

        fakedPathTree.set("", "content");

        while (asyncToSyncPathTree.needsUpdate()) {
            await asyncToSyncPathTree.update();
        }

        asyncToSyncPathTree.resetEventProcessing();

        while (asyncToSyncPathTree.needsUpdate()) {
            await asyncToSyncPathTree.update();
        }

        checkTree(asyncToSyncPathTree, PathTree.stringTreeFrom("content"));
    });

    it("test reset case 3", async () => {
        const fakedPathTree = new PathTree<string>();
        const fakeAsyncPathTree = new MockAsyncPathTree(fakedPathTree);

        const asyncToSyncPathTree = new AsyncToSyncPathTree<string>(winstonlogger, fakeAsyncPathTree);

        fakedPathTree.listenChanges((ev) => {
            asyncToSyncPathTree.pushPathChangeEvent(ev);
        });

        fakedPathTree.set("", "content");

        while (asyncToSyncPathTree.needsUpdate()) {
            await asyncToSyncPathTree.update();
        }

        fakedPathTree.remove("");

        asyncToSyncPathTree.resetEventProcessing();

        while (asyncToSyncPathTree.needsUpdate()) {
            await asyncToSyncPathTree.update();
        }

        checkTree(asyncToSyncPathTree, new PathTree());

        fakedPathTree.set("file", "content");

        while (asyncToSyncPathTree.needsUpdate()) {
            await asyncToSyncPathTree.update();
        }
        checkTree(asyncToSyncPathTree, PathTree.stringTreeFrom( {
            file: "content",
        }));
    });

    it("test reset case 4", async () => {
        const fakedPathTree = new PathTree<string>();
        const fakeAsyncPathTree = new MockAsyncPathTree(fakedPathTree);

        const asyncToSyncPathTree = new AsyncToSyncPathTree<string>(winstonlogger, fakeAsyncPathTree);

        fakedPathTree.listenChanges((ev) => {
            asyncToSyncPathTree.pushPathChangeEvent(ev);
        });

        fakedPathTree.set("file", "content");

        while (asyncToSyncPathTree.needsUpdate()) {
            await asyncToSyncPathTree.update();
        }

        fakedPathTree.remove("");

        asyncToSyncPathTree.resetEventProcessing();

        while (asyncToSyncPathTree.needsUpdate()) {
            await asyncToSyncPathTree.update();
        }

        checkTree(asyncToSyncPathTree, new PathTree());

        fakedPathTree.set("file", "content");

        while (asyncToSyncPathTree.needsUpdate()) {
            await asyncToSyncPathTree.update();
        }
        checkTree(asyncToSyncPathTree, PathTree.stringTreeFrom( {
            file: "content",
        }));
    });

    it("test api", async () => {
        const fakedPathTree = new PathTree<string>();
        const fakeAsyncPathTree = new MockAsyncPathTree(fakedPathTree);

        const asyncToSyncPathTree = new AsyncToSyncPathTree<string>(winstonlogger, fakeAsyncPathTree);

        fakedPathTree.listenChanges((ev) => {
            asyncToSyncPathTree.pushPathChangeEvent(ev);
        });

        fakedPathTree.set("file", "content");

        let called = false;
        const cancel = asyncToSyncPathTree.listenChanges((ev) => {
            called = true;
        });

        while (asyncToSyncPathTree.needsUpdate()) {
            await asyncToSyncPathTree.update();
        }
        expect(called).toBeTrue();
        called = false;

        cancel.unlisten();

        expect(asyncToSyncPathTree.exists("file")).toBeTrue();
        expect([...asyncToSyncPathTree.list("")]).toIncludeSameMembers(["file"]);

        fakedPathTree.set("file", "content2");

        while (asyncToSyncPathTree.needsUpdate()) {
            await asyncToSyncPathTree.update();
        }
        expect(called).toBeFalse();
    });
});
