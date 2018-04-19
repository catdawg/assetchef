"use strict";
const pathchangeevent_1 = require("./pathchangeevent");
module.exports = class PathChangeFilter {
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
     * @returns {PathChangeEvent} the poped event.
     */
    pop() {
        this._eventBeingHandled = null;
        this._eventDomainChangedCallback = null;
        return this._eventQueue.shift();
    }
    /**
     * Peek on the first event in the queue. Use this before handling,
     * if the domain changes, do not pop and call this again.
     * @param {EventDomainChangedCallback} onEventDomainChangedCallback
     * the callback for when the event being handled is "dirty", meaning something within it changed.
     * @returns {PathChangeEvent} the first event in the queue
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
     * Pushes into the queue a change. This function uses the PathChangeEvent.compareEvents method to filter the event.
     * @param {PathChangeEvent} event the event to push
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
            const compareResult = pathchangeevent_1.PathChangeEvent.compareEvents(event, newEvent);
            switch (compareResult) {
                case pathchangeevent_1.PathEventComparisonEnum.Different:
                    newEventQueue.push(event);
                    break;
                case pathchangeevent_1.PathEventComparisonEnum.FirstMakesSecondObsolete:
                    newEventQueue.push(event);
                    added = true;
                    break;
                case pathchangeevent_1.PathEventComparisonEnum.SecondMakesFirstObsolete:
                    newEventQueue.push(newEvent);
                    added = true;
                    break;
                case pathchangeevent_1.PathEventComparisonEnum.BothObsolete:
                    added = true; // we just ignore both
                    break;
            }
        }
        if (!added) {
            newEventQueue.push(newEvent);
        }
        this._eventQueue = newEventQueue;
        if (this._eventBeingHandled != null) {
            const compareResult = pathchangeevent_1.PathChangeEvent.compareEvents(this._eventBeingHandled, newEvent);
            switch (compareResult) {
                case pathchangeevent_1.PathEventComparisonEnum.Different:
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
//# sourceMappingURL=pathchangefilter.js.map