// tslint:disable:no-unused-expression
import * as chai from "chai";
const expect = chai.expect;

import * as pathutils from "path";
import { VError } from "verror";

import { PathRelationship, PathUtils } from "../../../src/utils/path/pathutils";

describe("pathextra", () => {
    it("test relationship", () => {
        const pathempty = pathutils.join("");
        const pathsomething = pathutils.join("something");
        const pathanother = pathutils.join("another");
        const pathsomethingelse = pathutils.join("something", "else");
        const pathsomethingelsedeeper = pathutils.join("something", "else", "deeper");

        expect(PathUtils.getPathRelationship(pathempty, pathempty)).to.be.equal(PathRelationship.Equal);
        expect(PathUtils.getPathRelationship(pathsomething, pathanother)).to.be.equal(PathRelationship.Different);

        expect(PathUtils.getPathRelationship(pathempty, pathsomething)).to.be.equal(
            PathRelationship.Path2DirectlyInsidePath1);
        expect(PathUtils.getPathRelationship(pathsomething, pathempty)).to.be.equal(
            PathRelationship.Path1DirectlyInsidePath2);

        expect(PathUtils.getPathRelationship(pathempty, pathsomethingelse)).to.be.equal(
            PathRelationship.Path2InsidePath1);
        expect(PathUtils.getPathRelationship(pathsomethingelse, pathempty)).to.be.equal(
            PathRelationship.Path1InsidePath2);

        expect(PathUtils.getPathRelationship(pathsomething, pathsomethingelsedeeper)).
            to.be.equal(PathRelationship.Path2InsidePath1);
        expect(PathUtils.getPathRelationship(pathsomethingelsedeeper, pathsomething)).
            to.be.equal(PathRelationship.Path1InsidePath2);

    });

    it("test errors", () => {

        expect(() => PathUtils.getPathRelationship(null, null)).to.be.throw(VError);
        expect(() => PathUtils.getPathRelationship(null, "something")).to.be.throw(VError);
        expect(() => PathUtils.getPathRelationship("something", null)).to.be.throw(VError);
        expect(() => PathUtils.cleanTokenizePath(null)).to.be.throw(VError);
    });
});
