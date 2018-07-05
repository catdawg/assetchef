// tslint:disable:no-unused-expression
import * as chai from "chai";
const expect = chai.expect;

import * as fse from "fs-extra";
import * as pathutils from "path";
import * as tmp from "tmp";
import { VError } from "verror";
import timeout from "../../src/utils/timeout";

import {PathEventType} from "../../src/path/pathchangeevent";
import {DirWatcher} from "../../src/utils/dirwatcher";

const DEFAULT_TIMEOUT = 3000;

describe("dirwatcher", () => {

    let tmpDir = null;
    let currentCallback = null;
    let watcher = null;
    beforeAll(() => {
        tmpDir = tmp.dirSync();
        watcher = new DirWatcher(tmpDir.name);
        watcher.on("pathchanged", (ev) => {
            if (currentCallback != null) {
                currentCallback(ev);
            }
        });
    });
    beforeEach(async () => {
        await fse.copy(__dirname + "/../../test_directories/test_dirwatcher", tmpDir.name);
        await timeout(1500); // make sure all changes are flushed
    });

    afterEach(async () => {
        const files = await fse.readdir(tmpDir.name);

        for (const file of files) {
            fse.remove(pathutils.join(tmpDir.name, file));
        }
        await timeout(1500); // make sure all changes are flushed
    });

    afterAll((done) => {
        watcher.cancel();
        fse.remove(tmpDir.name, done);
    });

    /**
     * Triggers the change method, and checks if the watch triggers the change
     * @param {function} changeMethod - The method that changes
     * @param {PathChangeEvent.PathEventType} expectedEvent - The expected event
     * @param {string} expectedPath - The expected path for the event
     * @returns {Promise<void>} the promise
     */
    async function testOnePathChange(changeMethod, expectedEvent, expectedPath) {
        let worked = false;
        await new Promise (async (resolve) => {

            let doneCalled = false;
            currentCallback = (ev) => {
                if (ev.eventType !== expectedEvent) {
                    return;
                }

                expect(ev.path).to.be.equal(expectedPath);
                currentCallback = null;
                worked = true;
                resolve();
            };

            await changeMethod();

            await timeout(DEFAULT_TIMEOUT);
            if (!doneCalled) {
                currentCallback = null;
                doneCalled = true;
                worked = false;
                resolve();
            }
        });

        expect(worked).to.be.true;
    }

    it("test parameters", () => {
        expect(() => new DirWatcher(null)).to.throw(VError);
        expect(() => new DirWatcher("dir that doesn't exist")).to.throw(VError);
    });

    it("file change should trigger", async () => {
        const path = pathutils.join("file1.txt");
        const fullPath = pathutils.join(tmpDir.name, path);
        return await testOnePathChange(async () => {
            await fse.appendFile(fullPath, "some content");
        }, PathEventType.Change, path);
    });

    it("file change inside dir should trigger", async () => {
        const path = pathutils.join("dir", "file2.txt");
        const fullPath = pathutils.join(tmpDir.name, path);
        return await testOnePathChange(async () => {
            await fse.appendFile(fullPath, "some content");
        }, PathEventType.Change, path);
    });

    it("add file change should trigger", async () => {
        const path = pathutils.join("newfile.txt");
        const fullPath = pathutils.join(tmpDir.name, path);
        return await testOnePathChange(async () => {
            await fse.writeFile(fullPath, "something");
        }, PathEventType.Add, path);
    });

    it("add dir change should trigger", async () => {
        const path = pathutils.join("newdir");
        const fullPath = pathutils.join(tmpDir.name, path);
        return await testOnePathChange(async () => {
            await fse.mkdir(fullPath);
        }, PathEventType.AddDir, path);
    });

    it("remove dir change should trigger", async () => {
        const path = pathutils.join("dir");
        const fullPath = pathutils.join(tmpDir.name, path);
        return await testOnePathChange(async () => {
            await fse.remove(fullPath);
        }, PathEventType.UnlinkDir, path);
    });

    it("remove file change should trigger", async () => {
        const path = pathutils.join("file1.txt");
        const fullPath = pathutils.join(tmpDir.name, path);
        return await testOnePathChange(async () => {
            await fse.remove(fullPath);
        }, PathEventType.Unlink, path);
    });

    it("no change should not trigger", async () => {
        return await new Promise(async (resolve) => {

            currentCallback = () => {
                resolve(new Error("shouldn't have changed"));
            };

            await timeout(DEFAULT_TIMEOUT);
            currentCallback = null;
            resolve();
        });
    });

    // has to be the last
    it("test cancel twice", () => {

        watcher.cancel();
        watcher.cancel();
    });
});
