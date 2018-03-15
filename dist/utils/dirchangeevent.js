"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const verror_1 = require("verror");
/**
 * The possible results for comparing events
 * @readonly
 * @enum {string}
 * @typedef {string} DirEventComparisonEnum
 */
var DirEventComparisonEnum;
(function (DirEventComparisonEnum) {
    DirEventComparisonEnum["Different"] = "Different";
    DirEventComparisonEnum["FirstMakesSecondObsolete"] = "FirstMakesSecondObsolete";
    DirEventComparisonEnum["SecondMakesFirstObsolete"] = "SecondMakesFirstObsolete";
    DirEventComparisonEnum["BothObsolete"] = "BothObsolete";
})(DirEventComparisonEnum = exports.DirEventComparisonEnum || (exports.DirEventComparisonEnum = {}));
/**
 * The possible directory and file changes
 * @readonly
 * @enum {string}
 * @typedef {string} DirEventType
 */
var DirEventType;
(function (DirEventType) {
    DirEventType["Add"] = "add";
    DirEventType["AddDir"] = "addDir";
    DirEventType["Unlink"] = "unlink";
    DirEventType["UnlinkDir"] = "unlinkDir";
    DirEventType["Change"] = "change";
})(DirEventType = exports.DirEventType || (exports.DirEventType = {}));
/**
 * A directory change event. This a simple class that aggregates a path and an event,
 * and provides a comparison between events * to determine if they are equal, different,
 * or if one makes the other redundant
 */
class DirChangeEvent {
    /**
     * This method is very important and pretty much is where the "magic" happens.
     * The first event is compared against the second to determine if they are equal,
     * different, one makes the other obsolete, or if they are both obsolete.
     * @param {DirChangeEvent} first the first event
     * @param {DirChangeEvent} second the second event
     * @returns {DirEventComparisonEnum} the comparison
     */
    static compareEvents(first, second) {
        if (first.eventType === second.eventType && first.path === second.path) {
            return DirEventComparisonEnum.SecondMakesFirstObsolete;
        }
        if (first.path === second.path) {
            if (second.eventType === DirEventType.Change && first.eventType === DirEventType.Add) {
                return DirEventComparisonEnum.FirstMakesSecondObsolete;
            }
            if (second.eventType === DirEventType.UnlinkDir && first.eventType === DirEventType.AddDir) {
                return DirEventComparisonEnum.BothObsolete;
            }
            if (second.eventType === DirEventType.Unlink && first.eventType === DirEventType.Add) {
                return DirEventComparisonEnum.BothObsolete;
            }
            return DirEventComparisonEnum.SecondMakesFirstObsolete;
        }
        if (first.path.startsWith(second.path)) {
            if (second.eventType !== DirEventType.AddDir && second.eventType !== DirEventType.UnlinkDir) {
                throw new verror_1.VError("inconsistent dir change event, event %s triggered for path %s which should be a directory.", second.eventType, second.path);
            }
            return DirEventComparisonEnum.SecondMakesFirstObsolete;
        }
        if (second.path.startsWith(first.path)) {
            if (first.eventType !== DirEventType.AddDir && first.eventType !== DirEventType.UnlinkDir) {
                throw new verror_1.VError("inconsistent dir change event, event %s triggered for path %s which should be a directory.", first.eventType, first.path);
            }
            return DirEventComparisonEnum.FirstMakesSecondObsolete;
        }
        return DirEventComparisonEnum.Different;
    }
    /**
     * Constructor of the Event class
     * @param {DirEventType} eventType The type of event.
     * @param {string} path The path for the event
     */
    constructor(eventType, path) {
        this.eventType = eventType;
        this.path = path;
    }
}
exports.DirChangeEvent = DirChangeEvent;
//# sourceMappingURL=dirchangeevent.js.map