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

        await fse.writeFile(PathUtils.join(tmpDirPath, "file"), Buffer.from("content"));

        await timeout(1000);

        expect ((await fspathtree.get("file")).toString()).toEqual("content");
    });

    it("test stat", async () => {
        const fspathtree = new FSPathTree(tmpDirPath);

        await fse.writeFile(PathUtils.join(tmpDirPath, "file"), Buffer.from("content"));

        await timeout(1000);

        expect ((await fspathtree.getInfo("file")).isFile()).toBeTrue();
    });

    it("test list", async () => {
        const fspathtree = new FSPathTree(tmpDirPath);

        await fse.mkdir(PathUtils.join(tmpDirPath, "dir"));
        await fse.writeFile(PathUtils.join(tmpDirPath, "dir", "file"), Buffer.from("content"));
        await fse.writeFile(PathUtils.join(tmpDirPath, "dir", "file2"), Buffer.from("content"));

        await timeout(1000);

        expect(await fspathtree.list("dir")).toIncludeSameMembers(["file", "file2"]);
    });
});
