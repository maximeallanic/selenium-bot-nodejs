/*
 * Copyright 2018 Allanic.me ISC License License
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 * Created by mallanic <maxime@allanic.me> at 14/10/2018
 */

const $lodash = require('lodash');
const $getCallerFile = require('get-caller-file');
const Cluster = require('./cluster');
const Machine = require('./docker-machine');
const $util = require('./util');
const $q = require('q-native');

module.exports = class Account {
    constructor (config) {
        $lodash.extend(this, config);

        this._clusters = [];

        this._machine = new Machine(this.driver, this.customParams);

        var self = this;
        function exitHandler(signal, exitCode) {
            try {
                Promise.all($lodash.map(self._clusters, (cluster) => cluster.close()))
                    .then(() => {
                        process.exit(0);
                    })
                    .fail(console.error);
            } catch (e) {
                console.error(e);
                process.exit(2);
            }
        }

        //do something when app is closing
        process.on('exit', exitHandler.bind(null, null));

        //catches ctrl+c event
        process.on('SIGINT', exitHandler.bind(null, 'SIGINT'));

        // catches "kill pid" (for example: nodemon restart)
        process.on('SIGUSR1', exitHandler.bind(null, 'SIGUSR1'));
        process.on('SIGUSR2', exitHandler.bind(null, 'SIGUSR2'));

        //catches uncaught exceptions
        process.on('uncaughtException', (error) => {
            exitHandler(null, null);
        });
    }

    getClusters() {
        return this._clusters;
    }

    listAllClusters() {
        return this._machine.list();
    }

    deleteCluster(cluster) {
        return this._machine.delete(cluster);
    }

    isAvailable() {
        if (this._clusters.length < this.maxClusterPerAccount)
            return true;
        else if (this._clusters.length <= this.maxClusterPerAccount)
            return $lodash.some(this._clusters, (cluster) => {
                return cluster.isAvailable();
            });
        return false;
    }

    newDriver(callback, args) {
        callback.filename = $getCallerFile(4);
        let cluster = $lodash.find(this._clusters, (cluster) => cluster.isAvailable());
        if (!cluster) {
            cluster = new Cluster(this);
            var self = this;
            this._clusters.push(cluster);
            cluster.onClose(() => {
                $lodash.pull(self._clusters, cluster);
            });
        }

        return cluster.newDriver(callback, args);
    }

    disable() {
        this.isDisable = true;
        var self = this;
        $util.setTimeout(10 * 60 * 1000)
            .then(() => {
                self.isDisable = false;
            });
    }

    toJSON() {
        var data = super.toJSON();
        data.billAmount = this._machine.getBillAmount();
        return data;
    }

    close() {
        if (this._clusters.length > 0)
            return Promise.allSettled($lodash.map(this._clusters, (cluster) => cluster.close()));
        return Promise.resolve();
    }
}

module.exports.Error = require('./error');