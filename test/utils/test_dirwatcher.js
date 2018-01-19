"use strict";
/* eslint-env mocha */

const expect = require("chai").expect;
const tmp = require("tmp");
const fse = require("fs-extra");
const VError = require("verror").VError;
const pathutils = require("path");
const timeout = require("../../lib/utils/timeout");
const DirChangeEvent = require("../../lib/utils/dirchangeevent");
const DirEventType = DirChangeEvent.DirEventType;

const DirWatcher = require("../../lib/utils/dirwatcher");

const DEFAULT_TIMEOUT = 3000;

describe("dirwatcher", function () {

    this.timeout(20000);

    let tmpDir = null;
    let currentCallback = null;
    let watcher = null;
    before(function () {
        tmpDir = tmp.dirSync({"keep": true});
        watcher = new DirWatcher(tmpDir.name);
        watcher.on("dirchanged", function (ev) {
            if (currentCallback != null) {
                currentCallback(ev);
            }
        });
    });
    beforeEach(async function () {
        await fse.copy(__dirname + "/../../test_directories/test_dirwatcher", tmpDir.name);
        await timeout(3000); // make sure all changes are flushed
    });

    afterEach(async function () {
        const files = await fse.readdir(tmpDir.name);

        for (const file of files) {
            fse.remove(pathutils.join(tmpDir.name, file));
        }
        await timeout(3000); // make sure all changes are flushed
    });

    after(function (done) {
        watcher.cancel();
        fse.remove(tmpDir.name, done);
    });

    /**
     * Triggers the change method, and checks if the watch triggers the change
     * @param {function} changeMethod - The method that changes
     * @param {DirEventType} expectedEvent - The expected event
     * @param {string} expectedPath - The expected path for the event
     * @param {function} done - Called after it finishes testing
     * @returns {undefined}
     */
    async function testOneDirChange(changeMethod, expectedEvent, expectedPath) {
        let worked = false;
        await new Promise (async (resolve) => {

            let doneCalled = false;
            currentCallback = function (ev) {
                if (ev.eventType !== expectedEvent) {
                    return;
                }
    
                expect(ev.path).to.be.equal(expectedPath);
                currentCallback = null;
                worked = true;
                resolve();
            };
            
            changeMethod();
            
            await timeout(DEFAULT_TIMEOUT);
            if (!doneCalled)
            {
                currentCallback = null;
                doneCalled = true;
                worked = false;
                resolve();
            }
        });

        expect(worked).to.be.true;
    }

    it("test parameters", function () {

        expect(() => new DirWatcher(null)).to.throw(VError);
        expect(() => new DirWatcher("dir that doesn't exist")).to.throw(VError);
    });

    it("file change should trigger", async function () {
        const path = pathutils.join(tmpDir.name, "file1.txt");
        return await testOneDirChange(function () {
            fse.appendFile(path, "some content");
        }, DirEventType.Change, path);
    });

    it("file change inside dir should trigger", async function () {
        const path = pathutils.join(tmpDir.name, "dir", "file2.txt");
        return await testOneDirChange(function () {
            fse.appendFile(path, "some content");
        }, DirEventType.Change, path);
    });


    it("add file change should trigger", async function () {
        const path = pathutils.join(tmpDir.name, "newfile.txt");
        return await testOneDirChange(function () {
            fse.writeFile(path);
        }, DirEventType.Add, path);
    });

    it("add dir change should trigger", async function () {
        const path = pathutils.join(tmpDir.name, "newdir");
        return await testOneDirChange(function () {
            fse.mkdir(path);
        }, DirEventType.AddDir, path);
    });

    it("remove dir change should trigger", async function () {
        const path = pathutils.join(tmpDir.name, "dir");
        return await testOneDirChange(function () {
            fse.remove(path);
        }, DirEventType.UnlinkDir, path);
    });

    it("remove file change should trigger", async function () {
        const path = pathutils.join(tmpDir.name, "file1.txt");
        return await testOneDirChange(function () {
            fse.remove(path);
        }, DirEventType.Unlink, path);
    });

    it("no change should not trigger", async function () {
        return await new Promise(async (resolve) => {

            currentCallback = function () {
                resolve(new Error("shouldn't have changed"));
            };
    
            await timeout(DEFAULT_TIMEOUT);
            currentCallback = null;
            resolve();
        });
    });
    
    //has to be the last
    it("test cancel twice", function () {

        watcher.cancel();
        watcher.cancel();
    });
});