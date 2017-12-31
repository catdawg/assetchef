"use strict";
/* eslint-env mocha */

const utils = require("../utils");
const timeout = utils.timeout;

const expect = require("chai").expect;
const tmp = require("tmp");
const fse = require("fs-extra");
const VError = require("verror").VError;
const pathutils = require("path");

const watchdirectory = require("../../lib/utils/watchdirectory");

const DEFAULT_TIMEOUT = 3000;

describe("watchdirectory", function () {

    this.timeout(20000);

    let tmpDir = null;
    let currentCallback = null;
    let watcher = null;
    before(function () {
        tmpDir = tmp.dirSync({"keep": true});
        watcher = watchdirectory.watchForChanges(tmpDir.name, function (ev, path, stat) {
            if (currentCallback != null) {
                currentCallback(ev, path, stat);
            }
        });
    });
    beforeEach(async function () {
        await fse.copy(__dirname + "/../../test_directories/test_watchdirectory", tmpDir.name);
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
     * @param {string} expectedEvent - The expected event
     * @param {string} expectedPath - The expected path for the event
     * @param {function} done - Called after it finishes testing
     * @returns {undefined}
     */
    async function testOneDirChange(changeMethod, expectedEvent, expectedPath) {
        return new Promise (async (resolve) => {

            let doneCalled = false;
            currentCallback = function (ev, path, stat) {
                if (ev !== expectedEvent) {
                    return;
                }
    
                expect(path).to.be.equal(expectedPath);
                if (ev !== "unlink" && ev !== "unlinkDir") {
                    expect(stat).to.not.be.undefined;
                }
                else {
                    expect(stat).to.be.undefined;
                }
                doneCalled = true;
                currentCallback = null;
                resolve();
            };
            
            changeMethod();
            
            await timeout(DEFAULT_TIMEOUT);
            if (!doneCalled)
            {
                currentCallback = null;
                doneCalled = true;
                resolve(new Error("change not triggered"));
            }
        });
    }

    /**
     * Appends "new content" to a file.
     * @param {string} file - The directory to watch
     * @returns {undefined}
     */
    function touchFile(file) {

        const logStream = fse.createWriteStream(file, {"flags": "a"});
        logStream.write(" new content");
        logStream.end("");
    }

    it("test parameters", function () {

        expect(watchdirectory.watchForChanges.bind(null, null, null)).to.throw(VError);
        expect(watchdirectory.watchForChanges.bind(null, tmpDir.name, null)).to.throw(VError);
        expect(watchdirectory.watchForChanges.bind(null, "dir that doesn't exist", function() {})).to.throw(VError);
    });

    it("file change should trigger", async function () {
        const path = pathutils.join(tmpDir.name, "file1.txt");
        return await testOneDirChange(function () {
            touchFile(path);
        }, "change", path);
    });

    it("file change inside dir should trigger", async function () {
        const path = pathutils.join(tmpDir.name, "dir", "file2.txt");
        return await testOneDirChange(function () {
            touchFile(path);
        }, "change", path);
    });


    it("add file change should trigger", async function () {
        const path = pathutils.join(tmpDir.name, "newfile.txt");
        return await testOneDirChange(function () {
            fse.writeFile(path);
        }, "add", path);
    });

    it("add dir change should trigger", async function () {
        const path = pathutils.join(tmpDir.name, "newdir");
        return await testOneDirChange(function () {
            fse.mkdir(path);
        }, "addDir", path);
    });

    it("remove dir change should trigger", async function () {
        const path = pathutils.join(tmpDir.name, "dir");
        return await testOneDirChange(function () {
            fse.remove(path);
        }, "unlinkDir", path);
    });

    it("remove file change should trigger", async function () {
        const path = pathutils.join(tmpDir.name, "file1.txt");
        return await testOneDirChange(function () {
            fse.remove(path);
        }, "unlink", path);
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
});