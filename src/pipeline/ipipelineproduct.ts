/**
 * usually nodes receive a file or multiple files, and produce
 */
export interface IPipelineProduct<TContent> {
    path: string;
    content: TContent;
}
