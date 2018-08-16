// tslint:disable:no-unused-expression
import * as chai from "chai";
const expect = chai.expect;

import * as pathutils from "path";
import { VError } from "verror";

import { PathTree } from "path/pathtree";
import { IPipelineProduct } from "pipeline/ipipelineproduct";
import { PipelineNodeOneFileMode } from "pipeline/pipelinenodeonefile";

class SplitNode extends PipelineNodeOneFileMode<string> {
    protected shouldCook(path: string, content: string): boolean {
        return path.endsWith(".txt");
    }
    protected async cookFile(path: string, content: string): Promise<Array<IPipelineProduct<string>>> {
        const split = content.split(" ");

        const result: Array<IPipelineProduct<string>> = [];

        let i = 1;
        for (const s of split) {
            const ext = pathutils.extname(path);
            const withoutExt = path.substr(0, path.length - ext.length);
            result.push({
                content: s,
                path: withoutExt + i++ + ext,
            });
        }

        return result;
    }
}

class ToUpperNode extends PipelineNodeOneFileMode<string> {
    protected shouldCook(path: string, content: string): boolean {
        return path.endsWith(".txt");
    }

    protected async cookFile(path: string, content: string): Promise<Array<IPipelineProduct<string>>> {
        const result: Array<IPipelineProduct<string>> = [];

        result.push({
            content: content.toUpperCase(),
            path,
        });

        return result;
    }
}

class BrokenNode extends PipelineNodeOneFileMode<string> {
    protected shouldCook(path: string, content: string): boolean {
        return true;
    }

    protected async cookFile(path: string, content: string): Promise<Array<IPipelineProduct<string>>> {
        const result: Array<IPipelineProduct<string>> = [];
        result.push({
            content,
            path: "a_file.txt",
        });
        return result;
    }
}

describe("pipelinenodeonefile", () => {

    let initialPathTree: PathTree<string>;
    let firstNode: ToUpperNode;
    let secondNode: SplitNode;
    let rootFilePath: string;
    let ignoredFile1: string;
    let ignoredFile2: string;
    let nestedFilePath: string;
    let nestedTwiceFilePath: string;
    let ignoredFileContent: string;
    beforeEach(async () => {
        initialPathTree = new PathTree<string>();
        firstNode = new ToUpperNode();
        await firstNode.setup(initialPathTree.getReadonlyInterface());

        secondNode = new SplitNode();
        await secondNode.setup(firstNode.treeInterface);

        rootFilePath = "new_file.txt";
        ignoredFile1 = "new_file.png";
        ignoredFile2 = pathutils.join("new_dir", "new_file_nested.png");
        ignoredFileContent = "an image";
        nestedFilePath = pathutils.join("new_dir", "new_file_inside_dir.txt");
        nestedTwiceFilePath = pathutils.join("new_dir", "new_dir2", "new_file_inside_dir2.txt");

        initialPathTree.set(rootFilePath, "a split file");
        initialPathTree.set(ignoredFile1, ignoredFileContent);
        initialPathTree.set(nestedFilePath, "another split file");
        initialPathTree.set(ignoredFile2, ignoredFileContent);
        initialPathTree.set(nestedTwiceFilePath, "yet another split file");

        await firstNode.update();
        await secondNode.update();
    });

    it("test simple", async () => {
        const rootFiles = [...secondNode.treeInterface.list("")];
        expect(rootFiles).to.have.same.members(
            ["new_dir", "new_file1.txt", "new_file2.txt", "new_file3.txt", "new_file.png"],
            "must have same entries in directory");

        expect(secondNode.treeInterface.get("new_file1.txt")).to.be.equal("A");
        expect(secondNode.treeInterface.get("new_file2.txt")).to.be.equal("SPLIT");
        expect(secondNode.treeInterface.get("new_file3.txt")).to.be.equal("FILE");
        expect(secondNode.treeInterface.get("new_file.png")).to.be.equal(ignoredFileContent);

        const filesInDir = [...secondNode.treeInterface.list("new_dir")];

        expect(filesInDir).to.have.same.members(
            [
                "new_file_inside_dir1.txt",
                "new_file_inside_dir2.txt",
                "new_file_inside_dir3.txt",
                "new_file_nested.png",
                "new_dir2"],
            "must have same entries in directory");

        expect(
            secondNode.treeInterface.get(pathutils.join("new_dir", "new_file_inside_dir1.txt"))).to.be.equal("ANOTHER");
        expect(
            secondNode.treeInterface.get(pathutils.join("new_dir", "new_file_inside_dir2.txt"))).to.be.equal("SPLIT");
        expect(secondNode.treeInterface.get(pathutils.join("new_dir", "new_file_inside_dir3.txt"))).to.be.equal("FILE");
        expect(secondNode.treeInterface.get(pathutils.join("new_dir", "new_file_nested.png"))).to.be.equal(
            ignoredFileContent);
    });

    it("test removal", async () => {
        initialPathTree.remove(nestedFilePath);

        await firstNode.update();
        await secondNode.update();

        const rootFiles = [...secondNode.treeInterface.list("")];
        expect(rootFiles).to.have.same.members(
            ["new_dir", "new_file1.txt", "new_file2.txt", "new_file3.txt",
            "new_file.png"], "must have same entries in directory");

        expect(secondNode.treeInterface.get("new_file1.txt")).to.be.equal("A");
        expect(secondNode.treeInterface.get("new_file2.txt")).to.be.equal("SPLIT");
        expect(secondNode.treeInterface.get("new_file3.txt")).to.be.equal("FILE");
        expect(secondNode.treeInterface.get("new_file.png")).to.be.equal(ignoredFileContent);

        const filesInDir = [...secondNode.treeInterface.list("new_dir")];

        expect(filesInDir).to.have.same.members(
            ["new_file_nested.png", "new_dir2"], "must have same entries in directory");
    });

    it("test change", async () => {
        initialPathTree.set(rootFilePath, "changed");

        await firstNode.update();
        await secondNode.update();

        const rootFiles = [...secondNode.treeInterface.list("")];
        expect(rootFiles).to.have.same.members(
            ["new_dir", "new_file1.txt", "new_file.png"], "must have same entries in directory");

        expect(secondNode.treeInterface.get("new_file1.txt")).to.be.equal("CHANGED");
    });

    it("test remove root", async () => {
        initialPathTree.remove("");

        await firstNode.update();
        await secondNode.update();

        const rootFiles = [...secondNode.treeInterface.listAll()];
        expect(rootFiles).to.have.same.members([], "must have same entries in directory");
    });

    it("test error return same file twice", async () => {
        firstNode.reset();
        secondNode.reset();

        const thirdNode = new BrokenNode();
        await thirdNode.setup(secondNode.treeInterface);

        await firstNode.update();
        await secondNode.update();

        let except = null;
        try {
            await thirdNode.update();
        } catch (e) {
            except = e;
        }

        expect(except).to.be.instanceof(VError);
    });
});
