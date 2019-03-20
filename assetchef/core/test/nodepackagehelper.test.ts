import * as fse from "fs-extra";
import { VError } from "verror";

import { NodePackageHelper } from "../src/nodepackagehelper";
import { PathUtils } from "../src/path/pathutils";
import { getCallTrackingLogger } from "../src/testutils/loggingtracer";
import { timeout } from "../src/testutils/timeout";
import { TmpFolder } from "../src/testutils/tmpfolder";
import { winstonlogger } from "../src/testutils/winstonlogger";

describe("pluginmanager", () => {
    let tmpDirPath: string = null;

    beforeEach(async () => {
        tmpDirPath = TmpFolder.generate();

        winstonlogger.logInfo("using %s", tmpDirPath);
    });

    it("test simple from path", async () => {
        const absolutePath1 = PathUtils.resolve(__dirname, PathUtils.join("..", "test_libs", "testlib"));
        const absolutePath2 = PathUtils.resolve(__dirname, PathUtils.join("..", "test_libs", "@testorg", "testlib"));

        expect(await NodePackageHelper.install(
            winstonlogger,
            tmpDirPath, {
                "testlib": "file:" + absolutePath1,
                "@testorg/testlib": "file:" + absolutePath2,
            })).toBeTrue();

        const plugin: any = NodePackageHelper.requireFromPath(tmpDirPath, "testlib");
        expect(plugin.testMethod()).toBeGreaterThan(0);
        const plugin2: any = NodePackageHelper.requireFromPath(tmpDirPath, "@testorg/testlib");
        expect(plugin2.testMethod()).toBeGreaterThan(0);
    }, 99999);

    it("test directory not valid", async () => {
        const log = getCallTrackingLogger(winstonlogger);

        const path = PathUtils.join("..", "test_libs", "testlib");
        const absolutePath = PathUtils.resolve(__dirname, path);

        expect(
            await NodePackageHelper.install(log, "something invalid", {testlib: "file:" + absolutePath})).toBeFalse();
        expect(log.lastLogError()).not.toBeNull();
    }, 99999);

    it("test directory is file", async () => {
        const log = getCallTrackingLogger(winstonlogger);

        const path = PathUtils.join("..", "test_libs", "testlib");
        const absolutePath = PathUtils.resolve(__dirname, path);

        const filePath = PathUtils.join(tmpDirPath, "file");
        await fse.writeFile(filePath, "asdasd");

        expect(
            await NodePackageHelper.install(log, filePath, {testlib: "file:" + absolutePath})).toBeFalse();
        expect(log.lastLogError()).not.toBeNull();
    }, 99999);

    it("test plugin not existing", async () => {
        const log = getCallTrackingLogger(winstonlogger);
        expect(await NodePackageHelper.install(log, tmpDirPath, {apluginnamethatdoesntexist: "1.0.0"})).toBeFalse();
        expect(log.lastLogError()).not.toBeNull();
    }, 99999);

    it("test require unavailable", async () => {
        expect(() => NodePackageHelper.requireFromPath(tmpDirPath, "apluginthatdoesntexist")).toThrow();
    }, 99999);

    it("test errors", async () => {
        await expect(NodePackageHelper.install(null, null, null)).not.toBeNull();
        await expect(NodePackageHelper.install(winstonlogger, null, null)).not.toBeNull();
        await expect(NodePackageHelper.install(null, tmpDirPath, null)).not.toBeNull();
        await expect(NodePackageHelper.install(winstonlogger, tmpDirPath, null)).not.toBeNull();

        expect(() => NodePackageHelper.requireFromPath(null, null)).toThrow();
        expect(() => NodePackageHelper.requireFromPath("apath", null)).toThrow();
        expect(() => NodePackageHelper.requireFromPath(null, "alib")).toThrow();
    }, 99999);
});
