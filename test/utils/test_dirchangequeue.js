"use strict";
/* eslint-env mocha */

const expect = require("chai").expect;
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
});

describe("dirchangequeue", function () {
    
    let dirChangeQueue = null;
    beforeEach(async function () {
        dirChangeQueue = new DirChangeQueue();
    });

    it("test add file", async function () {

        const path = pathutils.join("testFile.txt");
        dirChangeQueue.push("add", path);
        expect(dirChangeQueue.isEmpty()).to.be.false;
        const event = dirChangeQueue.pop();
        expect(event.eventType).to.be.equal("add");
        expect(event.path).to.be.equal(path);
        expect(dirChangeQueue.isEmpty()).to.be.true;
    });

    it("test add and change file", async function () {
        const path = pathutils.join("testFile.txt");
        dirChangeQueue.push("add", path);
        dirChangeQueue.push("change", path);
        expect(dirChangeQueue.isEmpty()).to.be.false;
        const event = dirChangeQueue.pop();
        expect(event.eventType).to.be.equal("add");
        expect(event.path).to.be.equal(path);
        expect(dirChangeQueue.isEmpty()).to.be.true;
    });

    it("test change file twice", async function () {
        const path = pathutils.join("testFile.txt");
        dirChangeQueue.push("change", path);
        dirChangeQueue.push("change", path);
        expect(dirChangeQueue.isEmpty()).to.be.false;
        const event = dirChangeQueue.pop();
        expect(event.eventType).to.be.equal("change");
        expect(event.path).to.be.equal(path);
        expect(dirChangeQueue.isEmpty()).to.be.true;
    });

    it("test add, change and remove file", async function () {
        const path = pathutils.join("testFile.txt");
        dirChangeQueue.push("add", path);
        dirChangeQueue.push("change", path);
        dirChangeQueue.push("unlink", path);
        //unlink will make the existing add event obsolete, so both are obsolete
        expect(dirChangeQueue.isEmpty()).to.be.true;
    });

    it("test add dir", async function () {
        const path = pathutils.join("testdir");
        dirChangeQueue.push("addDir", path);
        expect(dirChangeQueue.isEmpty()).to.be.false;
        const event = dirChangeQueue.pop();
        expect(event.eventType).to.be.equal("addDir");
        expect(event.path).to.be.equal(path);
        expect(dirChangeQueue.isEmpty()).to.be.true;
    });

    it("test add dir, and add file and dir inside", async function () {
        const path = pathutils.join("testDir");
        dirChangeQueue.push("addDir", path);
        dirChangeQueue.push("add", pathutils.join(path, "testFile.txt"));
        dirChangeQueue.push("addDir", pathutils.join(path, "testDir2"));
        expect(dirChangeQueue.isEmpty()).to.be.false;
        const event = dirChangeQueue.pop();
        expect(event.eventType).to.be.equal("addDir");
        expect(event.path).to.be.equal(path);
        expect(dirChangeQueue.isEmpty()).to.be.true;
    });

    it("test add two files", async function () {
        const path1 = pathutils.join("testFile1.txt");
        const path2 = pathutils.join("testFile2.txt");
        dirChangeQueue.push("add", path1);
        dirChangeQueue.push("add", path2);
        expect(dirChangeQueue.isEmpty()).to.be.false;
        let event = dirChangeQueue.pop();
        expect(event.eventType).to.be.equal("add");
        expect(dirChangeQueue.isEmpty()).to.be.false;
        event = dirChangeQueue.pop();
        expect(event.eventType).to.be.equal("add");
        expect(dirChangeQueue.isEmpty()).to.be.true;
    });
    
    it("test add two files, change both", async function () {
        const path1 = pathutils.join("testFile1.txt");
        const path2 = pathutils.join("testFile2.txt");
        dirChangeQueue.push("add", path1);
        dirChangeQueue.push("add", path2);
        dirChangeQueue.push("change", path1);
        dirChangeQueue.push("change", path2);

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

        const path = pathutils.join("testFile.txt");
        dirChangeQueue.push("add", path);
        await new Promise ((resolve) => {
            const event = dirChangeQueue.peek(function () {
                resolve();
            });

            expect(event.eventType).to.be.equal("add");
            expect(event.path).to.be.equal(path);

            dirChangeQueue.push("change", path);
        });
    });
    it("domain changed callback file changed twice", async function () {
        
        const path = pathutils.join("testFile.txt");
        dirChangeQueue.push("change", path);

        await new Promise((resolve) => {
            const event = dirChangeQueue.peek(function () {
                resolve();
            });
            expect(event.eventType).to.be.equal("change");

            dirChangeQueue.push("change", path);
        });
    });
    
    it("domain changed callback file added inside dir", async function () {
        
        const path = pathutils.join("testDir");
        dirChangeQueue.push("addDir", path);
        await new Promise((resolve) => {
            const event = dirChangeQueue.peek(function () {
                resolve();
            });
            expect(event.eventType).to.be.equal("addDir");
            dirChangeQueue.push("add", pathutils.join(path, "testFile.txt"));
        });
    });

    it("domain changed callback not called for different files", async function () {
        
        const path = pathutils.join("testFile.txt");
        dirChangeQueue.push("add", path);
        dirChangeQueue.peek(function () {
            throw new Error("shouldn't have called this");
        });
        const path2 = pathutils.join("testFile2.txt");
        dirChangeQueue.push("add", path2);
    });
});