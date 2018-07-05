// tslint:disable:no-unused-expression
import * as chai from "chai";
const expect = chai.expect;

import * as pathutils from "path";
import * as sinon from "sinon";
import { VError } from "verror";

import { IPathTreeReadonly } from "../../src/path/ipathtreereadonly";
import { PathChangeEvent, PathEventType } from "../../src/path/pathchangeevent";
import { ProcessCommitMethod } from "../../src/path/pathchangeprocessor";
import { PathTree } from "../../src/path/pathtree";
import { PipelineNode } from "../../src/pipeline/pipelinenode";
import { logInfo } from "../../src/utils/logger";

class PrintingNode extends PipelineNode<string> {
    private actualTree: PathTree<string>;

    public async update(): Promise<void> {
        await this._prevTreeEventProcessor.process(async (
            event: PathChangeEvent): Promise<ProcessCommitMethod> => {
                switch (event.eventType) {
                    case (PathEventType.Add):
                        const newContent = this._prevTree.get(event.path);
                        return () => {
                            logInfo("file %s added.", event.path);
                            this.actualTree.set(event.path, newContent);
                        };
                    case (PathEventType.Change): {
                        const changedContent = this._prevTree.get(event.path);
                        return () => {
                            logInfo("file %s changed.", event.path);
                            this.actualTree.set(event.path, changedContent);
                        };
                    }
                    case (PathEventType.Unlink): {
                        return () => {
                            logInfo("file %s removed.", event.path);
                            this.actualTree.remove(event.path);
                        };
                    }
                    case (PathEventType.UnlinkDir): {
                        return () => {
                            logInfo("dir %s removed.", event.path);
                            this.actualTree.remove(event.path);
                        };
                    }
                    case (PathEventType.AddDir): {
                        logInfo("dir %s added.", event.path);
                        const newEvents: PathChangeEvent[] = [];
                        for (const entry of this._prevTree.list(event.path)) {
                            const fullEntryPath = pathutils.join(event.path, entry);
                            if (this._prevTree.isDir(fullEntryPath)) {
                                newEvents.push(new PathChangeEvent(PathEventType.AddDir, fullEntryPath));
                            } else {
                                newEvents.push(new PathChangeEvent(PathEventType.Add, fullEntryPath));
                            }
                        }
                        return () => {
                            for (const ev of newEvents) {
                                this._prevTreeEventProcessor.push(ev);
                            }
                        };
                    }
                }
            });
    }

    public reset(): void {
        this._prevTreeEventProcessor.push(new PathChangeEvent(PathEventType.AddDir, ""));
    }

    protected async setupTree(): Promise<IPathTreeReadonly<string>> {
        this.actualTree = new PathTree<string>();

        return this.actualTree.getReadonlyInterface();
    }
}

class BrokenNode extends PipelineNode<string> {
    public async update(): Promise<void> {
        return;
    }

    public reset(): void {
        return;
    }

    protected async setupTree(): Promise<IPathTreeReadonly<string>> {
        return null;
    }
}

describe("pipelinenode", () => {

    let logSpy = null;
    let logSpyErr = null;
    beforeEach(() => {
        logSpy = sinon.spy(process.stdout, "write");
        logSpyErr = sinon.spy(process.stderr, "write");
    });

    afterEach(() => {
        logSpy.restore();
        logSpyErr.restore();
    });

    let initialPathTree: PathTree<string>;
    let node: PrintingNode;
    beforeEach(async () => {
        initialPathTree = new PathTree<string>();
        node = new PrintingNode();
        await node.setup(initialPathTree.getReadonlyInterface());

    });

    it("test simple", async () => {
        const rootFilePath = "new_file";
        const dirPath = "new_dir";
        const nestedFilePath = pathutils.join(dirPath, "new_file_inside_dir");

        initialPathTree.set(rootFilePath, "file");

        await node.update();

        expect(logSpy.lastCall.args[0]).to.contain("file");
        expect(logSpy.lastCall.args[0]).to.contain("added");

        initialPathTree.set(nestedFilePath, "file2");

        await node.update();

        expect(logSpy.lastCall.args[0]).to.contain("dir");
        expect(logSpy.lastCall.args[0]).to.contain("added");

        initialPathTree.remove(nestedFilePath);

        await node.update();

        expect(logSpy.lastCall.args[0]).to.contain("file");
        expect(logSpy.lastCall.args[0]).to.contain("removed");

        initialPathTree.remove(dirPath);

        await node.update();

        expect(logSpy.lastCall.args[0]).to.contain("dir");
        expect(logSpy.lastCall.args[0]).to.contain("removed");

        initialPathTree.set(rootFilePath, "file change");

        await node.update();

        expect(logSpy.lastCall.args[0]).to.contain("file");
        expect(logSpy.lastCall.args[0]).to.contain("changed");
    });

    it("test broken", async () => {

        const brokenNode = new BrokenNode();

        let except = null;
        try {
            await brokenNode.setup(node.tree);
        } catch (e) {
            except = e;
        }

        expect(except).to.be.instanceof(VError);
    });
});
