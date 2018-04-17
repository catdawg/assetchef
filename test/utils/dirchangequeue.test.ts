// tslint:disable:no-unused-expression
import * as chai from "chai";
const expect = chai.expect;
import * as pathutils from "path";

import {DirChangeEvent, DirEventType} from "../../src/utils/dirchangeevent";
import DirChangeQueue from "../../src/utils/dirchangequeue";

describe("dirchangequeue", () => {

    let dirChangeQueue = null;
    beforeEach(async () => {
        dirChangeQueue = new DirChangeQueue();
    });

    it("test add file", async () => {

        const path = pathutils.join("testFile.txt");
        dirChangeQueue.push(new DirChangeEvent(DirEventType.Add, path));
        expect(dirChangeQueue.isEmpty()).to.be.false;
        const event = dirChangeQueue.pop();
        expect(event.eventType).to.be.equal(DirEventType.Add);
        expect(event.path).to.be.equal(path);
        expect(dirChangeQueue.isEmpty()).to.be.true;
    });

    it("test add and change file", async () => {
        const path = pathutils.join("testFile.txt");
        dirChangeQueue.push(new DirChangeEvent(DirEventType.Add, path));
        dirChangeQueue.push(new DirChangeEvent(DirEventType.Change, path));
        expect(dirChangeQueue.isEmpty()).to.be.false;
        const event = dirChangeQueue.pop();
        expect(event.eventType).to.be.equal(DirEventType.Add);
        expect(event.path).to.be.equal(path);
        expect(dirChangeQueue.isEmpty()).to.be.true;
    });

    it("test change file twice", async () => {
        const path = pathutils.join("testFile.txt");
        dirChangeQueue.push(new DirChangeEvent(DirEventType.Change, path));
        dirChangeQueue.push(new DirChangeEvent(DirEventType.Change, path));
        expect(dirChangeQueue.isEmpty()).to.be.false;
        const event = dirChangeQueue.pop();
        expect(event.eventType).to.be.equal(DirEventType.Change);
        expect(event.path).to.be.equal(path);
        expect(dirChangeQueue.isEmpty()).to.be.true;
    });

    it("test add, change and remove file", async () => {
        const path = pathutils.join("testFile.txt");
        dirChangeQueue.push(new DirChangeEvent(DirEventType.Add, path));
        dirChangeQueue.push(new DirChangeEvent(DirEventType.Change, path));
        dirChangeQueue.push(new DirChangeEvent(DirEventType.Unlink, path));
        // unlink will make the existing add event obsolete, so both are obsolete
        expect(dirChangeQueue.isEmpty()).to.be.true;
    });

    it("test add dir", async () => {
        const path = pathutils.join("testdir");
        dirChangeQueue.push(new DirChangeEvent(DirEventType.AddDir, path));
        expect(dirChangeQueue.isEmpty()).to.be.false;
        const event = dirChangeQueue.pop();
        expect(event.eventType).to.be.equal(DirEventType.AddDir);
        expect(event.path).to.be.equal(path);
        expect(dirChangeQueue.isEmpty()).to.be.true;
    });

    it("test unlink, add dir", async () => {
        const path = pathutils.join("testdir");
        dirChangeQueue.push(new DirChangeEvent(DirEventType.UnlinkDir, path));
        dirChangeQueue.push(new DirChangeEvent(DirEventType.AddDir, path));
        expect(dirChangeQueue.isEmpty()).to.be.false;
        const event = dirChangeQueue.pop();
        expect(event.eventType).to.be.equal(DirEventType.AddDir);
        expect(event.path).to.be.equal(path);
        expect(dirChangeQueue.isEmpty()).to.be.true;
    });

    it("test add dir, and add file and dir inside", async () => {
        const path = pathutils.join("testDir");
        dirChangeQueue.push(new DirChangeEvent(DirEventType.AddDir, path));
        dirChangeQueue.push(new DirChangeEvent(DirEventType.Add, pathutils.join(path, "testFile.txt")));
        dirChangeQueue.push(new DirChangeEvent(DirEventType.AddDir, pathutils.join(path, "testDir2")));
        expect(dirChangeQueue.isEmpty()).to.be.false;
        const event = dirChangeQueue.pop();
        expect(event.eventType).to.be.equal(DirEventType.AddDir);
        expect(event.path).to.be.equal(path);
        expect(dirChangeQueue.isEmpty()).to.be.true;
    });

    it("test add two files", async () => {
        const path1 = pathutils.join("testFile1.txt");
        const path2 = pathutils.join("testFile2.txt");
        dirChangeQueue.push(new DirChangeEvent(DirEventType.Add, path1));
        dirChangeQueue.push(new DirChangeEvent(DirEventType.Add, path2));
        expect(dirChangeQueue.isEmpty()).to.be.false;
        let event = dirChangeQueue.pop();
        expect(event.eventType).to.be.equal(DirEventType.Add);
        expect(dirChangeQueue.isEmpty()).to.be.false;
        event = dirChangeQueue.pop();
        expect(event.eventType).to.be.equal(DirEventType.Add);
        expect(dirChangeQueue.isEmpty()).to.be.true;
    });

    it("test add two files, change both", async () => {
        const path1 = pathutils.join("testFile1.txt");
        const path2 = pathutils.join("testFile2.txt");
        dirChangeQueue.push(new DirChangeEvent(DirEventType.Add, path1));
        dirChangeQueue.push(new DirChangeEvent(DirEventType.Add, path2));
        dirChangeQueue.push(new DirChangeEvent(DirEventType.Change, path1));
        dirChangeQueue.push(new DirChangeEvent(DirEventType.Change, path2));

        expect(dirChangeQueue.isEmpty()).to.be.false;
        let event = dirChangeQueue.pop();
        expect(event.eventType).to.be.equal(DirEventType.Add);
        expect(dirChangeQueue.isEmpty()).to.be.false;
        event = dirChangeQueue.pop();
        expect(event.eventType).to.be.equal(DirEventType.Add);
        expect(dirChangeQueue.isEmpty()).to.be.true;
    });

    it("peek while empty", () => {

        expect(dirChangeQueue.peek()).to.be.null;
    });

    it("simple peek", async () => {

        const path = pathutils.join("testFile.txt");
        dirChangeQueue.push(new DirChangeEvent(DirEventType.Add, path));

        const event = dirChangeQueue.peek();

        expect(event.eventType).to.be.equal(DirEventType.Add);
        expect(event.path).to.be.equal(path);
    });

    it("domain changed callback file added and changed", async () => {

        const path = pathutils.join("testFile.txt");
        dirChangeQueue.push(new DirChangeEvent(DirEventType.Add, path));
        await new Promise ((resolve) => {
            const event = dirChangeQueue.peek(() => {
                resolve();
            });

            expect(event.eventType).to.be.equal(DirEventType.Add);
            expect(event.path).to.be.equal(path);

            dirChangeQueue.push(new DirChangeEvent(DirEventType.Change, path));
        });
    });
    it("domain changed callback file changed twice", async () => {

        const path = pathutils.join("testFile.txt");
        dirChangeQueue.push(new DirChangeEvent(DirEventType.Change, path));

        await new Promise((resolve) => {
            const event = dirChangeQueue.peek(() => {
                resolve();
            });
            expect(event.eventType).to.be.equal(DirEventType.Change);

            dirChangeQueue.push(new DirChangeEvent(DirEventType.Change, path));
        });
    });

    it("domain changed callback file added inside dir", async () => {

        const path = pathutils.join("testDir");
        dirChangeQueue.push(new DirChangeEvent(DirEventType.AddDir, path));
        await new Promise((resolve) => {
            const event = dirChangeQueue.peek(() => {
                resolve();
            });
            expect(event.eventType).to.be.equal(DirEventType.AddDir);
            dirChangeQueue.push(new DirChangeEvent(DirEventType.Add, pathutils.join(path, "testFile.txt")));
        });
    });

    it("domain changed callback not called for different files", async () => {

        const path = pathutils.join("testFile.txt");
        dirChangeQueue.push(new DirChangeEvent(DirEventType.Add, path));
        dirChangeQueue.peek(() => {
            throw new Error("shouldn't have called this");
        });
        const path2 = pathutils.join("testFile2.txt");
        dirChangeQueue.push(new DirChangeEvent(DirEventType.Add, path2));
    });
});
