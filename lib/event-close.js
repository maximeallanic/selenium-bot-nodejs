/*
 * Copyright 2018 Allanic.me ISC License License
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 * Created by mallanic <maxime@allanic.me> at 04/12/2018
 */

const $lodash = require('lodash');

module.exports.EventClose = class {
    constructor () {
        this._onClose = [];
    }

    onClose(callback) {
        if (this._isClosed)
            callback();
        else
            this._onClose.push(callback);
    }

    isClosed() {
        return this._isClosed;
    }

    close() {
        var self = this;

        function close() {
            //console.log(this.constructor.name, self.promiseClose);
            if (!self.promiseClose) {
                if ($lodash.isFunction(self._close))
                    self.promiseClose = Promise.parse(self._close())
                else
                    self.promiseClose = Promise.resolve();
            }

            return self.promiseClose;
        }

        var preload = (this.onLoaded ? Promise.parse(this.onLoaded) : Promise.resolve());

        if (!this._isClosed) {
            this._isClosed = true;
            return preload
                .finally(() => {
                    if ($lodash.isFunction(self._beforeClose))
                        return Promise.parse(self._beforeClose());
                })
                .finally(() => close())
                .finally(() => {
                    if (self._onClose.length > 0)
                        return Promise.allSettled($lodash.map(self._onClose, (onClose) => {
                            try {
                                return Promise.parse(onClose());
                            } catch (e) {
                                return Promise.reject(e);
                            }
                        }));
                })
                .fail(console.error);
        }
        return preload.finally(() => close());
    }
};