type QuestionName<Messages, QuestionMap> = keyof QuestionMap & keyof Messages;
type AnswerName<Messages, QuestionMap, Q extends QuestionName<Messages, QuestionMap>> = QuestionMap[Q] & keyof Messages;

type AskFunction<Messages, QuestionMap> =
    <Q extends QuestionName<Messages, QuestionMap>>(questionName: Q, question: Messages[Q])
         => Promise<IFullMessage<Messages, AnswerName<Messages, QuestionMap, Q>>>;

type TellFunction<Messages> =
    <M extends keyof Messages>(messageName: M, message: Messages[M]) => void;

type AddHearFunction<Messages> =
    <M extends keyof Messages>(messageName: M, hearer: (message: Messages[M]) => void) => {cancel: () => void};

type AnswererFunction<Messages, QuestionMap> = <Q extends keyof QuestionMap & keyof Messages>(message: Messages[Q]) =>
    Promise<
    {
        type: AnswerName<Messages, QuestionMap, Q>,
        message: Messages[AnswerName<Messages, QuestionMap, Q>];
    }>;

type AddAnswerFunction
    <Messages, QuestionMap> =
        <Q extends QuestionName<Messages, QuestionMap>>(
            question: Q, answerer: AnswererFunction<Messages, QuestionMap>) => {cancel: () => void};

interface IUntypedFullMessage { type: string; message: any; }

interface IFullMessage<Messages, M extends keyof Messages> {
    type: M;
    message: Messages[M];
}
interface IAnswerer<
    Messages extends {[key: string]: any},
    AnsweredQuestionMap extends {[key: string]: string}
    > {
    answer: AddAnswerFunction<Messages, AnsweredQuestionMap>;
}

interface IAsker<
    Messages extends {[key: string]: any},
    AskedQuestionMap extends {[key: string]: string}
    > {
    ask: AskFunction<Messages, AskedQuestionMap>;
}

interface ITeller<
    Messages extends {[key: string]: any}
    > {
    tell: TellFunction<Messages>;
}

interface IHearer<
    Messages extends {[key: string]: any}
    > {
    hear: AddHearFunction<Messages>;
}

export type AskUntypedFunction = (type: string, message: any) => Promise<IUntypedFullMessage>;
export type TellUntypedFunction = (type: string, message: any) => void;
export type AddAnswerUntypedFunction =
    (type: string, handler: (message: any) => Promise<IUntypedFullMessage>) => {cancel: () => void};
export type AddHearUntypedFunction = (type: string, handler: (message: any) => void) => {cancel: () => void};

export type ServerNewConnectionFunction = (handler: (message: any) => void) => {cancel: () => void};

export const createAnswerer = <
    Messages extends {[key: string]: any}, AnsweredQuestionMap extends {[key: string]: any}
> (
    answerer: AddAnswerUntypedFunction,
): IAnswerer<Messages, AnsweredQuestionMap> => {
    return {
        answer: (question, handler) => {
            return answerer(question as any, handler as any);
        },
    };
};

export const createAsker = <Messages extends {[key: string]: any}, AskedQuestionMap extends {[key: string]: any}> (
    asker: AskUntypedFunction,
): IAsker<Messages, AskedQuestionMap> => {
    return {
        ask: async (questionName, message): Promise<any> => {
            return await asker(questionName as string, message);
        },
    };
};

export const createTeller = <Messages> (
    teller: TellUntypedFunction,
): ITeller<Messages> => {
    return {
        tell: (messageName, message) => {
            return teller(messageName as string, message);
        },
    };
};

export const createHearer = <Messages> (
    hearer: AddHearUntypedFunction,
): IHearer<Messages> => {
    return {
        hear: (messageName, handler) => {
            return hearer(messageName as string, handler as any);
        },
    };
};
