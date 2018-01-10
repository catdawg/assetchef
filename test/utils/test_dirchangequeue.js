"use strict";
/* eslint-env mocha */

const expect = require("chai").expect;
const tmp = require("tmp");
const fse = require("fs-extra");
const VError = require("verror").VError;
const pathutils = require("path");
const timeout = require("../../lib/utils/timeout");

const DirChangeQueue = require("../../lib/utils/dirchangequeue");
const DirWatcher = require("../../lib/utils/dirwatcher");
const DirChangeEvent = DirChangeQueue._DirChangeEvent;

const DEFAULT_TIMEOUT = 3000;

describe("dirchangequeue event comparison", function () {

    it("different test", function () {
        const first = new DirChangeEvent("change", "/a/path/to/somefile");
        const second = new DirChangeEvent("change", "/a/path/to/anotherfile");

        expect(DirChangeEvent.compareEvents(first, second)).to.be.equal(DirChangeEvent.EventComparisonEnum.Different);
        expect(DirChangeEvent.compareEvents(second, first)).to.be.equal(DirChangeEvent.EventComparisonEnum.Different);
    });

    it("equal test", function () {
        const first = new DirChangeEvent("change", "/a/path/to/somefile");
        const second = new DirChangeEvent("change", "/a/path/to/somefile");

        expect(DirChangeEvent.compareEvents(first, second)).to.be.equal(DirChangeEvent.EventComparisonEnum.SecondMakesFirstObsolete);
        expect(DirChangeEvent.compareEvents(second, first)).to.be.equal(DirChangeEvent.EventComparisonEnum.SecondMakesFirstObsolete);
    });

    it("same file events test", function () {
        const first = new DirChangeEvent("add", "/a/path/to/somefile");
        const second = new DirChangeEvent("unlink", "/a/path/to/somefile");

        expect(DirChangeEvent.compareEvents(first, second)).to.be.equal(DirChangeEvent.EventComparisonEnum.BothObsolete);
        expect(DirChangeEvent.compareEvents(second, first)).to.be.equal(DirChangeEvent.EventComparisonEnum.SecondMakesFirstObsolete);
    });

    it("same dir events test", function () {
        const first = new DirChangeEvent("addDir", "/a/path/to/somedir");
        const second = new DirChangeEvent("unlinkDir", "/a/path/to/somedir");

        expect(DirChangeEvent.compareEvents(first, second)).to.be.equal(DirChangeEvent.EventComparisonEnum.BothObsolete);
        expect(DirChangeEvent.compareEvents(second, first)).to.be.equal(DirChangeEvent.EventComparisonEnum.SecondMakesFirstObsolete);
    });

    it("file inside dir with addDir event test", function () {
        const first = new DirChangeEvent("addDir", "/a/path/to/somedir");
        const second = new DirChangeEvent("add", "/a/path/to/somedir/somefile");

        expect(DirChangeEvent.compareEvents(first, second)).to.be.equal(DirChangeEvent.EventComparisonEnum.FirstMakesSecondObsolete);
        expect(DirChangeEvent.compareEvents(second, first)).to.be.equal(DirChangeEvent.EventComparisonEnum.SecondMakesFirstObsolete);
    });

    it("file inside dir with add event error test", function () {
        const first = new DirChangeEvent("add", "/a/path/to/somedir");
        const second = new DirChangeEvent("add", "/a/path/to/somedir/somefile");

        expect(DirChangeEvent.compareEvents.bind(null, first, second)).to.throw(VError);
        expect(DirChangeEvent.compareEvents.bind(null, second, first)).to.throw(VError);
    }); 

    it("file inside dir with add event error test", function () {
        const first = new DirChangeEvent("add", "/a/path/to/somedir");
        const second = new DirChangeEvent("add", "/a/path/to/somedir/somefile");

        expect(DirChangeEvent.compareEvents.bind(null, first, second)).to.throw(VError);
        expect(DirChangeEvent.compareEvents.bind(null, second, first)).to.throw(VError);
    }); 
});

describe("dirchangequeue parameters", function () {

    it("test parameters", function () {
        
        expect(() => new DirChangeQueue()).to.throw(VError);
    });
});

