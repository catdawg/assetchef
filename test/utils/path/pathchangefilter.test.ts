// tslint:disable:no-unused-expression
import * as chai from "chai";
const expect = chai.expect;
import * as pathutils from "path";

import {PathChangeEvent, PathEventType} from "../../../src/utils/path/pathchangeevent";
import PathChangeFilter from "../../../src/utils/path/pathchangefilter";

describe("pathchangequeue", () => {

    let pathChangeFilter = null;
    beforeEach(async () => {
        pathChangeFilter = new PathChangeFilter();
    });

    it("test add file", async () => {

        const path = pathutils.join("testFile.txt");
        pathChangeFilter.push(new PathChangeEvent(PathEventType.Add, path));
        expect(pathChangeFilter.isEmpty()).to.be.false;
        const event = pathChangeFilter.pop();
        expect(event.eventType).to.be.equal(PathEventType.Add);
        expect(event.path).to.be.equal(path);
        expect(pathChangeFilter.isEmpty()).to.be.true;
    });

    it("test add and change file", async () => {
        const path = pathutils.join("testFile.txt");
        pathChangeFilter.push(new PathChangeEvent(PathEventType.Add, path));
        pathChangeFilter.push(new PathChangeEvent(PathEventType.Change, path));
        expect(pathChangeFilter.isEmpty()).to.be.false;
        const event = pathChangeFilter.pop();
        expect(event.eventType).to.be.equal(PathEventType.Add);
        expect(event.path).to.be.equal(path);
        expect(pathChangeFilter.isEmpty()).to.be.true;
    });

    it("test change file twice", async () => {
        const path = pathutils.join("testFile.txt");
        pathChangeFilter.push(new PathChangeEvent(PathEventType.Change, path));
        pathChangeFilter.push(new PathChangeEvent(PathEventType.Change, path));
        expect(pathChangeFilter.isEmpty()).to.be.false;
        const event = pathChangeFilter.pop();
        expect(event.eventType).to.be.equal(PathEventType.Change);
        expect(event.path).to.be.equal(path);
        expect(pathChangeFilter.isEmpty()).to.be.true;
    });

    it("test add, change and remove file", async () => {
        const path = pathutils.join("testFile.txt");
        pathChangeFilter.push(new PathChangeEvent(PathEventType.Add, path));
        pathChangeFilter.push(new PathChangeEvent(PathEventType.Change, path));
        pathChangeFilter.push(new PathChangeEvent(PathEventType.Unlink, path));
        // unlink will make the existing add event obsolete, so both are obsolete
        expect(pathChangeFilter.isEmpty()).to.be.true;
    });

    it("test add dir", async () => {
        const path = pathutils.join("testdir");
        pathChangeFilter.push(new PathChangeEvent(PathEventType.AddDir, path));
        expect(pathChangeFilter.isEmpty()).to.be.false;
        const event = pathChangeFilter.pop();
        expect(event.eventType).to.be.equal(PathEventType.AddDir);
        expect(event.path).to.be.equal(path);
        expect(pathChangeFilter.isEmpty()).to.be.true;
    });

    it("test unlink, add dir", async () => {
        const path = pathutils.join("testdir");
        pathChangeFilter.push(new PathChangeEvent(PathEventType.UnlinkDir, path));
        pathChangeFilter.push(new PathChangeEvent(PathEventType.AddDir, path));
        expect(pathChangeFilter.isEmpty()).to.be.false;
        const event = pathChangeFilter.pop();
        expect(event.eventType).to.be.equal(PathEventType.AddDir);
        expect(event.path).to.be.equal(path);
        expect(pathChangeFilter.isEmpty()).to.be.true;
    });

    it("test add dir, and add file and dir inside", async () => {
        const path = pathutils.join("testDir");
        pathChangeFilter.push(new PathChangeEvent(PathEventType.AddDir, path));
        pathChangeFilter.push(new PathChangeEvent(PathEventType.Add, pathutils.join(path, "testFile.txt")));
        pathChangeFilter.push(new PathChangeEvent(PathEventType.AddDir, pathutils.join(path, "testDir2")));
        expect(pathChangeFilter.isEmpty()).to.be.false;
        const event = pathChangeFilter.pop();
        expect(event.eventType).to.be.equal(PathEventType.AddDir);
        expect(event.path).to.be.equal(path);
        expect(pathChangeFilter.isEmpty()).to.be.true;
    });

    it("test add two files", async () => {
        const path1 = pathutils.join("testFile1.txt");
        const path2 = pathutils.join("testFile2.txt");
        pathChangeFilter.push(new PathChangeEvent(PathEventType.Add, path1));
        pathChangeFilter.push(new PathChangeEvent(PathEventType.Add, path2));
        expect(pathChangeFilter.isEmpty()).to.be.false;
        let event = pathChangeFilter.pop();
        expect(event.eventType).to.be.equal(PathEventType.Add);
        expect(pathChangeFilter.isEmpty()).to.be.false;
        event = pathChangeFilter.pop();
        expect(event.eventType).to.be.equal(PathEventType.Add);
        expect(pathChangeFilter.isEmpty()).to.be.true;
    });

    it("test add two files, change both", async () => {
        const path1 = pathutils.join("testFile1.txt");
        const path2 = pathutils.join("testFile2.txt");
        pathChangeFilter.push(new PathChangeEvent(PathEventType.Add, path1));
        pathChangeFilter.push(new PathChangeEvent(PathEventType.Add, path2));
        pathChangeFilter.push(new PathChangeEvent(PathEventType.Change, path1));
        pathChangeFilter.push(new PathChangeEvent(PathEventType.Change, path2));

        expect(pathChangeFilter.isEmpty()).to.be.false;
        let event = pathChangeFilter.pop();
        expect(event.eventType).to.be.equal(PathEventType.Add);
        expect(pathChangeFilter.isEmpty()).to.be.false;
        event = pathChangeFilter.pop();
        expect(event.eventType).to.be.equal(PathEventType.Add);
        expect(pathChangeFilter.isEmpty()).to.be.true;
    });

    it("peek while empty", () => {

        expect(pathChangeFilter.peek()).to.be.null;
    });

    it("simple peek", async () => {

        const path = pathutils.join("testFile.txt");
        pathChangeFilter.push(new PathChangeEvent(PathEventType.Add, path));

        const event = pathChangeFilter.peek();

        expect(event.eventType).to.be.equal(PathEventType.Add);
        expect(event.path).to.be.equal(path);
    });

    it("domain changed callback file added and changed", async () => {

        const path = pathutils.join("testFile.txt");
        pathChangeFilter.push(new PathChangeEvent(PathEventType.Add, path));
        await new Promise ((resolve) => {
            const event = pathChangeFilter.peek(() => {
                resolve();
            });

            expect(event.eventType).to.be.equal(PathEventType.Add);
            expect(event.path).to.be.equal(path);

            pathChangeFilter.push(new PathChangeEvent(PathEventType.Change, path));
        });
    });
    it("domain changed callback file changed twice", async () => {

        const path = pathutils.join("testFile.txt");
        pathChangeFilter.push(new PathChangeEvent(PathEventType.Change, path));

        await new Promise((resolve) => {
            const event = pathChangeFilter.peek(() => {
                resolve();
            });
            expect(event.eventType).to.be.equal(PathEventType.Change);

            pathChangeFilter.push(new PathChangeEvent(PathEventType.Change, path));
        });
    });

    it("domain changed callback file added inside dir", async () => {

        const path = pathutils.join("testDir");
        pathChangeFilter.push(new PathChangeEvent(PathEventType.AddDir, path));
        await new Promise((resolve) => {
            const event = pathChangeFilter.peek(() => {
                resolve();
            });
            expect(event.eventType).to.be.equal(PathEventType.AddDir);
            pathChangeFilter.push(new PathChangeEvent(PathEventType.Add, pathutils.join(path, "testFile.txt")));
        });
    });

    it("domain changed callback not called for different files", async () => {

        const path = pathutils.join("testFile.txt");
        pathChangeFilter.push(new PathChangeEvent(PathEventType.Add, path));
        pathChangeFilter.peek(() => {
            throw new Error("shouldn't have called this");
        });
        const path2 = pathutils.join("testFile2.txt");
        pathChangeFilter.push(new PathChangeEvent(PathEventType.Add, path2));
    });
});
