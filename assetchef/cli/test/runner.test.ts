// tslint:disable:no-unused-expression
import * as chai from "chai";

import * as fse from "fs-extra";
import * as pathutils from "path";

import { timeout, TmpFolder, winstonlogger } from "@assetchef/core";
import { NodePackageHelper } from "@assetchef/core";
import { runner } from "../src/runner";

const DEFAULT_TIMEOUT = 3000;

const expect = chai.expect;

describe("runner", async () => {
    let tmpDirPath: string = null;
    beforeEach(async () => {
        tmpDirPath = TmpFolder.generate();
        winstonlogger.logInfo("cli test using %s", tmpDirPath);
        await fse.remove(tmpDirPath);
        await fse.mkdirs(tmpDirPath);
        const path = pathutils.join("..", "test_project");
        const absolutePath = pathutils.resolve(__dirname, path);
        await fse.copy(absolutePath, tmpDirPath);
        await timeout(DEFAULT_TIMEOUT); // make sure all changes are flushed
    }, 10000);

    it("test 1", async () => {

        const readFsPath = pathutils.resolve(__dirname, pathutils.join("..", "..", "plugins", "readfs"));
        const writeFsPath = pathutils.resolve(__dirname, pathutils.join("..", "..", "plugins", "writefs"));
        expect(await NodePackageHelper.install(winstonlogger, tmpDirPath, {
            "@assetchef/readfs": "file:" + readFsPath,
            "@assetchef/writefs": "file:" + writeFsPath,
         })).to.be.true;
 
        expect(
            await runner([process.argv[0], process.argv[1], pathutils.join(tmpDirPath, "assetchef.json")]),
        ).to.be.equal(0);
    }, 99999999);
});
