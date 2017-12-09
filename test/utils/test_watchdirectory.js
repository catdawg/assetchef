"use strict";
/* eslint-env mocha */

const expect = require("chai").expect;
const tmp = require("tmp");
const fse = require("fs-extra");
const VError = require("verror").VError;

const watchdirectory = require("../../lib/utils/watchdirectory");

describe("watchdirectory", function () {

    let tmpDir = null;
    beforeEach(function () {
        tmpDir = tmp.dirSync({"unsafeCleanup": true});
        fse.copySync(__dirname + "/../../test_directories/test_watchdirectory", tmpDir.name);
    });

    afterEach(function (done) {
        fse.remove(tmpDir.name, done);
    });

    /**
     * Watches the tmp directory, triggers the change method, and checks if the watch triggers the change
     * @param {function} changeMethod - The method that changes
     * @param {function} done - Called after it finishes testing
     */
    function testOneDirChange(changeMethod, done) {
    
        let doneCalled = false;
        const cancel = watchdirectory.watchForAChange(tmpDir.name, function () {
            doneCalled = true;
            done();
        });
        
        setTimeout(function () {
            changeMethod();
    
            setTimeout(function() {
                cancel.cancel();
                if (!doneCalled)
                {
                    done(new Error("change not triggered"));
                }
            }, 500);
        }, 500);
    }

    /**
     * Appends "new content" to a file.
     * @param {string} file - The directory to watch
     */
    function touchFile(file) {

        const logStream = fse.createWriteStream(file, {"flags": "a"});
        logStream.write(" new content");
        logStream.end("");
    }

    it("test parameters", function () {

        expect(watchdirectory.watchForAChange.bind(null, null, null)).to.throw(VError);
        expect(watchdirectory.watchForAChange.bind(null, tmpDir.name, null)).to.throw(VError);
        expect(watchdirectory.watchForAChange.bind(null, "dir that doesn't exist", function() {})).to.throw(VError);
    });

    it("file change should trigger", function (done) {
        testOneDirChange(function () {
            touchFile(tmpDir.name + "/file1.txt");
        }, done);
    });

    it("file change inside dir should trigger", function (done) {
        testOneDirChange(function () {
            touchFile(tmpDir.name + "/dir/file2.txt");
        }, done);
    });


    it("add file change should trigger", function (done) {
        testOneDirChange(function () {
            fse.writeFileSync(tmpDir.name + "/newfile.txt");
        }, done);
    });


    it("add dir change should trigger", function (done) {
        testOneDirChange(function () {
            fse.mkdirSync(tmpDir.name + "/newdir/");
        }, done);
    });

    it("no change should not trigger", function (done) {
        const cancel = watchdirectory.watchForAChange(tmpDir.name, function () {
            done(new Error("shouldn't have changed"));
        });

        setTimeout(function () {
            cancel.cancel();
            done();
        }, 200);
    });
});