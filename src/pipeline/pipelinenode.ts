import { VError } from "verror";

import { IPathTreeReadonly } from "../path/ipathtreereadonly";
import { PathChangeEvent, PathEventType } from "../path/pathchangeevent";
import { PathChangeQueue } from "../path/pathchangequeue";

/**
 * Base class for all nodes in the pipeline.
 */
export abstract class PipelineNode<TContent> {

    /**
     * the tree of the current node, this will passed into the next node, and the next node will
     * listen to changes here.
     */
    public tree: IPathTreeReadonly<TContent>;

    /**
     * the previous tree, changes are listened to here.
     */
    protected _prevTree: IPathTreeReadonly<TContent>;

    /**
     * the queue for tree events.
     */
    protected _prevTreeChangeQueue: PathChangeQueue;

    /**
     * setup the node so it starts working, this will call setupTree on the subclass, which will set
     * this.tree allowing to setup the next node.
     * @param prevTree the previous tree in the pipeline
     */
    public async setup(prevTree: IPathTreeReadonly<TContent>): Promise<void> {
        this._prevTree = prevTree;

        const reset = () => {
            this._prevTreeChangeQueue.push(new PathChangeEvent(PathEventType.AddDir, ""));
        };

        this._prevTreeChangeQueue = new PathChangeQueue(reset);

        this._prevTree.addChangeListener((e) => {
            this._prevTreeChangeQueue.push(e);
        });

        reset();

        this.tree = await this.setupTree();

        if (this.tree == null) {
            throw new VError("Node must setup it's tree.");
        }
    }

    /**
     * Process the changes called since the last update, changing this.tree.
     */
    public abstract async update(): Promise<void>;

    /**
     * resets the processing.
     */
    public abstract reset(): void;

    /**
     * setup the tree, this has to return a tree that will be set into this.tree by the setup method.
     */
    protected abstract setupTree(): Promise<IPathTreeReadonly<TContent>>;
}
