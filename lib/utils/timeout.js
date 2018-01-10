/**
 * setTimeout wrapper with Promise.
 * @param {int} millis the amount of milliseconds to wait
 * @returns {Promise} promise for the timeout
 */
module.exports = function(millis) {
    return new Promise((resolve) => {
        setTimeout(resolve, millis);
    });
};
