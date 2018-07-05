import {getPathRelationship, PathRelationship} from "./pathextra";

/**
 * The possible results for comparing events
 * @readonly
 * @enum {string}
 * @typedef {string} PathEventComparisonEnum
 */
export enum PathEventComparisonEnum {
    Different = "Different",
    NewMakesOldObsolete = "NewMakesOldObsolete",
    NewUpdatesOld = "NewUpdatesOld",
    NewObsolete = "NewObsolete",
    BothObsolete = "BothObsolete",
    Inconsistent = "Inconsistent",
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
     * The first event is compared against the second to determine their relationship.
     * @param {PathChangeEvent} oldEv the old event
     * @param {PathChangeEvent} newEv the new event
     * @returns {PathEventComparisonEnum} the comparison
     */
    public static compareEvents(oldEv: PathChangeEvent, newEv: PathChangeEvent): PathEventComparisonEnum {
        const relation = getPathRelationship(oldEv.path, newEv.path);

        switch (relation) {
            case PathRelationship.Equal: {
                if (oldEv.eventType === PathEventType.Add) {
                    if (newEv.eventType === PathEventType.Change) {
                        return PathEventComparisonEnum.NewUpdatesOld;
                    }

                    if (newEv.eventType === PathEventType.Unlink) {
                        return PathEventComparisonEnum.BothObsolete;
                    }

                    return PathEventComparisonEnum.Inconsistent;
                }

                if (oldEv.eventType === PathEventType.Unlink) {
                    if (newEv.eventType === PathEventType.Add) {
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

            case PathRelationship.Path1DirectlyInsidePath2:  // old inside new
            case PathRelationship.Path1InsidePath2: { // old inside new
                if (newEv.eventType === PathEventType.UnlinkDir) {
                    return PathEventComparisonEnum.NewMakesOldObsolete;
                }

                return PathEventComparisonEnum.Inconsistent;
            }

            case PathRelationship.Path2DirectlyInsidePath1: { // new inside old
                if (oldEv.eventType === PathEventType.AddDir) {
                    return PathEventComparisonEnum.NewUpdatesOld;
                }

                if (oldEv.eventType === PathEventType.UnlinkDir) {
                    return PathEventComparisonEnum.NewObsolete;
                }

                return PathEventComparisonEnum.Inconsistent;
            }

            case PathRelationship.Path2InsidePath1: { // new inside old
                if (oldEv.eventType === PathEventType.UnlinkDir) {
                    return PathEventComparisonEnum.NewObsolete;
                }

                if (oldEv.eventType === PathEventType.AddDir) {
                    return PathEventComparisonEnum.NewObsolete;
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
    public static areRelatedEvents(oldEv: PathChangeEvent, newEv: PathChangeEvent): boolean {
        return oldEv.path === newEv.path || oldEv.path.startsWith(newEv.path) || newEv.path.startsWith(oldEv.path);
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
