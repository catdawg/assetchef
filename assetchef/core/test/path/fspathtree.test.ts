import * as fse from "fs-extra";

import { FSPathTree } from "../../src/path/fspathtree";
import { PathUtils } from "../../src/path/pathutils";
import { timeout } from "../../src/testutils/timeout";
import { TmpFolder } from "../../src/testutils/tmpfolder";

describe("fspathtree", () => {
    let tmpDirPath: string = null;
    beforeEach(async () => {
        tmpDirPath = TmpFolder.generate();
    }, 10000);

    afterEach(async () => {
        await fse.remove(tmpDirPath);
    }, 10000);

    it("test read", async () => {
        const fspathtree = new FSPathTree(tmpDirPath);

        await fspathtree.set("file", Buffer.from("content"));

        await timeout(fspathtree.delayMs);

        expect ((await fspathtree.get("file")).toString()).toEqual("content");
    });

    it("test stat", async () => {
        const fspathtree = new FSPathTree(tmpDirPath);

        await fspathtree.set("file", Buffer.from("content"));

        await timeout(fspathtree.delayMs);

        expect ((await fspathtree.getInfo("file")).isFile()).toBeTrue();
    });

    it("test list", async () => {
        const fspathtree = new FSPathTree(tmpDirPath);

        // creates dir too
        await fspathtree.createFolder(PathUtils.join("dir"));
        await fspathtree.set(PathUtils.join("dir", "file"), Buffer.from("content"));
        await fspathtree.set(PathUtils.join("dir", "file2"), Buffer.from("content"));

        await fspathtree.createFolder(PathUtils.join("dir", "dir2"));

        await timeout(fspathtree.delayMs);

        expect(await fspathtree.list("dir")).toIncludeSameMembers(["file", "file2", "dir2"]);
    });

    it("test remove", async () => {
        const fspathtree = new FSPathTree(tmpDirPath);

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
});
