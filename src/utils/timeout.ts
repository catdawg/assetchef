/**
 * setTimeout wrapper with Promise.
 * @param {number} millis the amount of milliseconds to wait
 * @returns {Promise} promise for the timeout
 */
export = (millis: number) => {
    return new Promise((resolve) => {
        setTimeout(resolve, millis);
    });
};
