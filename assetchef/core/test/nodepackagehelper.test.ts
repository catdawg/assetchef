// tslint:disable:no-unused-expression
import * as chai from "chai";

import * as fse from "fs-extra";
import * as pathutils from "path";
import { VError } from "verror";

import { NodePackageHelper } from "../src/nodepackagehelper";
import { getCallTrackingLogger } from "../src/testutils/loggingtracer";
import { timeout } from "../src/testutils/timeout";
import { TmpFolder } from "../src/testutils/tmpfolder";
import { winstonlogger } from "../src/testutils/winstonlogger";

const expect = chai.expect;

async function runAndReturnError(f: () => Promise<any>): Promise<Error> {
    try {
        await f();
    } catch (e) {
        return e;
    }
    return null;
}

describe("pluginmanager", () => {
    let tmpDirPath: string = null;

    beforeEach(async () => {
        tmpDirPath = TmpFolder.generate();

        winstonlogger.logInfo("using %s", tmpDirPath);
    });

    it("test simple from path", async () => {
        const absolutePath1 = pathutils.resolve(__dirname, pathutils.join("..", "test_libs", "testlib"));
        const absolutePath2 = pathutils.resolve(__dirname, pathutils.join("..", "test_libs", "@testorg", "testlib"));

        expect(await NodePackageHelper.install(
            winstonlogger,
            tmpDirPath, {
                "testlib": "file:" + absolutePath1,
                "@testorg/testlib": "file:" + absolutePath2,
            })).to.be.true;

        const plugin: any = NodePackageHelper.requireFromPath(tmpDirPath, "testlib");
        expect(plugin.testMethod()).to.be.greaterThan(0);
        const plugin2: any = NodePackageHelper.requireFromPath(tmpDirPath, "@testorg/testlib");
        expect(plugin2.testMethod()).to.be.greaterThan(0);
    }, 99999);

    it("test directory not valid", async () => {
        const log = getCallTrackingLogger(winstonlogger);

        const path = pathutils.join("..", "test_libs", "testlib");
        const absolutePath = pathutils.resolve(__dirname, path);

        expect(
            await NodePackageHelper.install(log, "something invalid", {testlib: "file:" + absolutePath})).to.be.false;
        expect(log.lastLogError()).to.be.not.null;
    }, 99999);

    it("test directory is file", async () => {
        const log = getCallTrackingLogger(winstonlogger);

        const path = pathutils.join("..", "test_libs", "testlib");
        const absolutePath = pathutils.resolve(__dirname, path);

        const filePath = pathutils.join(tmpDirPath, "file");
        await fse.writeFile(filePath, "asdasd");

        expect(
            await NodePackageHelper.install(log, filePath, {testlib: "file:" + absolutePath})).to.be.false;
        expect(log.lastLogError()).to.be.not.null;
    }, 99999);

    it("test plugin not existing", async () => {
        const log = getCallTrackingLogger(winstonlogger);
        expect(await NodePackageHelper.install(log, tmpDirPath, {apluginnamethatdoesntexist: "1.0.0"})).to.be.false;
        expect(log.lastLogError()).to.be.not.null;
    }, 99999);

    it("test require unavailable", async () => {
        const log = getCallTrackingLogger(winstonlogger);
        expect(
            await runAndReturnError(
                async () => await NodePackageHelper.requireFromPath(tmpDirPath, "apluginthatdoesntexist")),
            ).to.be.not.null;
    }, 99999);

    it("test errors", async () => {
        expect(await runAndReturnError(async () => await NodePackageHelper.install(null, null, null))).to.be.not.null;
        expect(await runAndReturnError(
            async () => await NodePackageHelper.install(winstonlogger, null, null))).to.be.not.null;
        expect(await runAndReturnError(
            async () => await NodePackageHelper.install(null, tmpDirPath, null))).to.be.not.null;
        expect(await runAndReturnError(
            async () => await NodePackageHelper.install(winstonlogger, tmpDirPath, null)),
            ).to.be.not.null;

        expect(
            await runAndReturnError(async () => await NodePackageHelper.requireFromPath(null, null)),
            ).to.be.not.null;
        expect(
            await runAndReturnError(async () => await NodePackageHelper.requireFromPath("apath", null)),
            ).to.be.not.null;
        expect(
            await runAndReturnError(async () => await NodePackageHelper.requireFromPath(null, "alib")),
            ).to.be.not.null;
    }, 99999);
});
