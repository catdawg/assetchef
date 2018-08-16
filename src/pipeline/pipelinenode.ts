import { VError } from "verror";

import { IPathTreeReadonly } from "path/ipathtreereadonly";
import { PathChangeEvent, PathEventType } from "path/pathchangeevent";
import { PathChangeQueue } from "path/pathchangequeue";

/**
 * Base class for all nodes in the pipeline.
 */
export abstract class PipelineNode<TContent> {

    /**
     * the tree interface of the current node, this will passed into the next node, and the next node will
     * listen to changes here.
     */
    public treeInterface: IPathTreeReadonly<TContent>;

    /**
     * the previous tree, changes are listened to here.
     */
    protected _prevTreeInterface: IPathTreeReadonly<TContent>;

    /**
     * the queue for tree events.
     */
    protected _prevTreeInterfaceChangeQueue: PathChangeQueue;

    /**
     * setup the node so it starts working, this will call setupInterface on the subclass, which will set
     * this.treeInterface allowing to setup the next node.
     * @param prevInterface the previous tree in the pipeline
     */
    public async setup(prevInterface: IPathTreeReadonly<TContent>): Promise<void> {
        this._prevTreeInterface = prevInterface;

        const reset = () => {
            this._prevTreeInterfaceChangeQueue.push(new PathChangeEvent(PathEventType.AddDir, ""));
        };

        this._prevTreeInterfaceChangeQueue = new PathChangeQueue(reset);

        this._prevTreeInterface.addChangeListener((e) => {
            this._prevTreeInterfaceChangeQueue.push(e);
        });

        reset();

        this.treeInterface = await this.setupInterface();

        if (this.treeInterface == null) {
            throw new VError("Node must setup it's tree.");
        }
    }

    /**
     * Process the changes called since the last update.
     */
    public abstract async update(): Promise<void>;

    /**
     * resets the processing.
     */
    public abstract reset(): void;

    /**
     * setup the interface,
     * this has to return a tree interface that will be set into this.treeInterface by the setup method.
     */
    protected abstract setupInterface(): Promise<IPathTreeReadonly<TContent>>;
}
