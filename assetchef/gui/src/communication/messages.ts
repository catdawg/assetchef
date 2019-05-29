// tslint:disable:no-empty-interface

export interface IRendererToMainOneWayProtocol {
    "OPEN_PROJ": null;
    "NEW_PROJ": null;
}

export interface IMainToRendererOneWayProtocol {
    "PROJ_OPENED": {
        path: string,
    };
}
