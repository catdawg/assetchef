// tslint:disable:no-unused-expression
import * as chai from "chai";
const expect = chai.expect;

import * as pathutils from "path";
import * as sinon from "sinon";
import { VError } from "verror";

import { IPathTreeReadonly } from "path/ipathtreereadonly";
import { PathChangeEvent, PathEventType } from "path/pathchangeevent";
import { PathChangeProcessor, ProcessCommitMethod } from "path/pathchangeprocessor";
import { PathTree } from "path/pathtree";
import { PipelineNode } from "pipeline/pipelinenode";
import { logInfo } from "utils/logger";

class PrintingNode extends PipelineNode<string> {
    private actualTree: PathTree<string>;
    private eventProcessor: PathChangeProcessor;

    public async update(): Promise<void> {
        const res = await this.eventProcessor.processAll({
            handleFileAdded: async (path): Promise<ProcessCommitMethod> => {
                const newContent = this._prevTreeInterface.get(path);
                return () => {
                    logInfo("file %s added.", path);
                    this.actualTree.set(path, newContent);
                };
            },
            handleFileChanged: async (path): Promise<ProcessCommitMethod> => {
                const changedContent = this._prevTreeInterface.get(path);
                return () => {
                    logInfo("file %s changed.", path);
                    this.actualTree.set(path, changedContent);
                };
            },
            handleFileRemoved: async (path: string): Promise<ProcessCommitMethod> => {
                return () => {
                    logInfo("file %s removed.", path);
                    this.actualTree.remove(path);
                };
            },
            handleFolderAdded: async (path): Promise<ProcessCommitMethod> => {
                logInfo("dir %s added.", path);
                return () => {
                    this.actualTree.mkdir(path);
                };
            },
            handleFolderRemoved: async (path): Promise<ProcessCommitMethod> => {
                return () => {
                    logInfo("dir %s removed.", path);
                    this.actualTree.remove(path);
                };
            },
            isDir: async (path): Promise<boolean> => {
                return this._prevTreeInterface.isDir(path);
            },
            list: async (path): Promise<string[]> => {
                return [...this._prevTreeInterface.list(path)];
            },
        });
    }

    public reset(): void {
        this._prevTreeInterfaceChangeQueue.push(new PathChangeEvent(PathEventType.AddDir, ""));
    }

    protected async setupInterface(): Promise<IPathTreeReadonly<string>> {
        this.actualTree = new PathTree<string>();

        this.eventProcessor = new PathChangeProcessor(this._prevTreeInterfaceChangeQueue);

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

    protected async setupInterface(): Promise<IPathTreeReadonly<string>> {
        return null;
    }
}

describe("pipelinenode", () => {

    let logSpy: sinon.SinonSpy  = null;
    let logSpyErr: sinon.SinonSpy = null;
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
            await brokenNode.setup(node.treeInterface);
        } catch (e) {
            except = e;
        }

        expect(except).to.be.instanceof(VError);
    });
});
