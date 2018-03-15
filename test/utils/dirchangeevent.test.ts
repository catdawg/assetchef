// tslint:disable:no-unused-expression
import * as chai from "chai";
const expect = chai.expect;

import { VError } from "verror";

import {DirChangeEvent, DirEventComparisonEnum, DirEventType} from "../../src/utils/dirchangeevent";

describe("dirchangequeue event comparison", () => {

    it("different test", () => {
        const first = new DirChangeEvent(DirEventType.Change, "/a/path/to/somefile");
        const second = new DirChangeEvent(DirEventType.Change, "/a/path/to/anotherfile");

        expect(DirChangeEvent.compareEvents(first, second)).to.be.equal(DirEventComparisonEnum.Different);
        expect(DirChangeEvent.compareEvents(second, first)).to.be.equal(DirEventComparisonEnum.Different);
    });

    it("equal test", () => {
        const first = new DirChangeEvent(DirEventType.Change, "/a/path/to/somefile");
        const second = new DirChangeEvent(DirEventType.Change, "/a/path/to/somefile");

        expect(DirChangeEvent.compareEvents(first, second)).to.be.equal(
            DirEventComparisonEnum.SecondMakesFirstObsolete);
        expect(DirChangeEvent.compareEvents(second, first)).to.be.equal(
            DirEventComparisonEnum.SecondMakesFirstObsolete);
    });

    it("same file events test", () => {
        const first = new DirChangeEvent(DirEventType.Add, "/a/path/to/somefile");
        const second = new DirChangeEvent(DirEventType.Unlink, "/a/path/to/somefile");

        expect(DirChangeEvent.compareEvents(first, second)).to.be.equal(
            DirEventComparisonEnum.BothObsolete);
        expect(DirChangeEvent.compareEvents(second, first)).to.be.equal(
            DirEventComparisonEnum.SecondMakesFirstObsolete);
    });

    it("same dir events test", () => {
        const first = new DirChangeEvent(DirEventType.AddDir, "/a/path/to/somedir");
        const second = new DirChangeEvent(DirEventType.UnlinkDir, "/a/path/to/somedir");

        expect(DirChangeEvent.compareEvents(first, second)).to.be.equal(DirEventComparisonEnum.BothObsolete);
        expect(DirChangeEvent.compareEvents(second, first)).to.be.equal(
            DirEventComparisonEnum.SecondMakesFirstObsolete);
    });

    it("file inside dir with addDir event test", () => {
        const first = new DirChangeEvent(DirEventType.AddDir, "/a/path/to/somedir");
        const second = new DirChangeEvent(DirEventType.Add, "/a/path/to/somedir/somefile");

        expect(DirChangeEvent.compareEvents(first, second)).to.be.equal(
            DirEventComparisonEnum.FirstMakesSecondObsolete);
        expect(DirChangeEvent.compareEvents(second, first)).to.be.equal(
            DirEventComparisonEnum.SecondMakesFirstObsolete);
    });

    it("file inside dir with add event error test", () => {
        const first = new DirChangeEvent(DirEventType.Add, "/a/path/to/somedir");
        const second = new DirChangeEvent(DirEventType.Add, "/a/path/to/somedir/somefile");

        expect(DirChangeEvent.compareEvents.bind(null, first, second)).to.throw(VError);
        expect(DirChangeEvent.compareEvents.bind(null, second, first)).to.throw(VError);
    });
});
