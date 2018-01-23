"use strict";
/* eslint-env mocha */

const expect = require("chai").expect;
const tmp = require("tmp");
const fs = require("fs-extra");
const VError = require("verror").VError;
const pathutils = require("path");

const Dir = require("../../lib/utils/dir");
const DirChangeEvent = require("../../lib/utils/dirchangeevent");
const DirEventType = DirChangeEvent.DirEventType;

describe("dir", function () {
    
    this.timeout(20000);
    let tmpDir = null;

    /**
     * delete the test dir.
     * @returns {void}
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
     * @param {integer} depth optional parameter, specifies the depth of the search
     * @returns {list} list of paths inside
     */ 
    const getAllPathsInDir = async (path, depth) => {

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

    before(function () {
        tmpDir = tmp.dirSync({"keep": true});
    });
    beforeEach(async function () {
        await fs.copy(__dirname + "/../../test_directories/test_dir", tmpDir.name);
    });

    afterEach(async function () {
        await deleteTestDir();
    });

    after(async function () {
        await fs.remove(tmpDir.name);
    });

    it("test parameters", async function () {
        expect(() => new Dir(null)).to.throw(VError);
    });

    it("test dir doesn't exist", async function () {
        const dir = new Dir("something");
        const result = await dir.build();
        expect(result).to.be.false;
    });

    it("test dir build", async function() {
        const dir = new Dir(tmpDir.name);

        expect(() => dir.getPathList()).to.throw(VError);
        const result = await dir.build();
        expect(result).to.be.true;

        expect(dir.getPathList()).to.have.same.members(await getAllPathsInDir(tmpDir.name));
    });

    it("test dir build file not there anymore", async function() {
        const dir = new Dir(tmpDir.name);
        dir._debugWaitForTicks(2, async () => {
            await deleteTestDir();
        });
        const result = await dir.build();
        expect(result).to.be.false;
    });

    it("test dir build cancel 1", async function() {
        const dir = new Dir(tmpDir.name);

        //needs to run on wait tick cancelled 1
        dir._debugWaitForTicks(3, async () => {
            dir.cancelBuild();
        });
        const result = await dir.build();
        expect(result).to.be.false;
    });

    it("test dir build cancel 2", async function() {
        const dir = new Dir(tmpDir.name);

        //needs to run on wait tick cancelled 2
        dir._debugWaitForTicks(8, async () => {
            dir.cancelBuild();
        });
        const result = await dir.build();
        expect(result).to.be.false;
    });

    it("test dir serialize", async function() {
        const dir = new Dir(tmpDir.name);
        expect(() => dir.serialize()).to.throw(VError);
        const result = await dir.build();
        expect(result).to.be.true;

        const output = dir.serialize();

        const newDir = new Dir(tmpDir.name);
        expect(newDir.deserialize(output)).to.be.true;

        expect(newDir.compare(dir)).to.be.empty;
    });

    it("test dir deserialize", async function() {
        const dir = new Dir(tmpDir.name);

        expect(dir.deserialize(null)).to.be.false;
        expect(dir.deserialize("")).to.be.false;
        expect(dir.deserialize("asdsad")).to.be.false;
        expect(dir.deserialize("{}")).to.be.false;
        expect(dir.deserialize(JSON.stringify({"version": 1, "content": {}}))).to.be.true;
        expect(dir.deserialize(JSON.stringify({"version": 1, "content": []}))).to.be.false;
        expect(dir.deserialize(JSON.stringify({"version": 1, "content": {"asasd":1}}))).to.be.false;
        expect(dir.deserialize(JSON.stringify({"version": -1, "content": {}}))).to.be.false;
    });

    it("test dir compare", async function() {
        const firstLayer = await getAllPathsInDir(tmpDir.name, 1);

        const dirWithAllFiles = new Dir(tmpDir.name);
        expect(await dirWithAllFiles.build()).to.be.true;

        const changeFilePath = pathutils.join(tmpDir.name, "file1.txt");
        await fs.appendFile(changeFilePath, "something");
        const dirWithOneChange = new Dir(tmpDir.name);
        expect(await dirWithOneChange.build()).to.be.true;

        await deleteTestDir();

        const dirWithNoFiles = new Dir(tmpDir.name);
        expect(await dirWithNoFiles.build()).to.be.true;

        const diffToNoFiles = dirWithNoFiles.compare(dirWithAllFiles);
        expect(diffToNoFiles).to.not.be.null;

        expect(diffToNoFiles.map((e) => e.path)).to.have.same.members(firstLayer);

        //reverse
        const diffToAllFiles = dirWithAllFiles.compare(dirWithNoFiles);

        expect(diffToAllFiles).to.not.be.null;
        expect(diffToAllFiles.map((e) => e.path)).to.have.same.members(firstLayer);

        //change
        const diffOneChange = dirWithAllFiles.compare(dirWithOneChange);
        expect(diffOneChange).to.have.lengthOf(1);
        expect(diffOneChange[0].path).to.equal("file1.txt");
        expect(diffOneChange[0].eventType).to.equal(DirEventType.Change);
    });

    it("test dir compare parameters", async function() {
        const dir1 = new Dir(tmpDir.name);
        const dir2 = new Dir(tmpDir.name);

        expect(() => dir1.compare(dir2)).to.throw(VError);
        expect(await dir1.build()).to.be.true;
        
        expect(() => dir1.compare(dir2)).to.throw(VError);

        expect(() => dir1.compare()).to.throw(VError);
    });

    it("test dir buildFromPrevImage and saveToImage", async function() {
        let dir = new Dir(tmpDir.name);

        expect(await dir.buildFromPrevImage()).to.be.true;
        
        await dir.build();

        expect(await dir.saveToImage()).to.be.true;

        dir = new Dir(tmpDir.name);

        expect(await dir.buildFromPrevImage()).to.be.true;
    });

    it("test dir buildFromPrevImage error1", async function() {
        const folder = pathutils.join(tmpDir.name, "dir");
        const dir = new Dir(folder);

        await fs.writeFile(pathutils.join(folder, ".assetchef"), "something that is not a json");

        expect(await dir.buildFromPrevImage()).to.be.true;
    });

    it("test dir saveToImage error", async function() {
        const folder = pathutils.join(tmpDir.name, "dir");
        const dir = new Dir(folder);

        expect(await dir.build()).to.be.true;
        await fs.remove(folder);

        expect(await dir.saveToImage()).to.be.false;
    });
});