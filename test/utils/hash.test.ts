// tslint:disable:no-unused-expression
import * as chai from "chai";
const expect = chai.expect;

import * as fs from "fs-extra";
import * as pathutils from "path";
import * as tmp from "tmp";
import { VError } from "verror";

import { hashFSStat } from "utils/hash";
import { timeout } from "utils/timeout";

describe("hash", () => {

    let tmpDir: tmp.SynchrounousResult = null;
    beforeAll(() => {
        tmpDir = tmp.dirSync();
    });

    afterEach(async () => {
        const files = await fs.readdir(tmpDir.name);

        for (const file of files) {
            fs.remove(pathutils.join(tmpDir.name, file));
        }
    });

    afterAll((done) => {
        fs.remove(tmpDir.name, done);
    });

    it("test parameters", () => {

        expect(() => hashFSStat(null)).to.throw(VError);

        // @ts-ignore
        expect(() => hashFSStat({})).to.throw(VError);
        // @ts-ignore
        expect(() => hashFSStat({mtime: Date.now()})).to.throw(VError);
        // @ts-ignore
        expect(() => hashFSStat({mtime: Date.now(), ctime: Date.now()})).to.throw(VError);
    });

    it("hash simple diff test", async () => {
        const path = pathutils.join(tmpDir.name, "file1.txt");
        await fs.createFile(path);

        await timeout(500);
        const emptyHash = hashFSStat(await fs.stat(path));

        await fs.writeFile(path, "something");

        await timeout(500);
        const hashAfterOneChange = hashFSStat(await fs.stat(path));

        expect(hashAfterOneChange).to.be.not.equal(emptyHash);

        await fs.writeFile(path, "something else");

        await timeout(500);
        const hashAfterTwoChanges = hashFSStat(await fs.stat(path));

        expect(hashAfterTwoChanges).to.be.not.equal(hashAfterOneChange);

        await fs.writeFile(path, "something");

        await timeout(500);
        const hashChangeWithSameContent = hashFSStat(await fs.stat(path));

        expect(hashChangeWithSameContent).to.be.not.equal(hashAfterOneChange);
    });

});
