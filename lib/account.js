/*
 * Copyright 2018 Allanic.me ISC License License
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 * Created by mallanic <maxime@allanic.me> at 14/10/2018
 */

const $lodash = require('lodash');
const Moment = require('moment');
const Cluster = require('./cluster');
const Machine = require('./docker-machine');
const $log = require('../../log');
const $util = require('../../util');
const { Entity } = require('../../entity');
const { Platform } = require('../../repository/platform');
const { Listener } = require('../../repository/Listener');
const { type } = require('../../entity/decorator');

module.exports = class Account extends Entity {
    constructor ($database, data) {
        super($database, data, {
            id: {
                type: Number
            },
            customParams: {
                type: JSON
            },
            driver: {
                type: String
            },
            deletedAt: {
                type: Moment
            },
            maxClusterPerAccount: {
                type: Number
            },
            maxDriverPerContainer: {
                type: Number
            },
            email: {
                type: String
            },
            subscriptionEnd: {
                type: Moment
            }
        });

        this._clusters = [];

        this._machine = new Machine(this.driver, this.customParams);

        this.log = $log.newGroup({
            project: this.customParams ? this.customParams.project_id : '-1'
        });
    }

    getClusters() {
        return this._clusters;
    }

    isAvailable() {
        if (this.isDisable)
            return false;
        else if (this.deletedAt)
            return false;
        else if (this._clusters.length < this.maxClusterPerAccount)
            return true;
        else if (this._clusters.length <= this.maxClusterPerAccount)
            return $lodash.some(this._clusters, (cluster) => {
                return cluster.isAvailable();
            });
        return false;
    }

    newDriver(callback, args, prefixName) {
        let cluster = $lodash.find(this._clusters, (cluster) => cluster.isAvailable());
        if (!cluster) {
            cluster = new Cluster(this, this._options, this._event, this._error, this.log);
            var self = this;
            this._clusters.push(cluster);
            cluster.onClose(() => {
                $lodash.pull(self._clusters, cluster);
            });
        }

        return cluster.newDriver(callback, args, prefixName);
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