import * as fse from "fs-extra";

import { PathUtils, timeout, TmpFolder, winstonlogger } from "@assetchef/core";
import { NodePackageHelper } from "@assetchef/core";
import { runner } from "../src/runner";

const DEFAULT_TIMEOUT = 3000;

describe("runner", async () => {
    let tmpDirPath: string = null;
    beforeEach(async () => {
        tmpDirPath = TmpFolder.generate();
        winstonlogger.logInfo("cli test using %s", tmpDirPath);
        await fse.remove(tmpDirPath);
        await fse.mkdirs(tmpDirPath);
        const path = PathUtils.join("..", "test_project");
        const absolutePath = PathUtils.resolve(__dirname, path);
        await fse.copy(absolutePath, tmpDirPath);
        await timeout(DEFAULT_TIMEOUT); // make sure all changes are flushed
    }, 10000);

    it("test 1", async () => {

        const readFsPath = PathUtils.resolve(__dirname, PathUtils.join("..", "..", "plugins", "readfs"));
        const writeFsPath = PathUtils.resolve(__dirname, PathUtils.join("..", "..", "plugins", "writefs"));
        expect(await NodePackageHelper.install(winstonlogger, tmpDirPath, {
            "@assetchef/readfs": "file:" + readFsPath,
            "@assetchef/writefs": "file:" + writeFsPath,
         })).toBeTrue();

        expect(
            await runner([process.argv[0], process.argv[1], PathUtils.join(tmpDirPath, "assetchef.json")]),
        ).toEqual(0);
    }, 99999999);
});
