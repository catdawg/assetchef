"use strict";
/* eslint-env mocha */

const expect = require("chai").expect;
const tmp = require("tmp");
const fse = require("fs-extra");
const VError = require("verror").VError;
const pathutils = require("path");

const watchdirectory = require("../../lib/utils/watchdirectory");

describe("watchdirectory", function () {

    this.timeout(5000);

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
    beforeEach(function (done) {
        fse.copySync(__dirname + "/../../test_directories/test_watchdirectory", tmpDir.name);
        setTimeout(done, 3000); // make sure all changes are flushed
    });

    afterEach(function (done) {

        const files = fse.readdirSync(tmpDir.name);
        for (const file of files) {
            fse.removeSync(pathutils.join(tmpDir.name, file));
        }

        setTimeout(done, 3000); // make sure all changes are flushed
    });

    after(function () {
        watcher.cancel();
    });

    /**
     * Triggers the change method, and checks if the watch triggers the change
     * @param {function} changeMethod - The method that changes
     * @param {function} done - Called after it finishes testing
     * @returns {undefined}
     */
    function testOneDirChange(changeMethod, expectedEvent, expectedPath, done) {
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
            done();
        };
        
        changeMethod();
        
        setTimeout(function() {
            if (!doneCalled)
            {
                currentCallback = null;
                doneCalled = true;
                done(new Error("change not triggered"));
            }
        }, 3000);
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

    it("file change should trigger", function (done) {
        const path = pathutils.join(tmpDir.name, "file1.txt");
        testOneDirChange(function () {
            touchFile(path);
        }, "change", path, done);
    });

    it("file change inside dir should trigger", function (done) {
        const path = pathutils.join(tmpDir.name, "dir", "file2.txt");
        testOneDirChange(function () {
            touchFile(path);
        }, "change", path, done);
    });


    it("add file change should trigger", function (done) {
        const path = pathutils.join(tmpDir.name, "newfile.txt");
        testOneDirChange(function () {
            fse.writeFileSync(path);
        }, "add", path, done);
    });

    it("add dir change should trigger", function (done) {
        const path = pathutils.join(tmpDir.name, "newdir");
        testOneDirChange(function () {
            fse.mkdirSync(path);
        }, "addDir", path, done);
    });
    it("remove dir change should trigger", function (done) {
        const path = pathutils.join(tmpDir.name, "dir");
        testOneDirChange(function () {
            fse.removeSync(path);
        }, "unlinkDir", path, done);
    });

    it("remove file change should trigger", function (done) {
        const path = pathutils.join(tmpDir.name, "file1.txt");
        testOneDirChange(function () {
            fse.removeSync(path);
        }, "unlink", path, done);
    });

    it("no change should not trigger", function (done) {
        currentCallback = function () {
            done(new Error("shouldn't have changed"));
        };

        setTimeout(function () {
            currentCallback = null;
            done();
        }, 4000);
    });
});