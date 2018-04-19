// tslint:disable:no-unused-expression
import * as chai from "chai";
const expect = chai.expect;

import { VError } from "verror";

import {PathChangeEvent, PathEventComparisonEnum, PathEventType} from "../../../src/utils/path/pathchangeevent";

describe("dirchangequeue event comparison", () => {

    it("different test", () => {
        const first = new PathChangeEvent(PathEventType.Change, "/a/path/to/somefile");
        const second = new PathChangeEvent(PathEventType.Change, "/a/path/to/anotherfile");

        expect(PathChangeEvent.compareEvents(first, second)).to.be.equal(PathEventComparisonEnum.Different);
        expect(PathChangeEvent.compareEvents(second, first)).to.be.equal(PathEventComparisonEnum.Different);
    });

    it("equal test", () => {
        const first = new PathChangeEvent(PathEventType.Change, "/a/path/to/somefile");
        const second = new PathChangeEvent(PathEventType.Change, "/a/path/to/somefile");

        expect(PathChangeEvent.compareEvents(first, second)).to.be.equal(
            PathEventComparisonEnum.SecondMakesFirstObsolete);
        expect(PathChangeEvent.compareEvents(second, first)).to.be.equal(
            PathEventComparisonEnum.SecondMakesFirstObsolete);
    });

    it("same file events test", () => {
        const first = new PathChangeEvent(PathEventType.Add, "/a/path/to/somefile");
        const second = new PathChangeEvent(PathEventType.Unlink, "/a/path/to/somefile");

        expect(PathChangeEvent.compareEvents(first, second)).to.be.equal(
            PathEventComparisonEnum.BothObsolete);
        expect(PathChangeEvent.compareEvents(second, first)).to.be.equal(
            PathEventComparisonEnum.SecondMakesFirstObsolete);
    });

    it("same dir events test", () => {
        const first = new PathChangeEvent(PathEventType.AddDir, "/a/path/to/somedir");
        const second = new PathChangeEvent(PathEventType.UnlinkDir, "/a/path/to/somedir");

        expect(PathChangeEvent.compareEvents(first, second)).to.be.equal(PathEventComparisonEnum.BothObsolete);
        expect(PathChangeEvent.compareEvents(second, first)).to.be.equal(
            PathEventComparisonEnum.SecondMakesFirstObsolete);
    });

    it("file inside dir with addDir event test", () => {
        const first = new PathChangeEvent(PathEventType.AddDir, "/a/path/to/somedir");
        const second = new PathChangeEvent(PathEventType.Add, "/a/path/to/somedir/somefile");

        expect(PathChangeEvent.compareEvents(first, second)).to.be.equal(
            PathEventComparisonEnum.FirstMakesSecondObsolete);
        expect(PathChangeEvent.compareEvents(second, first)).to.be.equal(
            PathEventComparisonEnum.SecondMakesFirstObsolete);
    });

    it("file inside dir with add event error test", () => {
        const first = new PathChangeEvent(PathEventType.Add, "/a/path/to/somedir");
        const second = new PathChangeEvent(PathEventType.Add, "/a/path/to/somedir/somefile");

        expect(PathChangeEvent.compareEvents.bind(null, first, second)).to.throw(VError);
        expect(PathChangeEvent.compareEvents.bind(null, second, first)).to.throw(VError);
    });
});
