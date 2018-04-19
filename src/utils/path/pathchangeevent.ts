"use strict";
import { VError } from "verror";

/**
 * The possible results for comparing events
 * @readonly
 * @enum {string}
 * @typedef {string} PathEventComparisonEnum
 */
export enum PathEventComparisonEnum {
    Different = "Different",
    FirstMakesSecondObsolete = "FirstMakesSecondObsolete",
    SecondMakesFirstObsolete = "SecondMakesFirstObsolete",
    BothObsolete = "BothObsolete",
}

/**
 * The possible directory and file changes
 * @readonly
 * @enum {string}
 * @typedef {string} PathEventType
 */
export enum PathEventType {
    Add = "add",
    AddDir = "addDir",
    Unlink = "unlink",
    UnlinkDir = "unlinkDir",
    Change = "change",
}

/**
 * A directory change event. This a simple class that aggregates a path and an event,
 * and provides a comparison between events * to determine if they are equal, different,
 * or if one makes the other redundant
 */
export class PathChangeEvent {
    /**
     * This method is very important and pretty much is where the "magic" happens.
     * The first event is compared against the second to determine if they are equal,
     * different, one makes the other obsolete, or if they are both obsolete.
     * @param {PathChangeEvent} first the first event
     * @param {PathChangeEvent} second the second event
     * @returns {PathEventComparisonEnum} the comparison
     */
    public static compareEvents(first: PathChangeEvent, second: PathChangeEvent): PathEventComparisonEnum {

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
                throw new VError(
                    "inconsistent path change event, event %s triggered for path %s which should be a directory.",
                    second.eventType, second.path);
            }

            return PathEventComparisonEnum.SecondMakesFirstObsolete;
        }

        if (second.path.startsWith(first.path)) {

            if (first.eventType !== PathEventType.AddDir && first.eventType !== PathEventType.UnlinkDir) {
                throw new VError(
                    "inconsistent path change event, event %s triggered for path %s which should be a directory.",
                    first.eventType, first.path);
            }

            return PathEventComparisonEnum.FirstMakesSecondObsolete;
        }

        return PathEventComparisonEnum.Different;
    }

    public eventType: PathEventType;
    public path: string;

    /**
     * Constructor of the Event class
     * @param {PathEventType} eventType The type of event.
     * @param {string} path The path for the event
     */
    constructor(eventType: PathEventType, path: string) {
        this.eventType = eventType;
        this.path = path;
    }
}
