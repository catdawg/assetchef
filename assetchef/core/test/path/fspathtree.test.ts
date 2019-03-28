import * as fse from "fs-extra";

import { FSPathTree } from "../../src/path/fspathtree";
import { PathUtils } from "../../src/path/pathutils";
import { timeout } from "../../src/testutils/timeout";
import { TmpFolder } from "../../src/testutils/tmpfolder";
import { winstonlogger } from "../../src/testutils/winstonlogger";
import { WatchmanFSWatch } from "../../src/watch/fswatch_watchman";

describe("fspathtree", () => {
    let tmpDirPath: string = null;
    let fsWatch: WatchmanFSWatch = null;
    beforeEach(async () => {
        tmpDirPath = TmpFolder.generate();
        fsWatch = await WatchmanFSWatch.watchPath(winstonlogger, tmpDirPath);
    }, 10000);

    afterEach(async () => {
        await fse.remove(tmpDirPath);
        fsWatch.cancel();
    }, 10000);

    it("test read", async () => {
        const fspathtree = new FSPathTree(tmpDirPath, fsWatch);

        await fspathtree.set("file", Buffer.from("content"));

        await timeout(fspathtree.delayMs);

        expect ((await fspathtree.get("file")).toString()).toEqual("content");
    });

    it("test stat", async () => {
        const fspathtree = new FSPathTree(tmpDirPath, fsWatch);

        await fspathtree.set("file", Buffer.from("content"));

        await timeout(fspathtree.delayMs);

        expect ((await fspathtree.getInfo("file")).isFile()).toBeTrue();
    });

    it("test list", async () => {
        const fspathtree = new FSPathTree(tmpDirPath, fsWatch);

        // creates dir too
        await fspathtree.createFolder(PathUtils.join("dir"));
        await fspathtree.set(PathUtils.join("dir", "file"), Buffer.from("content"));
        await fspathtree.set(PathUtils.join("dir", "file2"), Buffer.from("content"));

        await fspathtree.createFolder(PathUtils.join("dir", "dir2"));

        await timeout(fspathtree.delayMs);

        expect(await fspathtree.list("dir")).toIncludeSameMembers(["file", "file2", "dir2"]);
    });

    it("test remove", async () => {
        const fspathtree = new FSPathTree(tmpDirPath, fsWatch);

        // creates dir too
        await fspathtree.set("file", Buffer.from("content"));
        await fspathtree.createFolder(PathUtils.join("dir"));
        await fspathtree.set(PathUtils.join("dir", "file"), Buffer.from("content"));
        await fspathtree.set(PathUtils.join("dir", "file2"), Buffer.from("content"));

        await fspathtree.createFolder(PathUtils.join("dir", "dir2"));

        await timeout(fspathtree.delayMs);

        await fspathtree.remove("dir");
        await timeout(fspathtree.delayMs);
        expect(await fspathtree.list("")).toIncludeSameMembers(["file"]);

        await timeout(fspathtree.delayMs);
        await fspathtree.remove("file");
        expect(await fspathtree.list("")).toIncludeSameMembers([]);
    }, 10000);

    it("test watch", async () => {
        const fspathtree = new FSPathTree(tmpDirPath, fsWatch);
        let lastEv = null;
        const cancelToken = fspathtree.listenChanges({
            onEvent: (ev) => lastEv = ev,
            onReset: () => { return; },
        });

        await fspathtree.set("file", Buffer.from("content"));

        await timeout(fspathtree.delayMs);

        expect(lastEv).not.toBeNull();
        lastEv = null;

        cancelToken.unlisten();

        await fspathtree.set("file", Buffer.from("content2"));

        await timeout(fspathtree.delayMs);

        expect(lastEv).toBeNull();
    }, 10000);
});
