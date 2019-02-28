// tslint:disable:no-unused-expression
import * as chai from "chai";

import * as fse from "fs-extra";
import * as pathutils from "path";
import { VError } from "verror";

import { PluginManager } from "../src/pluginmanager";
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
    });

    it("test simple from path", async () => {
        const log = getCallTrackingLogger(winstonlogger);
        const pluginManager = await PluginManager.setup(log, tmpDirPath);

        const absolutePath1 = pathutils.resolve(__dirname, pathutils.join("..", "test_libs", "testlib"));
        const absolutePath2 = pathutils.resolve(__dirname, pathutils.join("..", "test_libs", "testlib_org"));

        expect(await pluginManager.install({
            "testlib": "file:" + absolutePath1,
            "@testorg/testlib": "file:" + absolutePath2,
        }, {})).to.be.true;

        const plugin: any = pluginManager.require("testlib");
        expect(plugin.testMethod()).to.equal("works");
        const plugin2: any = pluginManager.require("@testorg/testlib");
        expect(plugin2.testMethod()).to.equal("works");
    });

    it("test directory not valid", async () => {
        const log = getCallTrackingLogger(winstonlogger);
        const pluginManager = await PluginManager.setup(log, "something unavailable");

        const path = pathutils.join("..", "test_libs", "testlib");
        const absolutePath = pathutils.resolve(__dirname, path);

        expect(await pluginManager.install({testlib: "file:" + absolutePath}, {})).to.be.false;
        expect(log.lastLogError()).to.be.not.null;
    });

    it("test plugin not existing", async () => {
        const log = getCallTrackingLogger(winstonlogger);
        const pluginManager = await PluginManager.setup(log, tmpDirPath);

        expect(await pluginManager.install({apluginnamethatdoesntexist: "1.0.0"}, {})).to.be.false;
        expect(log.lastLogError()).to.be.not.null;
    });

    it("test require unavailable", async () => {
        const log = getCallTrackingLogger(winstonlogger);
        const pluginManager = await PluginManager.setup(log, tmpDirPath);

        expect(await pluginManager.require("apluginthatdoesntexist")).to.be.null;
        expect(log.lastLogError()).to.be.not.null;
    });

    it("test errors", async () => {
        expect(await runAndReturnError(async () => await PluginManager.setup(null, null))).to.be.not.null;
        expect(await runAndReturnError(async () => await PluginManager.setup(winstonlogger, null))).to.be.not.null;
        expect(await runAndReturnError(async () => await PluginManager.setup(null, tmpDirPath))).to.be.not.null;
        const pluginManager = await PluginManager.setup(winstonlogger, tmpDirPath);

        expect(await runAndReturnError(async () => await pluginManager.install(null, null))).to.be.not.null;
        expect(await runAndReturnError(async () => await pluginManager.install({}, null))).to.be.not.null;
        expect(await runAndReturnError(async () => await pluginManager.require(null))).to.be.not.null;
    }, 60000000);
});
