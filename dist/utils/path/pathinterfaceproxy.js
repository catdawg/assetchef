"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const change_emitter_1 = require("change-emitter");
const verror_1 = require("verror");
const ipathchangeevent_1 = require("../../plugin/ipathchangeevent");
/**
 * Allows an instance of a IPathTreeReadonly to actually be another one.
 * For example, if a system needs to maintain one instance on an API but actually
 * feeding data to it depending on the setup.
 */
class PathInterfaceProxy {
    /**
     * Create the proxy.
     */
    constructor() {
        this.changeEmitter = change_emitter_1.createChangeEmitter();
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
    setProxiedInterface(proxiedInterface) {
        if (proxiedInterface == null) {
            throw new verror_1.VError("proxiedInterface argument can't be null");
        }
        if (this.proxiedInterface != null) {
            this.removeProxiedInterface();
        }
        this.list = proxiedInterface.list;
        this.listAll = proxiedInterface.listAll;
        this.isDir = proxiedInterface.isDir;
        this.get = proxiedInterface.get;
        this.exists = proxiedInterface.exists;
        this.proxiedInterfaceUnlistenToken = proxiedInterface.listenChanges((ev) => {
            /* istanbul ignore next */
            if (proxiedInterface === this.proxiedInterface) {
                this.changeEmitter.emit(ev);
            }
        });
        this.proxiedInterface = proxiedInterface;
        if (this.proxiedInterface.exists("")) {
            if (this.proxiedInterface.isDir("")) {
                this.changeEmitter.emit({ path: "", eventType: ipathchangeevent_1.PathEventType.AddDir });
            }
            else {
                this.changeEmitter.emit({ path: "", eventType: ipathchangeevent_1.PathEventType.Add });
            }
        }
    }
    /**
     * Removes the proxied interface, restoring to the default state.
     * This will trigger a unlink event for the root, since the data is now gone.
     */
    removeProxiedInterface() {
        if (this.proxiedInterface == null) {
            throw new verror_1.VError("proxy was not active, can't remove");
        }
        if (this.proxiedInterface.exists("")) {
            if (this.proxiedInterface.isDir("")) {
                this.changeEmitter.emit({ path: "", eventType: ipathchangeevent_1.PathEventType.UnlinkDir });
            }
            else {
                this.changeEmitter.emit({ path: "", eventType: ipathchangeevent_1.PathEventType.Unlink });
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
    listenChanges(cb) {
        return { unlisten: this.changeEmitter.listen(cb) };
    }
    /**
     * Part of the readonly interface API, implementation will be replaced, this is the unproxied version.
     * @param path the path to list.
     */
    *list(path) {
        throw new verror_1.VError("path doesn't exist");
    }
    /**
     * Part of the readonly interface API, implementation will be replaced, this is the unproxied version.
     */
    *listAll() {
        return;
    }
    /**
     * Part of the readonly interface API, implementation will be replaced, this is the unproxied version.
     * @param path the path to check
     */
    isDir(path) {
        throw new verror_1.VError("path doesn't exist");
    }
    /**
     * Part of the readonly interface API, implementation will be replaced, this is the unproxied version.
     * @param path the path to check
     */
    exists(path) {
        return false;
    }
    /**
     * Part of the readonly interface API, implementation will be replaced, this is the unproxied version.
     * @param path the path to request
     */
    get(path) {
        throw new verror_1.VError("path doesn't exist");
    }
}
exports.PathInterfaceProxy = PathInterfaceProxy;
//# sourceMappingURL=pathinterfaceproxy.js.map