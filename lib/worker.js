/*
 * Copyright 2019 Allanic.me ISC License License
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 * Created by mallanic <maxime@allanic.me> at 18/01/2019
 */

const $cluster = require('cluster');
const $lodash = require('lodash');

module.exports = class Worker {
    constructor (callback, args, eventManager) {
        this._callback = callback;
        this._args = args;
        this._eventManager = eventManager;
        this._isClosed = true;
        this.id = $lodash.uniqueId();
    }

    start(additionalService, args) {
        var deferred = Promise.defer();
        var self = this;

        var oldSettings = $cluster.settings;
        $cluster.setupMaster({
            exec: __dirname + '/worker-manager.js',
            silent: false
        });

        var env = $lodash.extend({
            callback: self._callback.toString(),
            filename: self._callback.filename
        }, self._args, additionalService, process.env);
        this._cluster = $cluster.fork(env);
        this._cluster.on('online', () => {
            self._isClosed = false;
            if (!self._cluster)
                return;
            self._cluster.on('message', (message) => {
                if (message)
                    self._eventManager.emit(message.name, ...message.data);
            });
            self._cluster.on('exit', (code, signal) => {
                if (self._isClosed)
                    return;
                self._isClosed = true;
                deferred.resolve();
                self.close();
            });
            self._cluster.on('error', (error) => {
                if (self._isClosed)
                    return;
                self._isClosed = true;
                deferred.reject(error);
                self.close();
            });
        });
        $cluster.setupMaster(oldSettings);

        return deferred.promise;
    }

    isClosed() {
        return this._isClosed;
    }

    close() {
        if (this._cluster)
            this._cluster.kill();
        this._cluster = null;
        return Promise.resolve();
    }
};