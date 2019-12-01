/*
 * Copyright 2018 Allanic.me ISC License License
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 * Created by mallanic <maxime@allanic.me> at 21/09/2018
 */

const $lodash = require('lodash');
const $publicIp = require('public-ip');
const $util = require('util');
const $glob = require('glob');
const $fs = require('fs');

module.exports.setTimeout = $util.promisify(setTimeout);

module.exports.mkdir = $util.promisify($fs.mkdir);
module.exports.writeFile = $util.promisify($fs.writeFile);
module.exports.glob = $util.promisify($glob);

module.exports.promise = require('q-native');

module.exports.uuid = () => {
    var d = $lodash.now();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = (d + $lodash.random(16)) % 16 | 0;
        d = Math.floor(d / 16);
        return (c == 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
};

module.exports.getIP = () => {
    return $publicIp.v4();
}

module.exports.getTimeoutPromise = (promise, timeout, error) => {
    if (!error)
        error = new Error('timeout');
    else if ($lodash.isString(error))
        error = new Error(error);

    return Promise.race([
        promise,
        new Promise(function(resolve, reject) {
            setTimeout(function() {
                reject(error);
            }, timeout);
        })
    ]);
};