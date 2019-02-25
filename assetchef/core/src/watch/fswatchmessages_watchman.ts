import { IPathChangeEvent } from "../path/ipathchangeevent";

// HOST to FORK
export interface IStartMessage {
    type: "Start";
    path: string;
}

export interface IDebugExitMessage {
    type: "DebugExit";
}

// FORK to HOST
export interface IStartedMessage {
    type: "Started";
}

export interface ILogMessage {
    type: "Log";
    msg: string;
}

export interface ILogWarnMessage {
    type: "LogWarn";
    msg: string;
}

export interface IFSEventMessage {
    type: "FSEvent";
    ev: IPathChangeEvent;
}
