"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const pathextra_1 = require("./pathextra");
/**
 * The possible results for comparing events
 * @readonly
 * @enum {string}
 * @typedef {string} PathEventComparisonEnum
 */
var PathEventComparisonEnum;
(function (PathEventComparisonEnum) {
    PathEventComparisonEnum["Different"] = "Different";
    PathEventComparisonEnum["NewMakesOldObsolete"] = "NewMakesOldObsolete";
    PathEventComparisonEnum["NewUpdatesOld"] = "NewUpdatesOld";
    PathEventComparisonEnum["NewObsolete"] = "NewObsolete";
    PathEventComparisonEnum["BothObsolete"] = "BothObsolete";
    PathEventComparisonEnum["Inconsistent"] = "Inconsistent";
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
 * and provides a comparison between events to determine if they are equal, different,
 * or if one makes the other redundant
 */
class PathChangeEvent {
    /**
     * The first event is compared against the second to determine their relationship.
     * @param {PathChangeEvent} oldEv the old event
     * @param {PathChangeEvent} newEv the new event
     * @returns {PathEventComparisonEnum} the comparison
     */
    static compareEvents(oldEv, newEv) {
        const relation = pathextra_1.getPathRelationship(oldEv.path, newEv.path);
        switch (relation) {
            case pathextra_1.PathRelationship.Equal: {
                if (oldEv.eventType === PathEventType.Add) {
                    if (newEv.eventType === PathEventType.Change) {
                        return PathEventComparisonEnum.NewUpdatesOld;
                    }
                    if (newEv.eventType === PathEventType.Unlink) {
                        // since we hadn't processed add, we just ignore both
                        return PathEventComparisonEnum.BothObsolete;
                    }
                    return PathEventComparisonEnum.Inconsistent;
                }
                if (oldEv.eventType === PathEventType.Unlink) {
                    if (newEv.eventType === PathEventType.Add) {
                        // we don't process the unlink, and just process an add instead.
                        return PathEventComparisonEnum.NewMakesOldObsolete;
                    }
                    return PathEventComparisonEnum.Inconsistent;
                }
                if (oldEv.eventType === PathEventType.Change) {
                    if (newEv.eventType === PathEventType.Change) {
                        return PathEventComparisonEnum.NewUpdatesOld;
                    }
                    if (newEv.eventType === PathEventType.Unlink) {
                        return PathEventComparisonEnum.NewMakesOldObsolete;
                    }
                    return PathEventComparisonEnum.Inconsistent;
                }
                if (oldEv.eventType === PathEventType.UnlinkDir) {
                    if (newEv.eventType === PathEventType.AddDir) {
                        // we don't process the unlinkDir, and just process an addDir instead.
                        return PathEventComparisonEnum.NewMakesOldObsolete;
                    }
                    return PathEventComparisonEnum.Inconsistent;
                }
                /* istanbul ignore else */
                if (oldEv.eventType === PathEventType.AddDir) {
                    if (newEv.eventType === PathEventType.UnlinkDir) {
                        return PathEventComparisonEnum.BothObsolete;
                    }
                    return PathEventComparisonEnum.Inconsistent;
                }
            }
            case pathextra_1.PathRelationship.Path1DirectlyInsidePath2: // old inside new
            case pathextra_1.PathRelationship.Path1InsidePath2: { // old inside new
                if (newEv.eventType === PathEventType.UnlinkDir) {
                    return PathEventComparisonEnum.NewMakesOldObsolete; // old was in a folder that deleted
                }
                return PathEventComparisonEnum.Inconsistent;
            }
            case pathextra_1.PathRelationship.Path2DirectlyInsidePath1: { // new inside old
                if (oldEv.eventType === PathEventType.AddDir) {
                    // new is inside a folder that was added
                    // so if are currently processing it, we should retry
                    return PathEventComparisonEnum.NewUpdatesOld;
                }
                if (oldEv.eventType === PathEventType.UnlinkDir) {
                    return PathEventComparisonEnum.NewObsolete; // new is inside a folder that was deleted
                }
                return PathEventComparisonEnum.Inconsistent;
            }
            case pathextra_1.PathRelationship.Path2InsidePath1: { // new inside old
                if (oldEv.eventType === PathEventType.UnlinkDir) {
                    return PathEventComparisonEnum.NewObsolete; // new is inside a folder that was deleted
                }
                if (oldEv.eventType === PathEventType.AddDir) {
                    return PathEventComparisonEnum.NewObsolete; // new is inside a folder that was added
                }
                return PathEventComparisonEnum.Inconsistent;
            }
        }
        return PathEventComparisonEnum.Different;
    }
    /**
     * Checks if the events paths' are the same or if one contains the other.
     * @param oldEv old event
     * @param newEv new event
     */
    static areRelatedEvents(oldEv, newEv) {
        return oldEv.path === newEv.path || oldEv.path.startsWith(newEv.path) || newEv.path.startsWith(oldEv.path);
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