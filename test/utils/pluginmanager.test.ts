// tslint:disable:no-unused-expression
import * as chai from "chai";

import * as fse from "fs-extra";
import * as pathutils from "path";
import * as tmp from "tmp";
import { VError } from "verror";

import { PluginManager } from "../../src/utils/pluginmanager";
import { timeout } from "../../src/utils/timeout";
import winstonlogger from "../../src/utils/winstonlogger";
import { getCallTrackingLogger } from "../loggingtracer";

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
    let tmpDir: tmp.SynchrounousResult = null;

    beforeAll(async () => {
        tmpDir = tmp.dirSync();
    });

    afterEach(async () => {
        const files = await fse.readdir(tmpDir.name);
        for (const file of files) {
            const fullPath = pathutils.join(tmpDir.name, file);
            await fse.remove(fullPath);
        }
        await timeout(1500);
    });

    afterAll( async () => {
        await fse.remove(tmpDir.name);
    });

    it("test simple from path", async () => {
        const log = getCallTrackingLogger(winstonlogger);
        const pluginManager = await PluginManager.setup(log, tmpDir.name);

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
        const pluginManager = await PluginManager.setup(log, tmpDir.name);

        expect(await pluginManager.install({apluginnamethatdoesntexist: "1.0.0"})).to.be.false;
        expect(log.didCallLogError()).to.be.true;
    });

    it("test require unavailable", async () => {
        const log = getCallTrackingLogger(winstonlogger);
        const pluginManager = await PluginManager.setup(log, tmpDir.name);

        expect(await pluginManager.require("apluginthatdoesntexist")).to.be.null;
        expect(log.didCallLogError()).to.be.true;
    });

    it("test errors", async () => {
        expect(await runAndReturnError(async () => await PluginManager.setup(null, null))).to.be.not.null;
        expect(await runAndReturnError(async () => await PluginManager.setup(winstonlogger, null))).to.be.not.null;
        expect(await runAndReturnError(async () => await PluginManager.setup(null, tmpDir.name))).to.be.not.null;
        const pluginManager = await PluginManager.setup(winstonlogger, tmpDir.name);

        expect(await runAndReturnError(async () => await pluginManager.install(null))).to.be.not.null;
        expect(await runAndReturnError(async () => await pluginManager.require(null))).to.be.not.null;
    }, 60000000);
});
