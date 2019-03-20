import { VError } from "verror";

import { IPathChangeEvent, PathEventType } from "../../src/path/ipathchangeevent";
import { winstonlogger } from "../../src/testutils/winstonlogger";

import { PathChangeQueue } from "../../src/path/pathchangequeue";
import { PathUtils } from "../../src/path/pathutils";

describe("pathchangequeue", () => {

    let resetHappened: boolean = false;
    let pathChangeQueue: PathChangeQueue = null;
    beforeEach(async () => {
        pathChangeQueue = new PathChangeQueue(() => {
            resetHappened = true;
        }, winstonlogger);
    });

    it("contructor", async () => {
        expect(() => new PathChangeQueue(null, null)).toThrow(VError);
        expect(() => new PathChangeQueue(() => {
            resetHappened = true;
        }, null)).toThrow(VError);
    });

    it("test add and peek root", async () => {
        const ev: IPathChangeEvent = {eventType: PathEventType.Add, path: ""};
        pathChangeQueue.push(ev);
        const events = [...pathChangeQueue.listAll()];
        expect(events).toIncludeSameMembers([ev]);

        expect(pathChangeQueue.peek()).toEqual(ev);
    });

    it("test add file", async () => {
        const path = PathUtils.join("testFile.txt");
        const ev: IPathChangeEvent = {eventType: PathEventType.Add, path};
        pathChangeQueue.push(ev);
        const events = [...pathChangeQueue.listAll()];
        expect(events).toIncludeSameMembers([ev]);
    });

    it("test add and change file", async () => {
        const path = PathUtils.join("testFile.txt");
        const ev1: IPathChangeEvent = {eventType: PathEventType.Add, path};
        const ev2: IPathChangeEvent = {eventType: PathEventType.Change, path};
        pathChangeQueue.push(ev1);
        pathChangeQueue.push(ev2);
        const events = [...pathChangeQueue.listAll()];
        expect(events).toIncludeSameMembers([ev1]);
    });

    it("test change file twice", async () => {
        const path = PathUtils.join("testFile.txt");
        const ev1: IPathChangeEvent = {eventType: PathEventType.Change, path};
        const ev2: IPathChangeEvent = {eventType: PathEventType.Change, path};
        pathChangeQueue.push(ev1);
        pathChangeQueue.push(ev2);
        const events = [...pathChangeQueue.listAll()];
        expect(events).toIncludeSameMembers([ev2]);
    });

    it("test add, change and remove file", async () => {
        const path = PathUtils.join("testFile.txt");
        const evleft = {eventType: PathEventType.Unlink, path};
        pathChangeQueue.push({eventType: PathEventType.Add, path});
        pathChangeQueue.push({eventType: PathEventType.Change, path});
        pathChangeQueue.push({eventType: PathEventType.Unlink, path});
        const events = [...pathChangeQueue.listAll()];
        expect(events).toIncludeSameMembers([evleft]);
    });
    it("test add dir", async () => {
        const path = PathUtils.join("testdir");
        const ev: IPathChangeEvent = {eventType: PathEventType.AddDir, path};
        pathChangeQueue.push(ev);
        const events = [...pathChangeQueue.listAll()];
        expect(events).toIncludeSameMembers([ev]);
    });

    it("test unlink, add dir", async () => {
        const path = PathUtils.join("testdir");
        const ev1: IPathChangeEvent = {eventType: PathEventType.UnlinkDir, path};
        const ev2: IPathChangeEvent = {eventType: PathEventType.AddDir, path};
        pathChangeQueue.push(ev1);
        pathChangeQueue.push(ev2);
        const events = [...pathChangeQueue.listAll()];
        expect(events).toIncludeSameMembers([
            ev2,
        ]);
    });

    it("test add dir, and add file and dir inside", async () => {
        const path = PathUtils.join("testdir");
        const ev1: IPathChangeEvent = {eventType: PathEventType.AddDir, path};
        const ev2: IPathChangeEvent = {eventType: PathEventType.Add, path: PathUtils.join(path, "testFile.txt")};
        const ev3: IPathChangeEvent = {eventType: PathEventType.AddDir, path: PathUtils.join(path, "testdir2")};
        pathChangeQueue.push(ev1);
        pathChangeQueue.push(ev2);
        pathChangeQueue.push(ev3);
        const events = [...pathChangeQueue.listAll()];
        expect(events).toIncludeSameMembers([ev1]);
    });

    it("test add two files", async () => {
        const path1 = PathUtils.join("testFile1.txt");
        const path2 = PathUtils.join("testFile2.txt");
        const ev1: IPathChangeEvent = {eventType: PathEventType.Add, path: path1};
        const ev2: IPathChangeEvent = {eventType: PathEventType.Add, path: path2};
        pathChangeQueue.push(ev1);
        pathChangeQueue.push(ev2);
        const events = [...pathChangeQueue.listAll()];
        expect(events).toIncludeSameMembers([
            ev1,
            ev2,
        ]);
    });

    it("test add two files, change both", async () => {
        const path1 = PathUtils.join("testFile1.txt");
        const path2 = PathUtils.join("testFile2.txt");
        const ev1: IPathChangeEvent = {eventType: PathEventType.Add, path: path1};
        const ev2: IPathChangeEvent = {eventType: PathEventType.Add, path: path2};
        pathChangeQueue.push(ev1);
        pathChangeQueue.push(ev2);
        pathChangeQueue.push({eventType: PathEventType.Change, path: path1});
        pathChangeQueue.push({eventType: PathEventType.Change, path: path2});

        const events = [...pathChangeQueue.listAll()];
        expect(events).toIncludeSameMembers([
            ev1,
            ev2,
        ]);
    });

    it("test when root is event", async () => {
        const path1 = PathUtils.join("testFile1.txt");
        const path2 = PathUtils.join("something", "testFile1.txt");
        const ev1: IPathChangeEvent = {eventType: PathEventType.AddDir, path: ""};
        pathChangeQueue.push(ev1);
        pathChangeQueue.push({eventType: PathEventType.Add, path: path1});
        pathChangeQueue.push({eventType: PathEventType.Add, path: path2});

        const events = [...pathChangeQueue.listAll()];
        expect(events).toIncludeSameMembers([
            ev1,
        ]);
    });

    it("test deeper push sequence", async () => {
        const dir1 = "dir";
        const dir2 = "dir2";
        const path1 = PathUtils.join(dir1, "file");
        const path2 = PathUtils.join(dir1, dir2, "file");
        const ev1: IPathChangeEvent = {eventType: PathEventType.Add, path: path1};
        const ev2: IPathChangeEvent = {eventType: PathEventType.Add, path: path2};
        pathChangeQueue.push(ev1);
        pathChangeQueue.push(ev2);

        const events = [...pathChangeQueue.listAll()];
        expect(events).toIncludeSameMembers([
            ev1,
            ev2,
        ]);
    });

    it("peek while empty", async () => {
        expect(pathChangeQueue.peek()).toBeNull();
    });

    it("interception obsolete from unlink parent", async () => {
        const path1 = PathUtils.join("testdir", "testFile1.txt");
        const path2 = PathUtils.join("testdir");
        const ev1: IPathChangeEvent = {eventType: PathEventType.Change, path: path1};
        const ev2: IPathChangeEvent = {eventType: PathEventType.UnlinkDir, path: path2};
        pathChangeQueue.push(ev1);
        const handler = pathChangeQueue.stage(pathChangeQueue.peek());
        pathChangeQueue.push(ev2);
        expect(handler.isStagedEventObsolete()).toBeTrue();
        expect(handler.didStagedEventChange()).toBeFalse();
        handler.finishProcessingStagedEvent();
        const events = [...pathChangeQueue.listAll()];
        expect(events).toIncludeSameMembers([ev2]);
    });

    it("interception obsolete from add and remove", async () => {
        const path1 = PathUtils.join("testdir", "testFile1.txt");
        const ev1: IPathChangeEvent = {eventType: PathEventType.Add, path: path1};
        const ev2: IPathChangeEvent = {eventType: PathEventType.Unlink, path: path1};
        pathChangeQueue.push(ev1);
        const handler = pathChangeQueue.stage(pathChangeQueue.peek());
        pathChangeQueue.push(ev2);
        expect(handler.isStagedEventObsolete()).toBe(true);
        expect(handler.didStagedEventChange()).toBeFalse();
        handler.finishProcessingStagedEvent();
        const events = [...pathChangeQueue.listAll()];
        expect(events).toIncludeSameMembers([ev2]);
    });

    it("interception different", async () => {
        const path1 = PathUtils.join("testdir", "testFile1.txt");
        const path2 = PathUtils.join("testdir", "testFile2.txt");
        const ev1: IPathChangeEvent = {eventType: PathEventType.Add, path: path1};
        const ev2: IPathChangeEvent = {eventType: PathEventType.Add, path: path2};
        pathChangeQueue.push(ev1);
        const handler = pathChangeQueue.stage(pathChangeQueue.peek());
        pathChangeQueue.push(ev2);
        expect(handler.isStagedEventObsolete()).toBeFalse();
        expect(handler.didStagedEventChange()).toBeFalse();
        handler.finishProcessingStagedEvent();

        const events = [...pathChangeQueue.listAll()];
        expect(events).toIncludeSameMembers([ev2]);
    });
    it("interception new updates old", async () => {
        const path1 = PathUtils.join("testdir", "testFile1.txt");
        pathChangeQueue.push({eventType: PathEventType.Add, path: path1});
        const handler = pathChangeQueue.stage(pathChangeQueue.peek());
        pathChangeQueue.push({eventType: PathEventType.Change, path: path1});
        expect(handler.isStagedEventObsolete()).toBeFalse();
        expect(handler.didStagedEventChange()).toBe(true);
        expect(handler.didStagedEventChange()).toBeFalse();
        handler.finishProcessingStagedEvent();

        const events = [...pathChangeQueue.listAll()];
        expect(events).toEqual([]);
    });

    it("interception new updates old 2", async () => {
        const path1 = PathUtils.join("testdir");
        const path2 = PathUtils.join("testdir", "testFile1.txt");
        pathChangeQueue.push({eventType: PathEventType.UnlinkDir, path: path1});
        const handler = pathChangeQueue.stage(pathChangeQueue.peek());
        pathChangeQueue.push({eventType: PathEventType.Unlink, path: path2});
        expect(handler.isStagedEventObsolete()).toBeFalse();
        expect(handler.didStagedEventChange()).toBeFalse();
        handler.finishProcessingStagedEvent();

        const events = [...pathChangeQueue.listAll()];
        expect(events).toEqual([]);
    });

    it("interception incosistent", async () => {
        const path1 = PathUtils.join("testdir");
        const path2 = PathUtils.join("testdir", "testFile1.txt");
        pathChangeQueue.push({eventType: PathEventType.Add, path: path2});
        const handler = pathChangeQueue.stage(pathChangeQueue.peek());
        pathChangeQueue.push({eventType: PathEventType.Add, path: path1});
        expect(handler.isStagedEventObsolete()).toBe(true);
        expect(resetHappened).toBe(true);
    });

    it("hasChanges", async () => {
        expect(pathChangeQueue.hasChanges()).toBeFalse();
        pathChangeQueue.push({eventType: PathEventType.Add, path: "asd"});
        expect(pathChangeQueue.hasChanges()).toBe(true);
    });

    it("reset cases", async () => {
        const path1 = PathUtils.join("testdir", "testFile1.txt");
        const path2 = PathUtils.join("testdir");
        resetHappened = false;
        pathChangeQueue.push({eventType: PathEventType.Add, path: path2});
        expect(resetHappened).toBeFalse();
        pathChangeQueue.push({eventType: PathEventType.Add, path: path1});
        expect(resetHappened).toBe(true);

        resetHappened = false;
        pathChangeQueue.push({eventType: PathEventType.Add, path: path1});
        expect(resetHappened).toBeFalse();
        pathChangeQueue.push({eventType: PathEventType.Add, path: path2});
        expect(resetHappened).toBe(true);
    });

    it("error cases 2", async () => {
        const path1 = PathUtils.join("testFile1.txt");
        const path2 = PathUtils.join("testFile2.txt");

        const ev1: IPathChangeEvent = {eventType: PathEventType.Add, path: path1};
        const ev2: IPathChangeEvent = {eventType: PathEventType.Add, path: path2};
        pathChangeQueue.push(ev1);
        pathChangeQueue.push(ev2);
        pathChangeQueue.stage(ev1);

        expect(() => pathChangeQueue.stage(ev2)).toThrow(VError);
        expect(() => pathChangeQueue.peek()).toThrow(VError);
    });

    it("error cases 3", async () => {
        expect(() => pathChangeQueue.stage(null)).toThrow(VError);
    });

    it("error cases 4", async () => {
        expect(() => pathChangeQueue.stage({eventType: PathEventType.Add, path: "something"})).toThrow(VError);
    });

    it("error cases 5", async () => {
        const path1 = PathUtils.join("testFile1.txt");
        const path2 = PathUtils.join("testFile2.txt");
        pathChangeQueue.push({eventType: PathEventType.Add, path: path1});
        pathChangeQueue.push({eventType: PathEventType.Add, path: path2});
        pathChangeQueue.stage(pathChangeQueue.peek());

        expect(() => pathChangeQueue.hasChanges()).toThrow(VError);
    });

    it("error cases 5", async () => {
        const path1 = PathUtils.join("testFile1.txt");
        pathChangeQueue.push({eventType: PathEventType.Add, path: path1});
        pathChangeQueue.stage(pathChangeQueue.peek());

        expect(() => [...pathChangeQueue.listAll()]).toThrow(VError);
    });

    it("error cases 6", async () => {
        const path1 = PathUtils.join("testFile1.txt");
        pathChangeQueue.push({eventType: PathEventType.Add, path: path1});
        expect(() => pathChangeQueue.stage({eventType: PathEventType.AddDir, path: path1})).toThrow(VError);
    });
});
