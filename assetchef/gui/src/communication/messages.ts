// tslint:disable:no-empty-interface

export interface IEmptyMessage {
}

export interface IProjOpenedMessage {
    path: string;
}

export interface IMessageMap {
    "NONE": IEmptyMessage;
    "PROJ_OPENED": IProjOpenedMessage;
    "PROJ_OPEN_CANCEL": IEmptyMessage;
    "OPEN_PROJ": IEmptyMessage;
    "NEW_PROJ": IEmptyMessage;
}

export interface IRendererQuestions {
    "OPEN_PROJ": "PROJ_OPENED" | "PROJ_OPEN_CANCEL";
    "NEW_PROJ": "PROJ_OPENED" | "PROJ_OPEN_CANCEL";
}

export interface IMainQuestions {
    "NONE": "NONE";
}
