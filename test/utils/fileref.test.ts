// tslint:disable:no-unused-expression
import * as chai from "chai";
const expect = chai.expect;
import { VError } from "verror";

import FileRef from "../../src/utils/fileref";

describe("fileref", () => {

    it("test parameters", async () => {
        expect(() => new FileRef(null)).to.throw(VError);

        const ref = new FileRef(() => Buffer.from("something", "utf8"));
        expect(() => ref.changeReference(null)).to.throw(VError);
    });

    it("test simple usage", async () => {
        const ref = new FileRef(() => Buffer.from("something", "utf8"));

        expect((await ref.dereference()).toString()).to.be.equal(Buffer.from("something", "utf8").toString());
    });

    it("test double deref", async () => {
        const ref = new FileRef(() => Buffer.from("something", "utf8"));

        expect((await ref.dereference()).toString()).to.be.equal(Buffer.from("something", "utf8").toString());
        expect((await ref.dereference()).toString()).to.be.equal(Buffer.from("something", "utf8").toString());
    });

    it("test change ref", async () => {
        const ref = new FileRef(() => Buffer.from("something", "utf8"));

        ref.changeReference(() => Buffer.from("something else", "utf8"));

        expect((await ref.dereference()).toString()).to.be.equal(Buffer.from("something else", "utf8").toString());
    });
});
