// tslint:disable:no-unused-expression
import * as chai from "chai";
const expect = chai.expect;

import * as fs from "fs-extra";
import * as pathutils from "path";
import * as tmp from "tmp";
import { VError } from "verror";

import Dir from "../../src/utils/dir";
import {DirChangeEvent, DirEventType} from "../../src/utils/dirchangeevent";

describe("dir", () => {

    let tmpDir = null;

    /**
     * delete the test dir.
     * @returns {Promise<void>} the promise of successfully deleting the directory
     */
    const deleteTestDir = async () => {

        const files = await fs.readdir(tmpDir.name);

        for (const file of files) {
            await fs.remove(pathutils.join(tmpDir.name, file));
        }
    };

    /**
     * recursive looks into the path to find paths
     * @param {string} path absolute filesystem path
     * @param {number} [depth] depth optional parameter, specifies the depth of the search
     * @returns {Promise<Array>} list of paths inside
     */
    const getAllPathsInDir = async (path, depth = null) => {

        const list = [];
        const directoriesToProcess = [""];

        while (directoriesToProcess.length > 0) {
            if (depth != null) {
                if (depth <= 0) {
                    break;
                }
                --depth;
            }
            const dir = directoriesToProcess.pop();

            const fullPath = pathutils.join(path, dir);

            const dirList = await fs.readdir(fullPath);

            for (const dirListPath of dirList) {
                const relativePath = pathutils.join(dir, dirListPath);
                list.push(relativePath);
                const stat = await fs.stat(pathutils.join(fullPath, dirListPath));
                if (stat.isDirectory()) {
                    directoriesToProcess.push(relativePath);
                }
            }
        }

        return list;
    };

    beforeAll(() => {
        tmpDir = tmp.dirSync({keep: true});
    });

    beforeEach(async () => {
        await fs.copy(__dirname + "/../../test_directories/test_dir", tmpDir.name);
    });

    afterEach(async () => {
        await deleteTestDir();
    });

    afterAll(async () => {
        await fs.remove(tmpDir.name);
    });

    it("test parameters", async () => {
        expect(() => new Dir(null)).to.throw(VError);
    });

    it("test dir doesn't exist", async () => {
        const dir = new Dir("something");
        const result = await dir.build();
        expect(result).to.be.false;
    });

    it("test dir build", async () => {
        const dir = new Dir(tmpDir.name);

        expect(() => dir.getPathList()).to.throw(VError);
        const result = await dir.build();
        expect(result).to.be.true;

        expect(dir.getPathList()).to.have.same.members(await getAllPathsInDir(tmpDir.name));
    });

    it("test dir build file not there anymore", async () => {
        const dir = new Dir(tmpDir.name);
        dir._debugWaitForTicks(2, async () => {
            return await deleteTestDir();
        });
        const result = await dir.build();
        expect(result).to.be.false;
    });

    it("test dir build cancel 1", async () => {
        const dir = new Dir(tmpDir.name);

        // needs to run on wait tick cancelled 1
        dir._debugWaitForTicks(3, async () => {
            dir.cancelBuild();
        });
        const result = await dir.build();
        expect(result).to.be.false;
    });

    it("test dir build cancel 2", async () => {
        const dir = new Dir(tmpDir.name);

        // needs to run on wait tick cancelled 2
        dir._debugWaitForTicks(8, async () => {
            dir.cancelBuild();
        });
        const result = await dir.build();
        expect(result).to.be.false;
    });

    it("test dir serialize", async () => {
        const dir = new Dir(tmpDir.name);
        expect(() => dir.serialize()).to.throw(VError);
        const result = await dir.build();
        expect(result).to.be.true;

        const output = dir.serialize();

        const newDir = new Dir(tmpDir.name);
        expect(newDir.deserialize(output)).to.be.true;

        expect(newDir.compare(dir)).to.be.empty;
    });

    it("test dir deserialize", async () => {
        const dir = new Dir(tmpDir.name);

        expect(dir.deserialize(null)).to.be.false;
        expect(dir.deserialize("")).to.be.false;
        expect(dir.deserialize("asdsad")).to.be.false;
        expect(dir.deserialize("{}")).to.be.false;
        expect(dir.deserialize(JSON.stringify({version: 1, content: {}}))).to.be.true;
        expect(dir.deserialize(JSON.stringify({version: 1, content: []}))).to.be.false;
        expect(dir.deserialize(JSON.stringify({version: 1, content: {asasd: 1}}))).to.be.false;
        expect(dir.deserialize(JSON.stringify({version: -1, content: {}}))).to.be.false;
    });

    it("test dir compare", async () => {
        const firstLayer = await getAllPathsInDir(tmpDir.name, 1);

        const dirWithAllFiles = new Dir(tmpDir.name);
        expect(await dirWithAllFiles.build()).to.be.true;

        const changeFilePath = pathutils.join(tmpDir.name, "file1.txt");
        await fs.appendFile(changeFilePath, "something");
        const dirWithOneChange = new Dir(tmpDir.name);
        expect(await dirWithOneChange.build()).to.be.true;

        await fs.remove(changeFilePath);
        const dirWithOneFileLess = new Dir(tmpDir.name);
        expect(await dirWithOneFileLess.build()).to.be.true;

        await deleteTestDir();

        const dirWithNoFiles = new Dir(tmpDir.name);
        expect(await dirWithNoFiles.build()).to.be.true;

        const diffToNoFiles = dirWithNoFiles.compare(dirWithAllFiles);
        expect(diffToNoFiles).to.not.be.null;

        expect(diffToNoFiles.map((e) => e.path)).to.have.same.members(firstLayer);

        // reverse
        const diffToAllFiles = dirWithAllFiles.compare(dirWithNoFiles);

        expect(diffToAllFiles).to.not.be.null;
        expect(diffToAllFiles.map((e) => e.path)).to.have.same.members(firstLayer);

        // change
        const diffOneChange = dirWithAllFiles.compare(dirWithOneChange);
        expect(diffOneChange).to.have.lengthOf(1);
        expect(diffOneChange[0].path).to.equal("file1.txt");
        expect(diffOneChange[0].eventType).to.equal(DirEventType.Change);

        // removal
        const diffOneRemoval = dirWithOneFileLess.compare(dirWithAllFiles);
        expect(diffOneRemoval).to.have.lengthOf(1);
        expect(diffOneRemoval[0].path).to.equal("file1.txt");
        expect(diffOneRemoval[0].eventType).to.equal(DirEventType.Unlink);
    });

    it("test file now dir", async () => {
        const firstLayer = await getAllPathsInDir(tmpDir.name, 1);

        const dirWithAllFiles = new Dir(tmpDir.name);
        expect(await dirWithAllFiles.build()).to.be.true;

        const filePath = pathutils.join(tmpDir.name, "file1.txt");
        await fs.remove(filePath);
        await fs.mkdir(filePath);

        const dirWithChange = new Dir(tmpDir.name);
        expect(await dirWithChange.build()).to.be.true;

        const diff = dirWithChange.compare(dirWithAllFiles);
        expect(diff).to.not.be.null;

        expect(diff).to.have.lengthOf(2);
        expect(diff[0].path).to.equal("file1.txt");
        expect(diff[0].eventType).to.equal(DirEventType.Unlink);
        expect(diff[1].path).to.equal("file1.txt");
        expect(diff[1].eventType).to.equal(DirEventType.AddDir);
    });

    it("test dir now file", async () => {
        const firstLayer = await getAllPathsInDir(tmpDir.name, 1);

        const dirWithAllFiles = new Dir(tmpDir.name);

        expect(await dirWithAllFiles.build()).to.be.true;

        const filePath = pathutils.join(tmpDir.name, "dir");
        await fs.remove(filePath);
        await fs.writeFile(filePath, "something");

        const dirWithChange = new Dir(tmpDir.name);
        expect(await dirWithChange.build()).to.be.true;

        const diff = dirWithChange.compare(dirWithAllFiles);
        expect(diff).to.not.be.null;

        expect(diff).to.have.lengthOf(2);

        expect(diff[0].path).to.equal(pathutils.join("dir"));
        expect(diff[0].eventType).to.equal(DirEventType.UnlinkDir);
        expect(diff[1].path).to.equal(pathutils.join("dir"));
        expect(diff[1].eventType).to.equal(DirEventType.Add);
    });

    it("test dir compare parameters", async () => {
        const dir1 = new Dir(tmpDir.name);
        const dir2 = new Dir(tmpDir.name);

        expect(() => dir1.compare(dir2)).to.throw(VError);
        expect(await dir1.build()).to.be.true;

        expect(() => dir1.compare(dir2)).to.throw(VError);

        expect(() => dir1.compare(null)).to.throw(VError);
    });

    it("test dir buildFromPrevImage and saveToImage", async () => {
        let dir = new Dir(tmpDir.name);

        await dir.buildFromPrevImage();

        await dir.build();

        expect(await dir.saveToImage()).to.be.true;

        dir = new Dir(tmpDir.name);

        await dir.buildFromPrevImage();
    });

    it("test dir buildFromPrevImage error1", async () => {
        const folder = pathutils.join(tmpDir.name, "dir");
        const dir = new Dir(folder);

        await fs.writeFile(pathutils.join(folder, ".assetchef"), "something that is not a json");

        await dir.buildFromPrevImage();
    });

    it("test dir saveToImage error", async () => {
        const folder = pathutils.join(tmpDir.name, "dir");
        const dir = new Dir(folder);

        expect(await dir.build()).to.be.true;
        await fs.remove(folder);

        expect(await dir.saveToImage()).to.be.false;
    });
});
