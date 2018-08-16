"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * setTimeout wrapper with Promise.
 * @param {number} millis the amount of milliseconds to wait
 * @returns {Promise} promise for the timeout
 */
function timeout(millis) {
    return new Promise((resolve) => {
        setTimeout(resolve, millis);
    });
}
exports.timeout = timeout;
//# sourceMappingURL=timeout.js.map