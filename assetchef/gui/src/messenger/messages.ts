// tslint:disable:no-empty-interface

export interface IEmptyMessage {
}

export interface IProjOpenedMessage {
    path: string;
}

export interface IMessageMap {
    "PROJ_OPENED": IProjOpenedMessage;
    "PROJ_OPEN_CANCEL": IEmptyMessage;
    "OPEN_PROJ": IEmptyMessage;
    "NEW_PROJ": IEmptyMessage;
}

export interface ISubscriptionMap {
    "PROJ_OPENING": "PROJ_OPENED" | "PROJ_OPEN_CANCEL";
}

export interface IReplyMap {
    "OPEN_PROJ": "PROJ_OPENED" | "PROJ_OPEN_CANCEL";
    "NEW_PROJ": "PROJ_OPENED" | "PROJ_OPEN_CANCEL";
}

export type Message<T extends keyof IMessageMap> = IMessageMap[T];
export type FullMessage<T extends keyof IMessageMap> = Message<T> & {messageID: string};

export type Req = keyof IReplyMap;

export type Reply<T extends keyof IReplyMap> = IMessageMap[IReplyMap[T]];
export type FullReply<T extends keyof IReplyMap> = Reply<T> & {replyType: IReplyMap[T]} & {messageID: string};

export type Subscription = keyof ISubscriptionMap;

export type SubbedMessage<T extends Subscription> = IMessageMap[ISubscriptionMap[T]];
export type FullSubbedMessage<T extends Subscription> = SubbedMessage<T> & {messageType: ISubscriptionMap[T]};
