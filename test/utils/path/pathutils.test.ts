// tslint:disable:no-unused-expression
import * as chai from "chai";
const expect = chai.expect;

import * as pathutils from "path";
import { VError } from "verror";

import { cleanTokenizePath, getPathRelationship, PathRelationship } from "../../../src/utils/path/pathutils";

describe("pathextra", () => {
    it("test relationship", () => {
        const pathempty = pathutils.join("");
        const pathsomething = pathutils.join("something");
        const pathanother = pathutils.join("another");
        const pathsomethingelse = pathutils.join("something", "else");
        const pathsomethingelsedeeper = pathutils.join("something", "else", "deeper");

        expect(getPathRelationship(pathempty, pathempty)).to.be.equal(PathRelationship.Equal);
        expect(getPathRelationship(pathsomething, pathanother)).to.be.equal(PathRelationship.Different);

        expect(getPathRelationship(pathempty, pathsomething)).to.be.equal(PathRelationship.Path2DirectlyInsidePath1);
        expect(getPathRelationship(pathsomething, pathempty)).to.be.equal(PathRelationship.Path1DirectlyInsidePath2);

        expect(getPathRelationship(pathempty, pathsomethingelse)).to.be.equal(PathRelationship.Path2InsidePath1);
        expect(getPathRelationship(pathsomethingelse, pathempty)).to.be.equal(PathRelationship.Path1InsidePath2);

        expect(getPathRelationship(pathsomething, pathsomethingelsedeeper)).
            to.be.equal(PathRelationship.Path2InsidePath1);
        expect(getPathRelationship(pathsomethingelsedeeper, pathsomething)).
            to.be.equal(PathRelationship.Path1InsidePath2);

    });

    it("test errors", () => {

        expect(() => getPathRelationship(null, null)).to.be.throw(VError);
        expect(() => getPathRelationship(null, "something")).to.be.throw(VError);
        expect(() => getPathRelationship("something", null)).to.be.throw(VError);
        expect(() => cleanTokenizePath(null)).to.be.throw(VError);
    });
});
