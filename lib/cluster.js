/*
 * Copyright 2018 Allanic.me ISC License License
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 * Created by mallanic <maxime@allanic.me> at 14/10/2018
 */

const $lodash = require('lodash');
const Container = require('./container');
const $waitPort = require('wait-port');
const $util = require('./util');
const $logger = require('@nivuus/logger');
const { EventClose } = require('./event-close');
const { InstanceError } = require('./error');


module.exports = class Cluster extends EventClose {
    constructor (account) {
        super();
        this._account = account;
        this._options = {
            maxContainerPerCluster: 1,
            maxDriverPerContainer: 3,
            maxContainerPerVPN: 5,
            debug: false,
            container: {
                Image: "maximeallanic/chrome:latest",
                Env: [
                    "SE_OPTS=-timeout 180000 -browserTimeout 0",
                    "JAVA_OPTS=-Xmx256m",
                    "SCREEN_WIDTH=1366",
                    "SCREEN_HEIGHT=768",
                    "SCREEN_DEPTH=24",
                    "NODE_MAX_INSTANCES=3",
                    "NODE_MAX_SESSION=3"
                ],
                HostConfig: {
                    //Privileged: true,
                    MemorySwap: -1,
                    ShmSize: 536870912,
                    PortBindings: {
                        "4444/tcp": [
                            {
                                HostPort: "4444"
                            }
                        ]
                    },
                    //Dns: ["8.8.8.8", "8.8.4.4"]
                }
            }
        };
        this.containers = [];

        var self = this;

        this.name = 'chrome-' + $util.uuid();

        this.onLoaded = Promise.parse(this._account._machine.create(this.name, this._options.cluster))
            .then((cluster) => {
                self.cluster = cluster;
            })
            .then(() => {
                if (!self.isClosed())
                    return self.checkAvailability(5 * 60000);
            })
            .then(() => {
                if (!self.isClosed())
                    (function checkAvailability() {
                        if (self.isClosed())
                            return;
                        self.checkAvailability(3000)
                            .then(() => $util.setTimeout(30000))
                            .then(() => checkAvailability())
                            .fail(() => {
                                self.close();
                            });
                    })();
            })
            .fail((error) => {
                try {
                    error = new InstanceError(error, self._account.id);
                } catch (e) {
                    console.error(e);
                    process.exit();
                }
                self._account.disable();
                if (!self.isClosed())
                    self.close();
                return Promise.reject(error);
            });
    }

    checkAvailability(timeout) {
        var self = this;
        var timeoutUsed = 0;
        if (this.getIP() && this.getIP() !== '0.0.0.0')
            return (function wait() {
                return Promise.parse($waitPort({
                    host: self.getIP(),
                    port: 2375,
                    timeout: 1000,
                    output: 'silent'
                }))
                    .then((open) => {
                        if (self.isClosed())
                            return Promise.resolve('cluster is closed');
                        timeoutUsed += 1000;
                        //console.log(self.getIP(), self.containers[ 0 ].drivers.length);
                        if (!open && (!timeout || timeoutUsed >= timeout)) {
                            return Promise.reject(new HiddenError('cluster ports not opened'));
                        }
                        else if (!open)
                            return wait();
                        return Promise.resolve();
                    })
            })();

        return Promise.resolve();
    }

    getDockerMachineOptions() {
        return $lodash.defaults(JSON.parse(this._options.customParams), {
            driver: this._options.driver
        });
    }

    getContainers() {
        return this.containers;
    }

    isAvailable() {
        if (this.isClosed())
            return false;
        else if (this.containers.length < this._options.maxContainerPerCluster)
            return true;
        else if (this.containers.length <= this._options.maxContainerPerCluster)
            return $lodash.some(this.containers, (container) => {
                return container.isAvailable();
            });
        return false;
    }

    getLocalIP() {
        if (this.cluster)
            return this.cluster.localIp;
        return '';
    }

    getIP() {
        if (this.cluster)
            return this.cluster.ip;
        return '';
    }

    newDriver(callback, args, prefixName) {
        var self = this;
        let container = $lodash.find(this.containers, (container) => container.isAvailable());
        if (!container) {
            container = new Container(this, this._options);
            this.containers.push(container);
            container.onClose(() => {
                $lodash.pull(self.containers, container);

                if (self.containers.length <= 0)
                    return self.close();
            });
        }
        return container.newDriver(callback, args, prefixName);
    }

    _beforeClose() {
        if (this.containers.length > 0)
            return Promise.allSettled($lodash.map(this.containers, (container) => container.close()));
    }

    _close() {
        var self = this;

        if (this.cluster) {
            $logger.log('closing cluster');
            return Promise.parse(this._account._machine.rm(this.name))
                .fail((error) => {
                    self._error.new({
                        message: error.stack,
                    }).$save();
                    return Promise.reject(error);
                })
                .finally(() => {
                    $logger.log('cluster closed');
                });
        }
    }
}