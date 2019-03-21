import { ChangeEmitterOf1, createChangeEmitter } from "change-emitter";
import { VError } from "verror";

import { IPathChangeEvent, PathEventType } from "./ipathchangeevent";
import { IPathTreeRead } from "./ipathtreeread";

/**
 * Allows an instance of a IPathTreeRead to actually be another one.
 * For example, if a system needs to maintain one instance on an API but actually
 * feeding data to it depending on the setup.
 */
export class PathInterfaceProxy<TContent> implements IPathTreeRead<TContent> {
    private proxiedInterface: IPathTreeRead<TContent>;

    private unproxiedList: (path: string) => IterableIterator<string>;
    private unproxiedListAll: () => IterableIterator<string>;
    private unproxiedIsDir: (path: string) => boolean;
    private unproxiedGet: (path: string) => TContent;
    private unproxiedExists: (path: string) => boolean;
    private proxiedInterfaceUnlistenToken: {unlisten: () => void};

    private changeEmitter: ChangeEmitterOf1<IPathChangeEvent> = createChangeEmitter<IPathChangeEvent>();

    /**
     * Create the proxy.
     */
    constructor() {
        this.unproxiedExists = this.exists;
        this.unproxiedGet = this.get;
        this.unproxiedIsDir = this.isDir;
        this.unproxiedList = this.list;
        this.unproxiedListAll = this.listAll;
    }

    /**
     * Proxies the argument interface, so that any methods that were called on this class are redirected
     * to the proxiedInterface.
     * This will trigger a unlink event for the root, and an add event in succession, so that whoever
     * is processing changes knows that the data changed and needs to be reprocessed.
     * @param proxiedInterface the proxied interface
     */
    public setProxiedInterface(proxiedInterface: IPathTreeRead<TContent>) {
        if (proxiedInterface == null) {
            throw new VError("proxiedInterface argument can't be null");
        }

        if (this.proxiedInterface != null) {
            this.removeProxiedInterface();
        }

        this.list = function *(p: string): IterableIterator<string> {
            yield* proxiedInterface.list(p);
        };
        this.listAll = function *(): IterableIterator<string> {
            yield* proxiedInterface.listAll();
        };
        this.isDir = (p: string): boolean => {
            return proxiedInterface.isDir(p);
        };
        this.get = (p: string): TContent => {
            return proxiedInterface.get(p);
        };
        this.exists = (p: string): boolean => {
            return proxiedInterface.exists(p);
        };

        this.proxiedInterfaceUnlistenToken = proxiedInterface.listenChanges((ev) => {
            /* istanbul ignore next */
            if (proxiedInterface === this.proxiedInterface) {
                this.changeEmitter.emit(ev);
            }
        });

        this.proxiedInterface = proxiedInterface;

        if (this.proxiedInterface.exists("")) {
            if (this.proxiedInterface.isDir("")) {
                this.changeEmitter.emit({path: "", eventType: PathEventType.AddDir});
            } else {
                this.changeEmitter.emit({path: "", eventType: PathEventType.Add});
            }
        }
    }

    /**
     * Removes the proxied interface, restoring to the default state.
     * This will trigger a unlink event for the root, since the data is now gone.
     */
    public removeProxiedInterface(): void {
        if (this.proxiedInterface == null) {
            throw new VError("proxy was not active, can't remove");
        }

        if (this.proxiedInterface.exists("")) {
            if (this.proxiedInterface.isDir("")) {
                this.changeEmitter.emit({path: "", eventType: PathEventType.UnlinkDir});
            } else {
                this.changeEmitter.emit({path: "", eventType: PathEventType.Unlink});
            }
        }

        this.proxiedInterfaceUnlistenToken.unlisten();
        this.list = this.unproxiedList;
        this.listAll = this.unproxiedListAll;
        this.isDir = this.unproxiedIsDir;
        this.get = this.unproxiedGet;
        this.exists = this.unproxiedExists;
        this.proxiedInterface = null;
    }

    /**
     * Part of the readonly interface API. As opposed to the other interface methods, this one keeps it's own
     * changeEmitter, because when the proxied interface changes, you want to keep the same listens.
     * @param cb the callback for events
     */
    public listenChanges(cb: (ev: IPathChangeEvent) => void): { unlisten: () => void; } {
        return {unlisten: this.changeEmitter.listen(cb)};
    }

    /**
     * Part of the readonly interface API, implementation will be replaced, this is the unproxied version.
     * @param path the path to list.
     */
    public *list(path: string): IterableIterator<string> {
        throw new VError("path doesn't exist");
    }

    /**
     * Part of the readonly interface API, implementation will be replaced, this is the unproxied version.
     */
    public *listAll(): IterableIterator<string> {
        return;
    }

    /**
     * Part of the readonly interface API, implementation will be replaced, this is the unproxied version.
     * @param path the path to check
     */
    public isDir(path: string): boolean {
        throw new VError("path doesn't exist");
    }

    /**
     * Part of the readonly interface API, implementation will be replaced, this is the unproxied version.
     * @param path the path to check
     */
    public exists(path: string): boolean {
        return false;
    }

    /**
     * Part of the readonly interface API, implementation will be replaced, this is the unproxied version.
     * @param path the path to request
     */
    public get(path: string): TContent {
        throw new VError("path doesn't exist");
    }
}
