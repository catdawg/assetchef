"use strict";
/* eslint-env mocha */

const utils = require("../utils");
const timeout = utils.timeout;

const expect = require("chai").expect;
const tmp = require("tmp");
const fse = require("fs-extra");
const VError = require("verror").VError;
const pathutils = require("path");


const DirChangeQueue = require("../../lib/utils/dirchangequeue");
const DirChangeEvent = DirChangeQueue._DirChangeEvent;


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
        expect(() => new DirChangeQueue("/dir/that/doesnt/exist")).to.throw(VError);
    });
});

describe("dirchangequeue", function () {
    
    this.timeout(10000);

    let tmpDir = null;
    let dirChangeQueue = null;
    before(function () {
        tmpDir = tmp.dirSync({"keep": true});
        dirChangeQueue = new DirChangeQueue(tmpDir.name);
    });
    beforeEach(async function () {
        await timeout(3000);
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
        await timeout(3000); // make sure all changes are flushed
        while (!dirChangeQueue.isEmpty()) {
            dirChangeQueue.pop();
        }
    });

    after(function (done) {
        dirChangeQueue.cancel();
        fse.remove(tmpDir.name, done);
    });

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
        await timeout(3000); 
        expect(dirChangeQueue.isEmpty()).to.be.false;
        const event = dirChangeQueue.pop();
        expect(event.eventType).to.be.equal("add");
        expect(event.path).to.be.equal(path);
        expect(dirChangeQueue.isEmpty()).to.be.true;
    });

    it("test add and change file", async function () {
        const path = pathutils.join(tmpDir.name, "testFile.txt");
        await fse.createFile(path);
        await timeout(3000);
        touchFile(path);
        await timeout(3000);
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
        touchFile(path);
        await timeout(3000);
        expect(dirChangeQueue.isEmpty()).to.be.false;
        touchFile(path);
        await timeout(3000);
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
        await touchFile(path);
        await waitForEventWithoutProcessing("add");
        await fse.remove(path)
        await timeout(3000);
        //unlink will make the existing add event obsolete, so both are obsolete
        expect(dirChangeQueue.isEmpty()).to.be.true;
    });

    it("test add dir", async function () {
        const path = pathutils.join(tmpDir.name, "testdir");
        await fse.mkdirp(path);
        await timeout(3000);
        expect(dirChangeQueue.isEmpty()).to.be.false;
        const event = dirChangeQueue.pop();
        expect(event.eventType).to.be.equal("addDir");
        expect(event.path).to.be.equal(path);
        expect(dirChangeQueue.isEmpty()).to.be.true;
    });

    it("test add dir, and add file and dir inside", async function () {
        const path = pathutils.join(tmpDir.name, "testdir");
        await fse.mkdirp(path);
        await timeout(3000);
        await fse.createFile(pathutils.join(path, "testFile.txt"));
        await timeout(3000);
        await fse.mkdirp(pathutils.join(path, "testDir"));
        await timeout(3000);
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
        await timeout(3000);
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
        await timeout(3000);
        touchFile(path1);
        touchFile(path2);
        await timeout(3000);

        expect(dirChangeQueue.isEmpty()).to.be.false;
        let event = dirChangeQueue.pop();
        expect(event.eventType).to.be.equal("add");
        expect(dirChangeQueue.isEmpty()).to.be.false;
        event = dirChangeQueue.pop();
        expect(event.eventType).to.be.equal("add");
        expect(dirChangeQueue.isEmpty()).to.be.true;
    });

    it("cancel twice", function () {

        const newDirChangeQueue = new DirChangeQueue(tmpDir.name);
        newDirChangeQueue.cancel();
        expect(newDirChangeQueue.cancel.bind(newDirChangeQueue)).to.throw(VError);
    });

    it("peek while empty", function () {
        
        expect(dirChangeQueue.peek()).to.be.null;
    });

    it("domain changed callback file added and changed", async function () {

        const path = pathutils.join(tmpDir.name, "testFile.txt");
        await fse.createFile(path);
        await timeout(3000);
        await new Promise ((resolve) => {
            const event = dirChangeQueue.peek(function () {
                resolve();
            });

            expect(event.eventType).to.be.equal("add");
            expect(event.path).to.be.equal(path);

            touchFile(path);
        });
    });
    it("domain changed callback file changed twice", async function () {
        
        const path = pathutils.join(tmpDir.name, "testFile.txt");
        await fse.createFile(path);
        await waitForEvent("add");
        touchFile(path);
        await waitForEventWithoutProcessing("change");

        await new Promise((resolve) => {
            const event = dirChangeQueue.peek(function () {
                resolve();
            });
            expect(event.eventType).to.be.equal("change");

            touchFile(path);
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