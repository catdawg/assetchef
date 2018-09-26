// tslint:disable:no-unused-expression
import * as chai from "chai";
const expect = chai.expect;

import * as fse from "fs-extra";
import * as pathutils from "path";
import * as tmp from "tmp";
import {
    _setTestInterrupt,
    ASSETCHEF_CONFIG_FILE,
    checkRecipeConfig,
    CheckRecipeConfigResult} from "../../src/kitchen/recipeconfig";
import { timeout } from "../../src/utils/timeout";
import winstonlogger from "../../src/utils/winstonlogger";
import { getCallTrackingLogger } from "../loggingtracer";

async function runAndReturnError(f: () => Promise<any>): Promise<Error> {
    try {
        await f();
    } catch (e) {
        return e;
    }
    return null;
}

describe("recipeconfig", () => {

    let tmpDir: tmp.SynchrounousResult = null;
    let configPath: string = null;
    beforeAll(() => {
        tmpDir = tmp.dirSync();
        configPath = pathutils.join(tmpDir.name, ASSETCHEF_CONFIG_FILE);
    });

    afterEach(async () => {
        const files = await fse.readdir(tmpDir.name);

        for (const file of files) {
            fse.remove(pathutils.join(tmpDir.name, file));
        }

        await timeout(500);
    });

    afterAll(async () => {
        await fse.remove(tmpDir.name);
    });

    it("test parameters", async () => {
        expect(await runAndReturnError(async () => await checkRecipeConfig(null, null))).to.not.be.null;
        expect(await runAndReturnError(async () => await checkRecipeConfig(winstonlogger, null))).to.not.be.null;
    });

    it("test checkRecipeConfig empty", async () => {
        await fse.writeFile(configPath, "");

        const log = getCallTrackingLogger(winstonlogger);
        expect((await checkRecipeConfig(log, configPath)).result).to.be.equal(CheckRecipeConfigResult.NotAJson);
        expect(log.didCallLogInfo()).to.be.true;
    });

    it("test checkRecipeConfig not a json", async () => {
        await fse.writeFile(configPath, "1 2 3");

        const log = getCallTrackingLogger(winstonlogger);
        expect((await checkRecipeConfig(log, configPath)).result).to.be.equal(CheckRecipeConfigResult.NotAJson);
        expect(log.didCallLogInfo()).to.be.true;
    });

    it("test checkRecipeConfig invalid json", async () => {
        await fse.writeFile(configPath, "{\"something\":1}");

        const log = getCallTrackingLogger(winstonlogger);
        expect((await checkRecipeConfig(log, configPath)).result).to.be.equal(CheckRecipeConfigResult.InvalidJson);
        expect(log.didCallLogInfo()).to.be.true;
    });

    it("test checkRecipeConfig success", async () => {
        await fse.writeFile(configPath, "{\"roots\": [{\"testplugin\": {\"config\": {}, \"next\": []}}]}");

        const log = getCallTrackingLogger(winstonlogger);
        const res = await checkRecipeConfig(log, configPath);

        expect(res.result).to.be.equal(CheckRecipeConfigResult.Success);
        expect(res.config).to.be.not.null;
    });

    it("test checkRecipeConfig not found", async () => {
        const log = getCallTrackingLogger(winstonlogger);
        expect((await checkRecipeConfig(log, configPath)).result).to.be.equal(CheckRecipeConfigResult.NotFound);
        expect(log.didCallLogInfo()).to.be.true;
    });

    it("test checkRecipeConfig is directory", async () => {
        await fse.mkdir(configPath);

        const log = getCallTrackingLogger(winstonlogger);
        expect((await checkRecipeConfig(log, configPath)).result).to.be.equal(CheckRecipeConfigResult.Failure);
        expect(log.didCallLogError()).to.be.true;
    });

    it("test checkRecipeConfig edgecase", async () => {
        await fse.writeFile(configPath, "{\"something\":1}");
        _setTestInterrupt(async () => await fse.remove(configPath));

        const log = getCallTrackingLogger(winstonlogger);
        expect((await checkRecipeConfig(log, configPath)).result).to.be.equal(CheckRecipeConfigResult.Failure);
        expect(log.didCallLogError()).to.be.true;
    });
});
