"use strict";
/* eslint-env mocha */

const expect = require("chai").expect;
const VError = require("verror").VError;

const DirChangeEvent = require("../../lib/utils/dirchangeevent");
const DirEventComparisonEnum = DirChangeEvent.DirEventComparisonEnum;

describe("dirchangequeue event comparison", function () {

    it("different test", function () {
        const first = new DirChangeEvent("change", "/a/path/to/somefile");
        const second = new DirChangeEvent("change", "/a/path/to/anotherfile");

        expect(DirChangeEvent.compareEvents(first, second)).to.be.equal(DirEventComparisonEnum.Different);
        expect(DirChangeEvent.compareEvents(second, first)).to.be.equal(DirEventComparisonEnum.Different);
    });

    it("equal test", function () {
        const first = new DirChangeEvent("change", "/a/path/to/somefile");
        const second = new DirChangeEvent("change", "/a/path/to/somefile");

        expect(DirChangeEvent.compareEvents(first, second)).to.be.equal(DirEventComparisonEnum.SecondMakesFirstObsolete);
        expect(DirChangeEvent.compareEvents(second, first)).to.be.equal(DirEventComparisonEnum.SecondMakesFirstObsolete);
    });

    it("same file events test", function () {
        const first = new DirChangeEvent("add", "/a/path/to/somefile");
        const second = new DirChangeEvent("unlink", "/a/path/to/somefile");

        expect(DirChangeEvent.compareEvents(first, second)).to.be.equal(DirEventComparisonEnum.BothObsolete);
        expect(DirChangeEvent.compareEvents(second, first)).to.be.equal(DirEventComparisonEnum.SecondMakesFirstObsolete);
    });

    it("same dir events test", function () {
        const first = new DirChangeEvent("addDir", "/a/path/to/somedir");
        const second = new DirChangeEvent("unlinkDir", "/a/path/to/somedir");

        expect(DirChangeEvent.compareEvents(first, second)).to.be.equal(DirEventComparisonEnum.BothObsolete);
        expect(DirChangeEvent.compareEvents(second, first)).to.be.equal(DirEventComparisonEnum.SecondMakesFirstObsolete);
    });

    it("file inside dir with addDir event test", function () {
        const first = new DirChangeEvent("addDir", "/a/path/to/somedir");
        const second = new DirChangeEvent("add", "/a/path/to/somedir/somefile");

        expect(DirChangeEvent.compareEvents(first, second)).to.be.equal(DirEventComparisonEnum.FirstMakesSecondObsolete);
        expect(DirChangeEvent.compareEvents(second, first)).to.be.equal(DirEventComparisonEnum.SecondMakesFirstObsolete);
    });

    it("file inside dir with add event error test", function () {
        const first = new DirChangeEvent("add", "/a/path/to/somedir");
        const second = new DirChangeEvent("add", "/a/path/to/somedir/somefile");

        expect(DirChangeEvent.compareEvents.bind(null, first, second)).to.throw(VError);
        expect(DirChangeEvent.compareEvents.bind(null, second, first)).to.throw(VError);
    }); 
});