describe("dirchangequeue", function () {
    
    this.timeout(20000);

    let tmpDir = null;
    let dirWatcher = null;
    let dirChangeQueue = null;
    before(function () {
        tmpDir = tmp.dirSync({"keep": true});
        dirWatcher = new DirWatcher(tmpDir.name);
        dirChangeQueue = new DirChangeQueue(dirWatcher);
    });
    beforeEach(async function () {
        await timeout(DEFAULT_TIMEOUT);
        while (!dirChangeQueue.isEmpty()) {
            dirChangeQueue.pop();
        }
    });

    afterEach(async function () {

        while (!dirChangeQueue.isEmpty()) {
            dirChangeQueue.pop();
        }
        fse.readdir(tmpDir.name, function(_, files) {
            
            for (const file of files) {
                fse.remove(pathutils.join(tmpDir.name, file));
            }
        });
        await timeout(DEFAULT_TIMEOUT); // make sure all changes are flushed
        while (!dirChangeQueue.isEmpty()) {
            dirChangeQueue.pop();
        }
    });

    after(function (done) {
        dirWatcher.cancel();
        fse.remove(tmpDir.name, done);
    });
    
    /**
     * Waits some time for an event with name and process it.
     * @param {string} expectedEventType - The expected event
     * @returns {Promise} the promise for the event
     */
    async function waitForEvent(expectedEventType) {
        await timeout(2500);
        expect(dirChangeQueue.isEmpty()).to.be.false;
        const event = dirChangeQueue.pop();
        expect(event.eventType).to.be.equal(expectedEventType);
    }
    /**
     * Waits some time for an event with name but doesn't process it.
     * @param {string} expectedEventType - The expected event
     * @returns {Promise} the promise for the event
     */
    async function waitForEventWithoutProcessing(expectedEventType) {
        await timeout(2500);
        expect(dirChangeQueue.isEmpty()).to.be.false;
        const event = dirChangeQueue.peek();
        expect(event.eventType).to.be.equal(expectedEventType);
    }

    it("test add file", async function () {
        const path = pathutils.join(tmpDir.name, "testFile.txt");
        await fse.createFile(path);
        await timeout(DEFAULT_TIMEOUT); 
        expect(dirChangeQueue.isEmpty()).to.be.false;
        const event = dirChangeQueue.pop();
        expect(event.eventType).to.be.equal("add");
        expect(event.path).to.be.equal(path);
        expect(dirChangeQueue.isEmpty()).to.be.true;
    });

    it("test add and change file", async function () {
        const path = pathutils.join(tmpDir.name, "testFile.txt");
        await fse.createFile(path);
        await timeout(DEFAULT_TIMEOUT);
        await fse.appendFile(path, "some content");
        await timeout(DEFAULT_TIMEOUT);
        expect(dirChangeQueue.isEmpty()).to.be.false;
        const event = dirChangeQueue.pop();
        expect(event.eventType).to.be.equal("add");
        expect(event.path).to.be.equal(path);
        expect(dirChangeQueue.isEmpty()).to.be.true;
    });

    it("test add and change file twice", async function () {
        // two touches spaced out between at least 2 seconds should only yield one change event
        const path = pathutils.join(tmpDir.name, "testFile.txt");
        await fse.createFile(path);
        await waitForEvent("add");
        expect(dirChangeQueue.isEmpty()).to.be.true;
        await fse.appendFile(path, "some content");
        await timeout(DEFAULT_TIMEOUT);
        expect(dirChangeQueue.isEmpty()).to.be.false;
        await fse.appendFile(path, "some content");
        await timeout(DEFAULT_TIMEOUT);
        expect(dirChangeQueue.isEmpty()).to.be.false;
        const event = dirChangeQueue.pop();
        expect(event.eventType).to.be.equal("change");
        expect(event.path).to.be.equal(path);
        expect(dirChangeQueue.isEmpty()).to.be.true;
    });

    it("test add, change and remove file", async function () {
        const path = pathutils.join(tmpDir.name, "testFile.txt");
        await fse.createFile(path);
        await waitForEventWithoutProcessing("add");
        await fse.appendFile(path, "some content");
        await waitForEventWithoutProcessing("add");
        await fse.remove(path);
        await timeout(DEFAULT_TIMEOUT);
        //unlink will make the existing add event obsolete, so both are obsolete
        expect(dirChangeQueue.isEmpty()).to.be.true;
    });

    it("test add dir", async function () {
        const path = pathutils.join(tmpDir.name, "testdir");
        await fse.mkdirp(path);
        await timeout(DEFAULT_TIMEOUT);
        expect(dirChangeQueue.isEmpty()).to.be.false;
        const event = dirChangeQueue.pop();
        expect(event.eventType).to.be.equal("addDir");
        expect(event.path).to.be.equal(path);
        expect(dirChangeQueue.isEmpty()).to.be.true;
    });

    it("test add dir, and add file and dir inside", async function () {
        const path = pathutils.join(tmpDir.name, "testdir");
        await fse.mkdirp(path);
        await timeout(DEFAULT_TIMEOUT);
        await fse.createFile(pathutils.join(path, "testFile.txt"));
        await timeout(DEFAULT_TIMEOUT);
        await fse.mkdirp(pathutils.join(path, "testDir"));
        await timeout(DEFAULT_TIMEOUT);
        expect(dirChangeQueue.isEmpty()).to.be.false;
        const event = dirChangeQueue.pop();
        expect(event.eventType).to.be.equal("addDir");
        expect(event.path).to.be.equal(path);
        expect(dirChangeQueue.isEmpty()).to.be.true;
    });

    it("test add two files", async function () {
        const path1 = pathutils.join(tmpDir.name, "testFile1.txt");
        const path2 = pathutils.join(tmpDir.name, "testFile2.txt");
        await fse.createFile(path1);
        await fse.createFile(path2);
        await fse.appendFile(path1, "some content"); // linux doesn't detect empty files well.
        await fse.appendFile(path2, "some content");
        await timeout(DEFAULT_TIMEOUT);
        expect(dirChangeQueue.isEmpty()).to.be.false;
        let event = dirChangeQueue.pop();
        expect(event.eventType).to.be.equal("add");
        expect(dirChangeQueue.isEmpty()).to.be.false;
        event = dirChangeQueue.pop();
        expect(event.eventType).to.be.equal("add");
        expect(dirChangeQueue.isEmpty()).to.be.true;
    });
    
    it("test add two files, change both", async function () {
        const path1 = pathutils.join(tmpDir.name, "testFile1.txt");
        const path2 = pathutils.join(tmpDir.name, "testFile2.txt");
        await fse.createFile(path1);
        await fse.createFile(path2);
        await timeout(DEFAULT_TIMEOUT);
        await fse.appendFile(path1, "some content");
        await fse.appendFile(path2, "some content");
        await timeout(DEFAULT_TIMEOUT);

        expect(dirChangeQueue.isEmpty()).to.be.false;
        let event = dirChangeQueue.pop();
        expect(event.eventType).to.be.equal("add");
        expect(dirChangeQueue.isEmpty()).to.be.false;
        event = dirChangeQueue.pop();
        expect(event.eventType).to.be.equal("add");
        expect(dirChangeQueue.isEmpty()).to.be.true;
    });

    it("peek while empty", function () {
        
        expect(dirChangeQueue.peek()).to.be.null;
    });

    it("domain changed callback file added and changed", async function () {

        const path = pathutils.join(tmpDir.name, "testFile.txt");
        await fse.createFile(path);
        await timeout(DEFAULT_TIMEOUT);
        await new Promise ((resolve) => {
            const event = dirChangeQueue.peek(function () {
                resolve();
            });

            expect(event.eventType).to.be.equal("add");
            expect(event.path).to.be.equal(path);

            fse.appendFile(path, "some content");
        });
    });
    it("domain changed callback file changed twice", async function () {
        
        const path = pathutils.join(tmpDir.name, "testFile.txt");
        await fse.createFile(path);
        await waitForEvent("add");
        await fse.appendFile(path, "some content");
        await waitForEventWithoutProcessing("change");

        await new Promise((resolve) => {
            const event = dirChangeQueue.peek(function () {
                resolve();
            });
            expect(event.eventType).to.be.equal("change");

            fse.appendFile(path, "some content");
        });
    });
    
    it("domain changed callback file added inside dir", async function () {
        
        const path = pathutils.join(tmpDir.name, "testdir");
        await fse.mkdirp(path);
        await waitForEventWithoutProcessing("addDir");
        await new Promise((resolve) => {
            const event = dirChangeQueue.peek(function () {
                resolve();
            });
            expect(event.eventType).to.be.equal("addDir");
            fse.createFile(pathutils.join(path, "testFile.txt"));
        });
    });

    it("domain changed callback not called for different files", async function () {
        
        let path = pathutils.join(tmpDir.name, "testFile.txt");
        await fse.createFile(path);
        await waitForEventWithoutProcessing("add");
        const event = dirChangeQueue.peek(function () {
            throw new Error("shouldn't have called this");
        });
        expect(event.eventType).to.be.equal("add");
        path = pathutils.join(tmpDir.name, "testFile1.txt");
        await fse.createFile(path);
        await timeout(4000);
    });
});