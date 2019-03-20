import * as fs from "fs-extra";
import { VError } from "verror";

import { PathUtils } from "../src/path/pathutils";
import { timeout } from "../src/testutils/timeout";
import { TmpFolder } from "../src/testutils/tmpfolder";

import { hashFSStat } from "../src/hash";

describe("hash", () => {

    let tmpDirPath: string = null;
    beforeAll(async () => {
        tmpDirPath = TmpFolder.generate();
    });

    afterEach(async () => {
        const files = await fs.readdir(tmpDirPath);

        for (const file of files) {
            fs.remove(PathUtils.join(tmpDirPath, file));
        }
    });

    afterAll((done) => {
        fs.remove(tmpDirPath, done);
    });

    it("test parameters", () => {

        expect(() => hashFSStat(null)).toThrow(VError);

        expect(() => hashFSStat({} as any)).toThrow(VError);

        expect(() => hashFSStat({mtime: Date.now()} as any)).toThrow(VError);
        expect(() => hashFSStat({mtime: Date.now(), ctime: Date.now()} as any)).toThrow(VError);
    });

    it("hash simple diff test", async () => {
        const path = PathUtils.join(tmpDirPath, "file1.txt");
        await fs.createFile(path);

        await timeout(500);
        const emptyHash = hashFSStat(await fs.stat(path));

        await fs.writeFile(path, "something");

        await timeout(500);
        const hashAfterOneChange = hashFSStat(await fs.stat(path));

        expect(hashAfterOneChange).not.toEqual(emptyHash);

        await fs.writeFile(path, "something else");

        await timeout(500);
        const hashAfterTwoChanges = hashFSStat(await fs.stat(path));

        expect(hashAfterTwoChanges).not.toEqual(hashAfterOneChange);

        await fs.writeFile(path, "something");

        await timeout(500);
        const hashChangeWithSameContent = hashFSStat(await fs.stat(path));

        expect(hashChangeWithSameContent).not.toEqual(hashAfterOneChange);
    });

});
