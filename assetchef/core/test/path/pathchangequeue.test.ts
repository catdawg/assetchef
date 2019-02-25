// tslint:disable:no-unused-expression
import * as chai from "chai";
const expect = chai.expect;
import * as pathutils from "path";
import { VError } from "verror";

import { IPathChangeEvent, PathEventType } from "../../src/path/ipathchangeevent";
import { winstonlogger } from "../../src/testutils/winstonlogger";

import { PathChangeQueue } from "../../src/path/pathchangequeue";

describe("pathchangequeue", () => {

    let resetHappened: boolean = false;
    let pathChangeQueue: PathChangeQueue = null;
    beforeEach(async () => {
        pathChangeQueue = new PathChangeQueue(() => {
            resetHappened = true;
        }, winstonlogger);
    });

    it("contructor", async () => {
        expect(() => new PathChangeQueue(null, null)).to.throw(VError);
        expect(() => new PathChangeQueue(() => {
            resetHappened = true;
        }, null)).to.throw(VError);
    });

    it("test add and peek root", async () => {
        const ev: IPathChangeEvent = {eventType: PathEventType.Add, path: ""};
        pathChangeQueue.push(ev);
        const events = [...pathChangeQueue.listAll()];
        expect(events).to.have.same.deep.members([ev]);

        expect(pathChangeQueue.peek()).to.deep.equal(ev);
    });

    it("test add file", async () => {
        const path = pathutils.join("testFile.txt");
        const ev: IPathChangeEvent = {eventType: PathEventType.Add, path};
        pathChangeQueue.push(ev);
        const events = [...pathChangeQueue.listAll()];
        expect(events).to.have.same.deep.members([ev]);
    });

    it("test add and change file", async () => {
        const path = pathutils.join("testFile.txt");
        const ev1: IPathChangeEvent = {eventType: PathEventType.Add, path};
        const ev2: IPathChangeEvent = {eventType: PathEventType.Change, path};
        pathChangeQueue.push(ev1);
        pathChangeQueue.push(ev2);
        const events = [...pathChangeQueue.listAll()];
        expect(events).to.have.same.deep.members([ev1]);
    });

    it("test change file twice", async () => {
        const path = pathutils.join("testFile.txt");
        const ev1: IPathChangeEvent = {eventType: PathEventType.Change, path};
        const ev2: IPathChangeEvent = {eventType: PathEventType.Change, path};
        pathChangeQueue.push(ev1);
        pathChangeQueue.push(ev2);
        const events = [...pathChangeQueue.listAll()];
        expect(events).to.have.same.deep.members([ev2]);
    });

    it("test add, change and remove file", async () => {
        const path = pathutils.join("testFile.txt");
        const evleft = {eventType: PathEventType.Unlink, path};
        pathChangeQueue.push({eventType: PathEventType.Add, path});
        pathChangeQueue.push({eventType: PathEventType.Change, path});
        pathChangeQueue.push({eventType: PathEventType.Unlink, path});
        const events = [...pathChangeQueue.listAll()];
        expect(events).to.have.same.deep.members([evleft]);
    });
    it("test add dir", async () => {
        const path = pathutils.join("testdir");
        const ev: IPathChangeEvent = {eventType: PathEventType.AddDir, path};
        pathChangeQueue.push(ev);
        const events = [...pathChangeQueue.listAll()];
        expect(events).to.have.same.deep.members([ev]);
    });

    it("test unlink, add dir", async () => {
        const path = pathutils.join("testdir");
        const ev1: IPathChangeEvent = {eventType: PathEventType.UnlinkDir, path};
        const ev2: IPathChangeEvent = {eventType: PathEventType.AddDir, path};
        pathChangeQueue.push(ev1);
        pathChangeQueue.push(ev2);
        const events = [...pathChangeQueue.listAll()];
        expect(events).to.have.same.deep.members([
            ev2,
        ]);
    });

    it("test add dir, and add file and dir inside", async () => {
        const path = pathutils.join("testdir");
        const ev1: IPathChangeEvent = {eventType: PathEventType.AddDir, path};
        const ev2: IPathChangeEvent = {eventType: PathEventType.Add, path: pathutils.join(path, "testFile.txt")};
        const ev3: IPathChangeEvent = {eventType: PathEventType.AddDir, path: pathutils.join(path, "testdir2")};
        pathChangeQueue.push(ev1);
        pathChangeQueue.push(ev2);
        pathChangeQueue.push(ev3);
        const events = [...pathChangeQueue.listAll()];
        expect(events).to.have.same.deep.members([ev1]);
    });

    it("test add two files", async () => {
        const path1 = pathutils.join("testFile1.txt");
        const path2 = pathutils.join("testFile2.txt");
        const ev1: IPathChangeEvent = {eventType: PathEventType.Add, path: path1};
        const ev2: IPathChangeEvent = {eventType: PathEventType.Add, path: path2};
        pathChangeQueue.push(ev1);
        pathChangeQueue.push(ev2);
        const events = [...pathChangeQueue.listAll()];
        expect(events).to.have.same.deep.members([
            ev1,
            ev2,
        ]);
    });

    it("test add two files, change both", async () => {
        const path1 = pathutils.join("testFile1.txt");
        const path2 = pathutils.join("testFile2.txt");
        const ev1: IPathChangeEvent = {eventType: PathEventType.Add, path: path1};
        const ev2: IPathChangeEvent = {eventType: PathEventType.Add, path: path2};
        pathChangeQueue.push(ev1);
        pathChangeQueue.push(ev2);
        pathChangeQueue.push({eventType: PathEventType.Change, path: path1});
        pathChangeQueue.push({eventType: PathEventType.Change, path: path2});

        const events = [...pathChangeQueue.listAll()];
        expect(events).to.have.same.deep.members([
            ev1,
            ev2,
        ]);
    });

    it("test when root is event", async () => {
        const path1 = pathutils.join("testFile1.txt");
        const path2 = pathutils.join("something", "testFile1.txt");
        const ev1: IPathChangeEvent = {eventType: PathEventType.AddDir, path: ""};
        pathChangeQueue.push(ev1);
        pathChangeQueue.push({eventType: PathEventType.Add, path: path1});
        pathChangeQueue.push({eventType: PathEventType.Add, path: path2});

        const events = [...pathChangeQueue.listAll()];
        expect(events).to.have.same.deep.members([
            ev1,
        ]);
    });

    it("test deeper push sequence", async () => {
        const dir1 = "dir";
        const dir2 = "dir2";
        const path1 = pathutils.join(dir1, "file");
        const path2 = pathutils.join(dir1, dir2, "file");
        const ev1: IPathChangeEvent = {eventType: PathEventType.Add, path: path1};
        const ev2: IPathChangeEvent = {eventType: PathEventType.Add, path: path2};
        pathChangeQueue.push(ev1);
        pathChangeQueue.push(ev2);

        const events = [...pathChangeQueue.listAll()];
        expect(events).to.have.same.deep.members([
            ev1,
            ev2,
        ]);
    });

    it("peek while empty", async () => {
        expect(pathChangeQueue.peek()).to.be.null;
    });

    it("interception obsolete from unlink parent", async () => {
        const path1 = pathutils.join("testdir", "testFile1.txt");
        const path2 = pathutils.join("testdir");
        const ev1: IPathChangeEvent = {eventType: PathEventType.Change, path: path1};
        const ev2: IPathChangeEvent = {eventType: PathEventType.UnlinkDir, path: path2};
        pathChangeQueue.push(ev1);
        const handler = pathChangeQueue.stage(pathChangeQueue.peek());
        pathChangeQueue.push(ev2);
        expect(handler.isStagedEventObsolete()).to.be.true;
        expect(handler.didStagedEventChange()).to.be.false;
        handler.finishProcessingStagedEvent();
        const events = [...pathChangeQueue.listAll()];
        expect(events).to.have.same.deep.members([ev2]);
    });

    it("interception obsolete from add and remove", async () => {
        const path1 = pathutils.join("testdir", "testFile1.txt");
        const ev1: IPathChangeEvent = {eventType: PathEventType.Add, path: path1};
        const ev2: IPathChangeEvent = {eventType: PathEventType.Unlink, path: path1};
        pathChangeQueue.push(ev1);
        const handler = pathChangeQueue.stage(pathChangeQueue.peek());
        pathChangeQueue.push(ev2);
        expect(handler.isStagedEventObsolete()).to.be.true;
        expect(handler.didStagedEventChange()).to.be.false;
        handler.finishProcessingStagedEvent();
        const events = [...pathChangeQueue.listAll()];
        expect(events).to.have.same.deep.members([ev2]);
    });

    it("interception different", async () => {
        const path1 = pathutils.join("testdir", "testFile1.txt");
        const path2 = pathutils.join("testdir", "testFile2.txt");
        const ev1: IPathChangeEvent = {eventType: PathEventType.Add, path: path1};
        const ev2: IPathChangeEvent = {eventType: PathEventType.Add, path: path2};
        pathChangeQueue.push(ev1);
        const handler = pathChangeQueue.stage(pathChangeQueue.peek());
        pathChangeQueue.push(ev2);
        expect(handler.isStagedEventObsolete()).to.be.false;
        expect(handler.didStagedEventChange()).to.be.false;
        handler.finishProcessingStagedEvent();

        const events = [...pathChangeQueue.listAll()];
        expect(events).to.have.same.deep.members([ev2]);
    });
    it("interception new updates old", async () => {
        const path1 = pathutils.join("testdir", "testFile1.txt");
        pathChangeQueue.push({eventType: PathEventType.Add, path: path1});
        const handler = pathChangeQueue.stage(pathChangeQueue.peek());
        pathChangeQueue.push({eventType: PathEventType.Change, path: path1});
        expect(handler.isStagedEventObsolete()).to.be.false;
        expect(handler.didStagedEventChange()).to.be.true;
        expect(handler.didStagedEventChange()).to.be.false;
        handler.finishProcessingStagedEvent();

        const events = [...pathChangeQueue.listAll()];
        expect(events).to.deep.equal([]);
    });

    it("interception new updates old 2", async () => {
        const path1 = pathutils.join("testdir");
        const path2 = pathutils.join("testdir", "testFile1.txt");
        pathChangeQueue.push({eventType: PathEventType.UnlinkDir, path: path1});
        const handler = pathChangeQueue.stage(pathChangeQueue.peek());
        pathChangeQueue.push({eventType: PathEventType.Unlink, path: path2});
        expect(handler.isStagedEventObsolete()).to.be.false;
        expect(handler.didStagedEventChange()).to.be.false;
        handler.finishProcessingStagedEvent();

        const events = [...pathChangeQueue.listAll()];
        expect(events).to.deep.equal([]);
    });

    it("interception incosistent", async () => {
        const path1 = pathutils.join("testdir");
        const path2 = pathutils.join("testdir", "testFile1.txt");
        pathChangeQueue.push({eventType: PathEventType.Add, path: path2});
        const handler = pathChangeQueue.stage(pathChangeQueue.peek());
        pathChangeQueue.push({eventType: PathEventType.Add, path: path1});
        expect(handler.isStagedEventObsolete()).to.be.true;
        expect(resetHappened).to.be.true;
    });

    it("hasChanges", async () => {
        expect(pathChangeQueue.hasChanges()).to.be.false;
        pathChangeQueue.push({eventType: PathEventType.Add, path: "asd"});
        expect(pathChangeQueue.hasChanges()).to.be.true;
    });

    it("reset cases", async () => {
        const path1 = pathutils.join("testdir", "testFile1.txt");
        const path2 = pathutils.join("testdir");
        resetHappened = false;
        pathChangeQueue.push({eventType: PathEventType.Add, path: path2});
        expect(resetHappened).to.be.false;
        pathChangeQueue.push({eventType: PathEventType.Add, path: path1});
        expect(resetHappened).to.be.true;

        resetHappened = false;
        pathChangeQueue.push({eventType: PathEventType.Add, path: path1});
        expect(resetHappened).to.be.false;
        pathChangeQueue.push({eventType: PathEventType.Add, path: path2});
        expect(resetHappened).to.be.true;
    });

    it("error cases 2", async () => {
        const path1 = pathutils.join("testFile1.txt");
        const path2 = pathutils.join("testFile2.txt");

        const ev1: IPathChangeEvent = {eventType: PathEventType.Add, path: path1};
        const ev2: IPathChangeEvent = {eventType: PathEventType.Add, path: path2};
        pathChangeQueue.push(ev1);
        pathChangeQueue.push(ev2);
        pathChangeQueue.stage(ev1);

        expect(() => pathChangeQueue.stage(ev2)).to.throw(VError);
        expect(() => pathChangeQueue.peek()).to.throw(VError);
    });

    it("error cases 3", async () => {
        expect(() => pathChangeQueue.stage(null)).to.throw(VError);
    });

    it("error cases 4", async () => {
        expect(() => pathChangeQueue.stage({eventType: PathEventType.Add, path: "something"})).to.throw(VError);
    });

    it("error cases 5", async () => {
        const path1 = pathutils.join("testFile1.txt");
        const path2 = pathutils.join("testFile2.txt");
        pathChangeQueue.push({eventType: PathEventType.Add, path: path1});
        pathChangeQueue.push({eventType: PathEventType.Add, path: path2});
        pathChangeQueue.stage(pathChangeQueue.peek());

        expect(() => pathChangeQueue.hasChanges()).to.throw(VError);
    });

    it("error cases 5", async () => {
        const path1 = pathutils.join("testFile1.txt");
        pathChangeQueue.push({eventType: PathEventType.Add, path: path1});
        pathChangeQueue.stage(pathChangeQueue.peek());

        expect(() => [...pathChangeQueue.listAll()]).to.throw(VError);
    });

    it("error cases 6", async () => {
        const path1 = pathutils.join("testFile1.txt");
        pathChangeQueue.push({eventType: PathEventType.Add, path: path1});
        expect(() => pathChangeQueue.stage({eventType: PathEventType.AddDir, path: path1})).to.throw(VError);
    });
});
