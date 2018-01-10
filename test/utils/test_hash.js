"use strict";
/* eslint-env mocha */

const expect = require("chai").expect;
const tmp = require("tmp");
const fs = require("fs-extra");
const VError = require("verror").VError;
const pathutils = require("path");

const hash = require("../../lib/utils/hash");

describe("dirwatcher", function () {

    this.timeout(20000);

    let tmpDir = null;
    before(function () {
        tmpDir = tmp.dirSync({"keep": true});
    });

    afterEach(async function () {
        const files = await fs.readdir(tmpDir.name);

        for (const file of files) {
            fs.remove(pathutils.join(tmpDir.name, file));
        }
    });

    after(function (done) {
        fs.remove(tmpDir.name, done);
    });

    /**
     * Writes the content of the file
     * @param {string} file - The directory to watch
     * @param {string} content - the content to write on the file
     * @returns {void}
     */
    async function writeToFile(file, content) {

        await fs.writeFile(file, content);
    }

    it("test parameters", function () {

        expect(() => hash.hashFSStat(null)).to.throw(VError);

        expect(() => hash.hashFSStat({})).to.throw(VError);
        expect(() => hash.hashFSStat({mtime: Date.now()})).to.throw(VError);
        expect(() => hash.hashFSStat({mtime: Date.now(), ctime: Date.now()})).to.throw(VError);
    });

    it("hash simple diff test", async function () {
        const path = pathutils.join(tmpDir.name, "file1.txt");
        await fs.createFile(path);
        const emptyHash = hash.hashFSStat(await fs.stat(path));

        await writeToFile(path, "something");
        const hashAfterOneChange = hash.hashFSStat(await fs.stat(path));

        expect(hashAfterOneChange).to.be.not.equal(emptyHash);

        await writeToFile(path, "something else");
        const hashAfterTwoChanges = hash.hashFSStat(await fs.stat(path));

        expect(hashAfterTwoChanges).to.be.not.equal(hashAfterOneChange);

        await writeToFile(path, "something else");
        const hashChangeWithSameContent = hash.hashFSStat(await fs.stat(path));

        expect(hashChangeWithSameContent).to.be.not.equal(hashAfterTwoChanges);
    });

});