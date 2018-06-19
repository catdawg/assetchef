// tslint:disable:no-unused-expression
import * as chai from "chai";
const expect = chai.expect;
import * as pathutils from "path";
import Semaphore from "semaphore-async-await";
import { VError } from "verror";

import { PathChangeEvent, PathEventType } from "../../../src/utils/path/pathchangeevent";
// tslint:disable-next-line:max-line-length
import { OnProcessingReset, PathChangeProcessor, ProcessCommitMethod} from "../../../src/utils/path/pathchangeprocessor";
import timeout from "../../../src/utils/timeout";

describe("pathchangeprocessor", () => {

    let resetHappened: boolean = false;
    let pathChangeProcessor: PathChangeProcessor = null;
    const retrieveSemaphore: Semaphore = new Semaphore(1);
    beforeEach(async () => {
        pathChangeProcessor = new PathChangeProcessor(() => {
            resetHappened = true;
        });
    });

    async function retrieveEvents(returnNull: boolean = false): Promise<PathChangeEvent[]> {
        const ret: PathChangeEvent[] = [];
        async function handler(
            ev: PathChangeEvent,
        ): Promise<ProcessCommitMethod> {
            await retrieveSemaphore.acquire();
            await retrieveSemaphore.release();

            if (returnNull) {
                return null;
            }
            return () => {
                ret.unshift(ev);
            };
        }
        await pathChangeProcessor.process(handler);
        return ret;
    }

    it("contructor", async () => {
        expect(() => new PathChangeProcessor(null)).to.throw(VError);
    });

    it("test add root", async () => {
        const path = "";
        pathChangeProcessor.push(new PathChangeEvent(PathEventType.Add, path));
        const events = await retrieveEvents();
        expect(events).to.have.same.deep.members([new PathChangeEvent(PathEventType.Add, path)]);
    });

    it("test add file", async () => {
        const path = pathutils.join("testFile.txt");
        pathChangeProcessor.push(new PathChangeEvent(PathEventType.Add, path));
        const events = await retrieveEvents();
        expect(events).to.have.same.deep.members([new PathChangeEvent(PathEventType.Add, path)]);
    });

    it("test add and change file", async () => {
        const path = pathutils.join("testFile.txt");
        pathChangeProcessor.push(new PathChangeEvent(PathEventType.Add, path));
        pathChangeProcessor.push(new PathChangeEvent(PathEventType.Change, path));
        const events = await retrieveEvents();
        expect(events).to.have.same.deep.members([new PathChangeEvent(PathEventType.Add, path)]);
    });

    it("test change file twice", async () => {
        const path = pathutils.join("testFile.txt");
        pathChangeProcessor.push(new PathChangeEvent(PathEventType.Change, path));
        pathChangeProcessor.push(new PathChangeEvent(PathEventType.Change, path));
        const events = await retrieveEvents();
        expect(events).to.have.same.deep.members([new PathChangeEvent(PathEventType.Change, path)]);
    });

    it("test add, change and remove file", async () => {
        const path = pathutils.join("testFile.txt");
        pathChangeProcessor.push(new PathChangeEvent(PathEventType.Add, path));
        pathChangeProcessor.push(new PathChangeEvent(PathEventType.Change, path));
        pathChangeProcessor.push(new PathChangeEvent(PathEventType.Unlink, path));
        const events = await retrieveEvents();
        expect(events).to.have.same.deep.members([]);
    });
    it("test add dir", async () => {
        const path = pathutils.join("testdir");
        pathChangeProcessor.push(new PathChangeEvent(PathEventType.AddDir, path));
        const events = await retrieveEvents();
        expect(events).to.have.same.deep.members([new PathChangeEvent(PathEventType.AddDir, path)]);
    });

    it("test unlink, add dir", async () => {
        const path = pathutils.join("testdir");
        pathChangeProcessor.push(new PathChangeEvent(PathEventType.UnlinkDir, path));
        pathChangeProcessor.push(new PathChangeEvent(PathEventType.AddDir, path));
        const events = await retrieveEvents();
        expect(events).to.have.same.deep.members([
            new PathChangeEvent(PathEventType.AddDir, path),
        ]);
    });

    it("test add dir, and add file and dir inside", async () => {
        const path = pathutils.join("testdir");
        pathChangeProcessor.push(new PathChangeEvent(PathEventType.AddDir, path));
        pathChangeProcessor.push(new PathChangeEvent(PathEventType.Add, pathutils.join(path, "testFile.txt")));
        pathChangeProcessor.push(new PathChangeEvent(PathEventType.AddDir, pathutils.join(path, "testdir2")));
        const events = await retrieveEvents();
        expect(events).to.have.same.deep.members([new PathChangeEvent(PathEventType.AddDir, path)]);
    });

    it("test add two files", async () => {
        const path1 = pathutils.join("testFile1.txt");
        const path2 = pathutils.join("testFile2.txt");
        pathChangeProcessor.push(new PathChangeEvent(PathEventType.Add, path1));
        pathChangeProcessor.push(new PathChangeEvent(PathEventType.Add, path2));
        const events = await retrieveEvents();
        expect(events).to.have.same.deep.members([
            new PathChangeEvent(PathEventType.Add, path1),
            new PathChangeEvent(PathEventType.Add, path2),
        ]);
    });

    it("test add two files, change both", async () => {
        const path1 = pathutils.join("testFile1.txt");
        const path2 = pathutils.join("testFile2.txt");
        pathChangeProcessor.push(new PathChangeEvent(PathEventType.Add, path1));
        pathChangeProcessor.push(new PathChangeEvent(PathEventType.Add, path2));
        pathChangeProcessor.push(new PathChangeEvent(PathEventType.Change, path1));
        pathChangeProcessor.push(new PathChangeEvent(PathEventType.Change, path2));

        const events = await retrieveEvents();
        expect(events).to.have.same.deep.members([
            new PathChangeEvent(PathEventType.Add, path1),
            new PathChangeEvent(PathEventType.Add, path2),
        ]);
    });

    it("test when root is event", async () => {
        const path1 = pathutils.join("testFile1.txt");
        const path2 = pathutils.join("something", "testFile1.txt");
        pathChangeProcessor.push(new PathChangeEvent(PathEventType.AddDir, ""));
        pathChangeProcessor.push(new PathChangeEvent(PathEventType.Add, path1));
        pathChangeProcessor.push(new PathChangeEvent(PathEventType.Add, path2));

        const events = await retrieveEvents();
        expect(events).to.have.same.deep.members([
            new PathChangeEvent(PathEventType.AddDir, ""),
        ]);
    });

    it("peek while empty", async () => {
        const events = await retrieveEvents();
        expect(events).to.be.empty;
    });

    async function GetEventsWhileInterruptingMidProcess(
        interruptCallback: () => Promise<void>,
    ): Promise<PathChangeEvent[]> {
        await retrieveSemaphore.acquire();
        let events: PathChangeEvent[] = null;
        await Promise.all([(async () => {
            events = await retrieveEvents();
        })(), (async () => {
            await interruptCallback();
            retrieveSemaphore.release();
        })()]);

        return events;
    }

    it("interception obsolete from unlink parent", async () => {
        const path1 = pathutils.join("testdir", "testFile1.txt");
        const path2 = pathutils.join("testdir");
        pathChangeProcessor.push(new PathChangeEvent(PathEventType.Change, path1));
        const events = await GetEventsWhileInterruptingMidProcess(async () => {
            pathChangeProcessor.push(new PathChangeEvent(PathEventType.UnlinkDir, path2));
        });
        expect(events).to.deep.equal([
            new PathChangeEvent(PathEventType.UnlinkDir, path2)]);
    });

    it("interception obsolete from add and remove", async () => {
        const path1 = pathutils.join("testdir", "testFile1.txt");
        pathChangeProcessor.push(new PathChangeEvent(PathEventType.Add, path1));
        const events = await GetEventsWhileInterruptingMidProcess(async () => {
            pathChangeProcessor.push(new PathChangeEvent(PathEventType.Unlink, path1));
        });
        expect(events).to.deep.equal([]);
    });

    it("interception different", async () => {
        const path1 = pathutils.join("testdir", "testFile1.txt");
        const path2 = pathutils.join("testdir", "testFile2.txt");
        pathChangeProcessor.push(new PathChangeEvent(PathEventType.Add, path1));
        const events = await GetEventsWhileInterruptingMidProcess(async () => {
            pathChangeProcessor.push(new PathChangeEvent(PathEventType.Add, path2));
        });
        expect(events).to.deep.equal([
            new PathChangeEvent(PathEventType.Add, path2),
            new PathChangeEvent(PathEventType.Add, path1),
        ]);
    });

    it("interception new updates old", async () => {
        const path1 = pathutils.join("testdir", "testFile1.txt");
        pathChangeProcessor.push(new PathChangeEvent(PathEventType.Add, path1));
        const events = await GetEventsWhileInterruptingMidProcess(async () => {
            pathChangeProcessor.push(new PathChangeEvent(PathEventType.Change, path1));
        });
        expect(events).to.deep.equal([
            new PathChangeEvent(PathEventType.Add, path1),
        ]);
    });

    it("interception new updates old 2", async () => {
        const path1 = pathutils.join("testdir");
        const path2 = pathutils.join("testdir", "testFile1.txt");
        pathChangeProcessor.push(new PathChangeEvent(PathEventType.UnlinkDir, path1));
        const events = await GetEventsWhileInterruptingMidProcess(async () => {
            pathChangeProcessor.push(new PathChangeEvent(PathEventType.Unlink, path2));
        });
        expect(events).to.deep.equal([
            new PathChangeEvent(PathEventType.UnlinkDir, path1),
        ]);
    });

    it("interception incosistent", async () => {
        const path1 = pathutils.join("testdir");
        const path2 = pathutils.join("testdir", "testFile1.txt");
        pathChangeProcessor.push(new PathChangeEvent(PathEventType.Add, path2));
        const events = await GetEventsWhileInterruptingMidProcess(async () => {
            pathChangeProcessor.push(new PathChangeEvent(PathEventType.Add, path1));
        });
        expect(resetHappened).to.be.true;
    });

    it("hasChanges", async () => {
        expect(pathChangeProcessor.hasChanges()).to.be.false;
        pathChangeProcessor.push(new PathChangeEvent(PathEventType.Add, "asd"));
        expect(pathChangeProcessor.hasChanges()).to.be.true;
    });

    it("reset cases", async () => {
        const path1 = pathutils.join("testdir", "testFile1.txt");
        const path2 = pathutils.join("testdir");
        resetHappened = false;
        pathChangeProcessor.push(new PathChangeEvent(PathEventType.Add, path2));
        expect(resetHappened).to.be.false;
        pathChangeProcessor.push(new PathChangeEvent(PathEventType.Add, path1));
        expect(resetHappened).to.be.true;

        resetHappened = false;
        pathChangeProcessor.push(new PathChangeEvent(PathEventType.Add, path1));
        expect(resetHappened).to.be.false;
        pathChangeProcessor.push(new PathChangeEvent(PathEventType.Add, path2));
        expect(resetHappened).to.be.true;

        resetHappened = false;
        pathChangeProcessor.push(new PathChangeEvent(PathEventType.AddDir, path2));
        const events = await retrieveEvents(true);
        expect(resetHappened).to.be.true;
    });

    it("error cases", async () => {
        let didThrow = false;
        const events = await GetEventsWhileInterruptingMidProcess(async () => {
            try {
                await pathChangeProcessor.process(async (a) => {
                    return () => {
                        return;
                    };
                });
            } catch (e) {
                didThrow = true;
            }
        });

        expect(didThrow).to.be.true;
    });
});
