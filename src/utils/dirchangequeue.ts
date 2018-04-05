"use strict";
import * as fs from "fs";
import {DirChangeEvent, DirEventComparisonEnum} from "./dirchangeevent";

/**
 * This callback is called when something changes the domain of the event being handled.
 * E.g. a file inside the directory that is being handled changes.
 */
type EventDomainChangedCallback = () => void;

/**
 * This class receives directory event changes and smartly filters out events that are duplicates.
 * For example, if a file is removed inside a directory that is removed, only the removed directory event is present.
 */
export = class DirChangeQueue {

    private _eventDomainChangedCallback: (event: DirChangeEvent) => void;
    private _eventBeingHandled: DirChangeEvent;
    private _eventQueue: DirChangeEvent[];

    constructor() {

        this._eventQueue = [];
    }

    /**
     * @returns {boolean} if the queue is empty
     */
    public isEmpty() {
        return this._eventQueue.length === 0;
    }

    /**
     * Pops the first event in the queue. Only pop after you've handled the event.
     * @returns {DirChangeEvent} the poped event.
     */
    public pop() {
        this._eventBeingHandled = null;
        this._eventDomainChangedCallback = null;
        return this._eventQueue.shift();
    }

    /**
     * Peek on the first event in the queue. Use this before handling,
     * if the domain changes, do not pop and call this again.
     * @param {EventDomainChangedCallback} onEventDomainChangedCallback
     * the callback for when the event being handled is "dirty", meaning something within it changed.
     * @returns {DirChangeEvent} the first event in the queue
     */
    public peek(onEventDomainChangedCallback: EventDomainChangedCallback): DirChangeEvent {

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
    public push(ev: DirChangeEvent): void {
        const newEvent = ev;
        let added = false;
        const newEventQueue = [];

        for (const event of this._eventQueue) {
            if (added) {
                newEventQueue.push(event);
                continue;
            }

            const compareResult = DirChangeEvent.compareEvents(event, newEvent);

            switch (compareResult) {
            case DirEventComparisonEnum.Different:
                newEventQueue.push(event);
                break;
            case DirEventComparisonEnum.FirstMakesSecondObsolete:
                newEventQueue.push(event);
                added = true;
                break;
            case DirEventComparisonEnum.SecondMakesFirstObsolete:
                newEventQueue.push(newEvent);
                added = true;
                break;
            case DirEventComparisonEnum.BothObsolete:
                added = true; // we just ignore both
                break;
            }
        }
        if (!added) {
            newEventQueue.push(newEvent);
        }

        this._eventQueue = newEventQueue;

        if (this._eventBeingHandled != null) {

            const compareResult = DirChangeEvent.compareEvents(this._eventBeingHandled, newEvent);
            switch (compareResult) {
            case DirEventComparisonEnum.Different:
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
    private _triggerEventDomainChanged() {
        const callback = this._eventDomainChangedCallback;
        const event = this._eventBeingHandled;
        this._eventBeingHandled = null;
        this._eventDomainChangedCallback = null;
        callback(event);
    }
};
