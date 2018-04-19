"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const verror_1 = require("verror");
/**
 * The possible results for comparing events
 * @readonly
 * @enum {string}
 * @typedef {string} PathEventComparisonEnum
 */
var PathEventComparisonEnum;
(function (PathEventComparisonEnum) {
    PathEventComparisonEnum["Different"] = "Different";
    PathEventComparisonEnum["FirstMakesSecondObsolete"] = "FirstMakesSecondObsolete";
    PathEventComparisonEnum["SecondMakesFirstObsolete"] = "SecondMakesFirstObsolete";
    PathEventComparisonEnum["BothObsolete"] = "BothObsolete";
})(PathEventComparisonEnum = exports.PathEventComparisonEnum || (exports.PathEventComparisonEnum = {}));
/**
 * The possible directory and file changes
 * @readonly
 * @enum {string}
 * @typedef {string} PathEventType
 */
var PathEventType;
(function (PathEventType) {
    PathEventType["Add"] = "add";
    PathEventType["AddDir"] = "addDir";
    PathEventType["Unlink"] = "unlink";
    PathEventType["UnlinkDir"] = "unlinkDir";
    PathEventType["Change"] = "change";
})(PathEventType = exports.PathEventType || (exports.PathEventType = {}));
/**
 * A directory change event. This a simple class that aggregates a path and an event,
 * and provides a comparison between events * to determine if they are equal, different,
 * or if one makes the other redundant
 */
class PathChangeEvent {
    /**
     * This method is very important and pretty much is where the "magic" happens.
     * The first event is compared against the second to determine if they are equal,
     * different, one makes the other obsolete, or if they are both obsolete.
     * @param {PathChangeEvent} first the first event
     * @param {PathChangeEvent} second the second event
     * @returns {PathEventComparisonEnum} the comparison
     */
    static compareEvents(first, second) {
        if (first.eventType === second.eventType && first.path === second.path) {
            return PathEventComparisonEnum.SecondMakesFirstObsolete;
        }
        if (first.path === second.path) {
            if (second.eventType === PathEventType.Change && first.eventType === PathEventType.Add) {
                return PathEventComparisonEnum.FirstMakesSecondObsolete;
            }
            if (second.eventType === PathEventType.UnlinkDir && first.eventType === PathEventType.AddDir) {
                return PathEventComparisonEnum.BothObsolete;
            }
            if (second.eventType === PathEventType.Unlink && first.eventType === PathEventType.Add) {
                return PathEventComparisonEnum.BothObsolete;
            }
            return PathEventComparisonEnum.SecondMakesFirstObsolete;
        }
        if (first.path.startsWith(second.path)) {
            if (second.eventType !== PathEventType.AddDir && second.eventType !== PathEventType.UnlinkDir) {
                throw new verror_1.VError("inconsistent path change event, event %s triggered for path %s which should be a directory.", second.eventType, second.path);
            }
            return PathEventComparisonEnum.SecondMakesFirstObsolete;
        }
        if (second.path.startsWith(first.path)) {
            if (first.eventType !== PathEventType.AddDir && first.eventType !== PathEventType.UnlinkDir) {
                throw new verror_1.VError("inconsistent path change event, event %s triggered for path %s which should be a directory.", first.eventType, first.path);
            }
            return PathEventComparisonEnum.FirstMakesSecondObsolete;
        }
        return PathEventComparisonEnum.Different;
    }
    /**
     * Constructor of the Event class
     * @param {PathEventType} eventType The type of event.
     * @param {string} path The path for the event
     */
    constructor(eventType, path) {
        this.eventType = eventType;
        this.path = path;
    }
}
exports.PathChangeEvent = PathChangeEvent;
//# sourceMappingURL=pathchangeevent.js.map