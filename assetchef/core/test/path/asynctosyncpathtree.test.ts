// tslint:disable:no-unused-expression
import * as chai from "chai";

import { AsyncToSyncPathTree } from "../../src/path/asynctosyncpathtree";
import { IPathTreeReadonly } from "../../src/path/ipathtreereadonly";
import { PathTree } from "../../src/path/pathtree";
import { PathUtils } from "../../src/path/pathutils";
import { MockAsyncPathTree } from "../../src/testutils/mockasyncpathtree";
import { winstonlogger } from "../../src/testutils/winstonlogger";

const expect = chai.expect;

function checkTree<T>(actual: IPathTreeReadonly<T>, expected: IPathTreeReadonly<T>) {
    if (expected == null) {
        return; // not important
    }
    const listActual = [...actual.listAll()];
    const listExpected = [...expected.listAll()];

    expect(listActual).to.have.same.members(listExpected);

    listActual.sort();
    listExpected.sort();

    for (const p of listActual) {
        if (actual.isDir(p)) {
            expect(expected.isDir(p)).to.be.true;
        } else {
            expect(actual.get(p)).to.deep.equal(expected.get(p));
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

        expect(asyncToSyncPathTree.needsUpdate()).to.be.true;
        await asyncToSyncPathTree.update();

        expect(asyncToSyncPathTree.needsUpdate()).to.be.false;

        fakedPathTree.set("file", "content");

        expect(asyncToSyncPathTree.needsUpdate()).to.be.true;

        while (asyncToSyncPathTree.needsUpdate()) {
            await asyncToSyncPathTree.update();
        }

        checkTree(asyncToSyncPathTree, PathTree.stringTreeFrom( {
            file: "content",
        }));

        expect(asyncToSyncPathTree.get("file")).to.equal("content");

        const nestedFile1 = PathUtils.join("dir", "file1");
        const nestedFile2 = PathUtils.join("dir", "file2");

        fakedPathTree.set(nestedFile1, "content2");
        fakedPathTree.set(nestedFile2, "content3");

        expect(asyncToSyncPathTree.needsUpdate()).to.be.true;

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
        expect(called).to.be.true;
        called = false;

        cancel.unlisten();

        expect(asyncToSyncPathTree.exists("file")).to.be.true;
        expect([...asyncToSyncPathTree.list("")]).to.have.same.members(["file"]);

        fakedPathTree.set("file", "content2");

        while (asyncToSyncPathTree.needsUpdate()) {
            await asyncToSyncPathTree.update();
        }
        expect(called).to.be.false;
    });
});
