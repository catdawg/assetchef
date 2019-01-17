// tslint:disable:no-unused-expression
import * as chai from "chai";

import * as fse from "fs-extra";
import * as pathutils from "path";
import { VError } from "verror";

import { PluginManager } from "../../src/utils/pluginmanager";
import { timeout } from "../../src/utils/timeout";
import { getCallTrackingLogger } from "../../test_utils/loggingtracer";
import { TmpFolder } from "../../test_utils/tmpfolder";
import winstonlogger from "../../test_utils/winstonlogger";

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

    beforeAll(async () => {
        tmpDirPath = await TmpFolder.generate();
    });

    afterEach(async () => {
        const files = await fse.readdir(tmpDirPath);
        for (const file of files) {
            const fullPath = pathutils.join(tmpDirPath, file);
            await fse.remove(fullPath);
        }
        await timeout(1500);
    });

    afterAll( async () => {
        await fse.remove(tmpDirPath);
    });

    it("test simple from path", async () => {
        const log = getCallTrackingLogger(winstonlogger);
        const pluginManager = await PluginManager.setup(log, tmpDirPath);

        const path = pathutils.join("..", "..", "test_plugins", "testplugin");
        const absolutePath = pathutils.resolve(__dirname, path);

        expect(await pluginManager.install({testplugin: "file:" + absolutePath})).to.be.true;

        const plugin: any = pluginManager.require("testplugin");
        expect(plugin.testMethod()).to.equal("works");
    });

    it("test directory not valid", async () => {
        const log = getCallTrackingLogger(winstonlogger);
        const pluginManager = await PluginManager.setup(log, "something unavailable");

        const path = pathutils.join("..", "..", "test_plugins", "testplugin");
        const absolutePath = pathutils.resolve(__dirname, path);

        expect(await pluginManager.install({testplugin: "file:" + absolutePath})).to.be.false;
        expect(log.didCallLogError()).to.be.true;
    });

    it("test plugin not existing", async () => {
        const log = getCallTrackingLogger(winstonlogger);
        const pluginManager = await PluginManager.setup(log, tmpDirPath);

        expect(await pluginManager.install({apluginnamethatdoesntexist: "1.0.0"})).to.be.false;
        expect(log.didCallLogError()).to.be.true;
    });

    it("test require unavailable", async () => {
        const log = getCallTrackingLogger(winstonlogger);
        const pluginManager = await PluginManager.setup(log, tmpDirPath);

        expect(await pluginManager.require("apluginthatdoesntexist")).to.be.null;
        expect(log.didCallLogError()).to.be.true;
    });

    it("test errors", async () => {
        expect(await runAndReturnError(async () => await PluginManager.setup(null, null))).to.be.not.null;
        expect(await runAndReturnError(async () => await PluginManager.setup(winstonlogger, null))).to.be.not.null;
        expect(await runAndReturnError(async () => await PluginManager.setup(null, tmpDirPath))).to.be.not.null;
        const pluginManager = await PluginManager.setup(winstonlogger, tmpDirPath);

        expect(await runAndReturnError(async () => await pluginManager.install(null))).to.be.not.null;
        expect(await runAndReturnError(async () => await pluginManager.require(null))).to.be.not.null;
    }, 60000000);
});
