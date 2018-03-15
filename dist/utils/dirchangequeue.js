"use strict";
const dirchangeevent_1 = require("./dirchangeevent");
module.exports = class DirChangeQueue {
    /**
     * s
     */
    constructor() {
        this._eventQueue = [];
    }
    /**
     * @returns {boolean} if the queue is empty
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
     * This callback is called when something changes the domain of the event being handled.
     * E.g. a file inside the directory that is being handled changes.
     * @typedef {function} EventDomainChangedCallback
     */
    /**
     * Peek on the first event in the queue. Use this before handling,
     * if the domain changes, do not pop and call this again.
     * @param {EventDomainChangedCallback} onEventDomainChangedCallback
     * the callback for when the event being handled is "dirty", meaning something within it changed.
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
     * Pushes into the queue a change. This function uses the DirChangeEvent.compareEvents method to filter the event.
     * @param {DirChangeEvent} event the event to push
     * @returns {void}
     */
    push(ev) {
        const newEvent = ev;
        let added = false;
        const newEventQueue = [];
        for (const event of this._eventQueue) {
            if (added) {
                newEventQueue.push(event);
                continue;
            }
            const compareResult = dirchangeevent_1.DirChangeEvent.compareEvents(event, newEvent);
            switch (compareResult) {
                case dirchangeevent_1.DirEventComparisonEnum.Different:
                    newEventQueue.push(event);
                    break;
                case dirchangeevent_1.DirEventComparisonEnum.FirstMakesSecondObsolete:
                    newEventQueue.push(event);
                    added = true;
                    break;
                case dirchangeevent_1.DirEventComparisonEnum.SecondMakesFirstObsolete:
                    newEventQueue.push(newEvent);
                    added = true;
                    break;
                case dirchangeevent_1.DirEventComparisonEnum.BothObsolete:
                    added = true; // we just ignore both
                    break;
            }
        }
        if (!added) {
            newEventQueue.push(newEvent);
        }
        this._eventQueue = newEventQueue;
        if (this._eventBeingHandled != null) {
            const compareResult = dirchangeevent_1.DirChangeEvent.compareEvents(this._eventBeingHandled, newEvent);
            switch (compareResult) {
                case dirchangeevent_1.DirEventComparisonEnum.Different:
                    break;
                default:
                    this._triggerEventDomainChanged();
            }
        }
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
};
//# sourceMappingURL=dirchangequeue.js.map