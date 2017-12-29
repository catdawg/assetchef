"use strict";
const VError = require("verror").VError;
const fs = require("fs");
const watchdirectory = require("./watchdirectory");

/**
 * A directory change event. This a simple class that aggregates a path and an event, and provides a comparison between events
 * to determine if they are equal, different, or if one makes the other redundant
 */
class DirChangeEvent {
    /**
     * Constructor of the Event class
     * @param {string} eventType The type of event. See {@link watchdirectory}
     * @param {string} path The path for the event
     */
    constructor (eventType, path) {
        this.eventType = eventType;
        this.path = path;
    }

    /**
     * This method is very important and pretty much is where the "magic" happens.
     * The first event is compared against the second to determine if they are equal, 
     * different, one makes the other obsolete, or if they are both obsolete.
     * @param {DirChangeEvent} first the first event
     * @param {DirChangeEvent} second the second event
     * @returns {DirChangeEvent.EventComparisonEnum} the comparison
     */
    static compareEvents(first, second) {

        if (first.eventType === second.eventType && first.path === second.path) {
            return DirChangeEvent.EventComparisonEnum.SecondMakesFirstObsolete;
        }

        if (first.path === second.path) {
            if (second.eventType === "change" && first.eventType === "add") {
                return DirChangeEvent.EventComparisonEnum.FirstMakesSecondObsolete;
            }

            if (second.eventType === "unlinkDir" && first.eventType === "addDir") {
                return DirChangeEvent.EventComparisonEnum.BothObsolete;
            }
            
            if (second.eventType === "unlink" && first.eventType === "add") {
                return DirChangeEvent.EventComparisonEnum.BothObsolete;
            }

            return DirChangeEvent.EventComparisonEnum.SecondMakesFirstObsolete;
        }

        if (first.path.startsWith(second.path)) {

            if (second.eventType !== "addDir" && second.eventType !== "unlinkDir") {
                throw new VError("inconsistent dir change event, event %s triggered for path %s which should be a directory.", second.eventType, second.path);
            }

            return DirChangeEvent.EventComparisonEnum.SecondMakesFirstObsolete;
        }

        if (second.path.startsWith(first.path)) {
            
            if (first.eventType !== "addDir" && first.eventType !== "unlinkDir") {
                throw new VError("inconsistent dir change event, event %s triggered for path %s which should be a directory.", first.eventType, first.path);
            }

            return DirChangeEvent.EventComparisonEnum.FirstMakesSecondObsolete;
        }


        return DirChangeEvent.EventComparisonEnum.Different;
    }
}

DirChangeEvent.EventComparisonEnum = {
    Different: "Different",
    FirstMakesSecondObsolete: "FirstMakesSecondObsolete",
    SecondMakesFirstObsolete: "SecondMakesFirstObsolete",
    BothObsolete: "BothObsolete"
};

/**
 * This class watches a directory and smartly filters out events that are duplicates. 
 * For example, if a file is removed inside a directory that is removed, only the removed directory event is present.
 */
module.exports = class DirChangeQueue {

    /**
     * @param {string} directory the directory to watch
     * @throws {VError} if the directory is null or doesn't exist.
     */
    constructor(directory) {

        if (directory == null) {
            throw new VError("directory is null");
        }
        if (!fs.existsSync(directory)) {
            throw new VError("directory does not exist");
        }
    
        this._cancelToken = watchdirectory.watchForChanges(directory, this._onDirChange.bind(this));
        this._eventQueue = [];
    }
    
    /**
     * cancel the watch
     * @returns {void}
     */
    cancel() {
        if (this._cancelToken == null) {
            throw new VError("called cancel twice on DirChangeQueue");
        }

        this._cancelToken.cancel();
        this._cancelToken = null;
    }

    /**
     * @returns {bool} if the queue is empty
     */
    isEmpty() {
        return this._eventQueue.length === 0;
    }

    /**
     * Pops the first event in the queue. Only pop after you've handled the event.
     * @returns {DirChangeEvent} the poped event.
     */
    pop() {
        this._eventBeingHandled = null;
        this._eventDomainChangedCallback = null;
        return this._eventQueue.shift();
    }

    /**
     * This callback is called when something changes the domain of the event being handled. E.g. a file inside the directory that is being handled changes.
     *
     * @callback EventDomainChangedCallback
     */

    /**
     * Peek on the first event in the queue. Use this before handling, if the domain changes, do not pop and call this again.
     * @param {EventDomainChangedCallback} onEventDomainChangedCallback the callback for when the event being handled is "dirty", meaning something within it changed.
     * @returns {DirChangeEvent} the first event in the queue
     */
    peek(onEventDomainChangedCallback) {

        if (this.isEmpty()) {
            return null;
        }

        if (onEventDomainChangedCallback != null) {
            this._eventBeingHandled = this._eventQueue[0];
            this._eventDomainChangedCallback = onEventDomainChangedCallback;
        }
        return this._eventQueue[0];
    }

    /**
     * helper to call the event domain changed callback.
     * @returns {void}
     */
    _triggerEventDomainChanged() {
        const callback = this._eventDomainChangedCallback;
        const event = this._eventBeingHandled;
        this._eventBeingHandled = null;
        this._eventDomainChangedCallback = null;
        callback(event);
    }

    /**
     * The callback from watchdirectory. This function uses the DirChangeEvent.compareEvents method to filter the event.
     * @param {string} eventType the event type.
     * @param {string} path the path of the dir change
     * @returns {void}
     */
    _onDirChange(eventType, path) {
        const newEvent = new DirChangeEvent(eventType, path);
        let added = false;
        const newEventQueue = [];

        for (const event of this._eventQueue) {
            if (added) {
                newEventQueue.push(event);
                continue;
            }

            const compareResult = DirChangeEvent.compareEvents(event, newEvent);

            switch (compareResult) {
            case DirChangeEvent.EventComparisonEnum.Different:
                newEventQueue.push(event);
                break;
            case DirChangeEvent.EventComparisonEnum.FirstMakesSecondObsolete:
                newEventQueue.push(event);
                added = true;
                break;
            case DirChangeEvent.EventComparisonEnum.SecondMakesFirstObsolete:
                newEventQueue.push(newEvent);
                added = true;
                break;
            case DirChangeEvent.EventComparisonEnum.BothObsolete:
                added = true; //we just ignore both
                break;
            }
        }
        if (!added)
        {
            newEventQueue.push(newEvent);
        }

        this._eventQueue = newEventQueue;

        if (this._eventBeingHandled != null) {

            const compareResult = DirChangeEvent.compareEvents(this._eventBeingHandled, newEvent);
            switch (compareResult) {
            case DirChangeEvent.EventComparisonEnum.Different:
                break;
            default:
                this._triggerEventDomainChanged();
            }
        }
    }
};

module.exports._DirChangeEvent = DirChangeEvent;
