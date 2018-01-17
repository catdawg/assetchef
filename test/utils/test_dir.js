"use strict";
/* eslint-env mocha */

const expect = require("chai").expect;
const tmp = require("tmp");
const fs = require("fs-extra");
const VError = require("verror").VError;
const pathutils = require("path");

const Dir = require("../../lib/utils/dir");

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
     * @returns {list} list of paths inside
     */ 
    const getAllPathsInDir = async (path) => {

        const list = [];
        const directoriesToProcess = [""];


        while (directoriesToProcess.length > 0) {
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

        expect(dir.deserialize(output)).to.be.true;
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
    });
});