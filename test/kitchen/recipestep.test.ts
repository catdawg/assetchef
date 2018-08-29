// tslint:disable:no-unused-expression
import * as chai from "chai";
const expect = chai.expect;

import * as pathutils from "path";
import * as sinon from "sinon";
import { VError } from "verror";

import { RecipeStep } from "../../src/kitchen/recipestep";
import { ILogger } from "../../src/plugin/ilogger";
import { PathEventType } from "../../src/plugin/ipathchangeevent";
import { IPathTreeReadonly } from "../../src/plugin/ipathtreereadonly";
import { IRecipePlugin } from "../../src/plugin/irecipeplugin";
import { ISchemaDefinition } from "../../src/plugin/ischemadefinition";
import { processAll, ProcessCommitMethod } from "../../src/utils/path/pathchangeprocessor";
import { PathChangeQueue } from "../../src/utils/path/pathchangequeue";
import { PathTree } from "../../src/utils/path/pathtree";
import winstonlogger from "../../src/utils/winstonlogger";

describe("recipestep", () => {
    let initialPathTree: PathTree<Buffer>;
    let node: RecipeStep;

    let logSpy: sinon.SinonSpy  = null;
    let logSpyErr: sinon.SinonSpy = null;

    beforeEach(async () => {
        logSpy = sinon.spy(process.stdout, "write");
        logSpyErr = sinon.spy(process.stderr, "write");

        initialPathTree = new PathTree<Buffer>();
        node = new RecipeStep();
        await node.setup(winstonlogger, initialPathTree.getReadonlyInterface(), "assetchef-logchanges", {});
    });

    afterEach(() => {
        logSpy.restore();
        logSpyErr.restore();
    });

    it("test simple", async () => {
        const rootFilePath = "new_file";
        const dirPath = "new_dir";
        const nestedFilePath = pathutils.join(dirPath, "new_file_inside_dir");

        initialPathTree.set(rootFilePath, Buffer.from("file"));

        await node.update();

        expect(logSpy.lastCall.args[0]).to.contain("file");
        expect(logSpy.lastCall.args[0]).to.contain("added");

        initialPathTree.set(nestedFilePath, Buffer.from("file2"));

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

        initialPathTree.set(rootFilePath, Buffer.from("file change"));

        await node.update();

        expect(logSpy.lastCall.args[0]).to.contain("file");
        expect(logSpy.lastCall.args[0]).to.contain("changed");
    });

    it("test reset", async () => {
        const rootFilePath = "new_file";

        initialPathTree.set(rootFilePath, Buffer.from("file"));

        await node.update();

        expect(logSpy.lastCall.args[0]).to.contain("file");
        expect(logSpy.lastCall.args[0]).to.contain("added");

        await node.reset();

        await node.update();

        expect(logSpy.lastCall.args[0]).to.contain("file");
        expect(logSpy.lastCall.args[0]).to.contain("added");
    });

    it("test destroy", async () => {
        const rootFilePath = "new_file";

        initialPathTree.set(rootFilePath, Buffer.from("file"));

        await node.update();

        expect(logSpy.lastCall.args[0]).to.contain("file");
        expect(logSpy.lastCall.args[0]).to.contain("added");

        await node.destroy();

        expect(logSpy.lastCall.args[0]).to.contain("destroyed");
    });
});
