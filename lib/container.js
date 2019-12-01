/*
 * Copyright 2018 Allanic.me ISC License License
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 * Created by mallanic <maxime@allanic.me> at 14/10/2018
 */

const $lodash = require('lodash');
const $waitPort = require('wait-port');
const $util = require('./util');
const $request = require('request-promise');
const Worker = require('./worker');
const $logger = require('@nivuus/logger');
const { Docker } = require('node-docker-api');
const { EventClose } = require('./event-close');
const { HiddenError } = require('./error');

const promisifyStream = (stream, isClosed) => new Promise((resolve, reject) => {
    if (!stream)
        reject(new Error('no stream'));
    stream.on('data', (d) => {
        if (isClosed())
            reject(new HiddenError('cancel pulling'));
    });
    stream.on('end', resolve)
    stream.on('error', reject)
})

module.exports = class Container extends EventClose {
    constructor (cluster, options) {
        super();
        this.workers = [];
        this.cluster = cluster;
        this.options = options;

        var self = this;

        this.port = 2375;

        this.id = $lodash.uniqueId();


        this.onLoaded = cluster.onLoaded
            .then(() => {
                if (!self.isClosed()) {
                    // Initialize docker
                    var config = {};
                    if (cluster.getIP() && cluster.getIP() !== '0.0.0.0') {
                        config.host = cluster.getIP();
                        config.port = self.port;
                    }
                    else {
                        config.socketPath = '/var/run/docker.sock';
                    }
                    self.docker = new Docker(config);
                    $logger.log('pull docker image');3
                    // Wait docker pull image
                    var splitted = options.container.Image.split(':');
                    var containerConfig = {
                        fromImage: splitted[ 0 ],
                        tag: splitted[ 1 ] || 'latest'
                    };
                    return self.docker.image.create({}, containerConfig);
                }
            })
            .then((stream) => {
                if (!self.isClosed())
                    return promisifyStream(stream, () => {
                        return self.isClosed();
                    });


            })
            .then(() => {
                if (!self.isClosed())
                    return self.docker.image.get(options.container.Image).status();

            })
            .then(() => {
                if (!self.isClosed())
                    return self.cluster._account.vpns.getAvailable();
            })
            .then((vpn) => {
                if (!self.isClosed()) {
                    var config = $lodash.extend({
                        name: $util.uuid()
                    }, $lodash.cloneDeep(options.container));

                    if (vpn) {
                        vpn.addContainer(self);
                        config[ 'Env' ].push('VPN_CONFIG=' + vpn.getConfig());
                        config[ 'Env' ].push('VPN_AUTH_USER=' + vpn.getUser());
                        config[ 'Env' ].push('VPN_AUTH_PASSWORD=' + vpn.getPassword());
                        self._vpn = vpn;
                    }

                    $logger.log('create container');

                    // Create Docker container
                    return self.docker.container.create(config);
                }
            })
            .then((container) => {
                self.container = container;

                if (!self.isClosed()) {
                    $logger.log('container created');
                    return container.start();
                }
            })
            .then(() => {
                if (!self.isClosed())
                    return self.container.status();

            })
            .then((container) => {
                if (!self.isClosed()) {
                    self.container = container;

                    if (self.isClosed())
                        return Promise.reject(new HiddenError('container is closed'));

                    return self.checkAvailability(30000);
                }
            })
            .then(() => {
                if (!self.isClosed()) {
                    (function checkAvailability() {
                        if (self.isClosed())
                            return;
                        self.checkAvailability(3000)
                            .then(() => $util.setTimeout(30000))
                            .then(() => checkAvailability(3000))
                            .fail((error) => {
                                self.close();
                                return Promise.reject(error);
                            });
                    })();
                    $logger.log('container started');
                    return self.container;
                }
            })
            .fail((error) => {
                if (!self.isClosed())
                    self.close();
                return Promise.reject(error);
            });

    }

    getIP() {
        if (this.cluster.getIP())
            return this.cluster.getIP();
        return ;
    }

    checkAvailability(timeout) {
        var self = this;
        if (this.isClosed())
            return Promise.resolve();

        var timeoutUsed = 0;
        return (function wait() {
            if (self.isClosed())
                return Promise.resolve();
            return Promise.parse($waitPort({
                host: self.getIP(),
                port: 4444,
                timeout: 1000,
                output: 'silent'
            }))
                .then((open) => {
                    timeoutUsed += 1000;
                    //console.log(self.getIP(), self.containers[ 0 ].drivers.length);
                    if (!open && timeoutUsed >= timeout) {
                        return Promise.reject(new HiddenError('container is closing'));
                    }
                    else if (!open)
                        return wait();
                    return Promise.resolve();
                }, (e) => {
                    timeoutUsed += 1000;
                    if (timeoutUsed >= timeout)
                        return Promise.reject(e);
                    return $util
                      .setTimeout(1000)
                      .then(() => wait());
                })
        })()
            .then(() => {
                var retries = 0;
                return (function checkValidity() {
                    return $request(`http://${ self.getIP() }:4444/wd/hub/status`, {
                        json: true,
                        timeout: 2000
                    })
                        .then((result) => {
                            if (result.value && result.value.ready)
                                return;
                            return Promise.reject(new Error('not ready'));
                        })
                        .catch((e) => {
                            if (retries <= 40 && e.message.match(/(ECONNRESET|ESOCKETTIMEDOUT|socket\shang\sup)/)) {
                                retries++;
                                return $util.setTimeout(1000).then(() => checkValidity());
                            }
                            return Promise.reject(e);
                        });
                })();
            });
    }

    getWorkers() {
        return this.workers;
    }

    isAvailable() {
        if (this.isClosed())
            return false;
        return this.workers.length < this.cluster._account.maxDriverPerContainer;
    }

    newDriver(callback, args) {
        var self = this;
        var worker = new Worker(callback, args, this._event);
        this.workers.push(worker);

        return this.onLoaded.then(() => {
            if (self.isClosed())
                return Promise.reject(new HiddenError('container is closed'));

            return worker.start({
                clusterIp: self.getIP() || '0.0.0.0',
                containerId: self.id,
                vpn: self._vpn ? self._vpn.id : null,
                dockerMachineAccount: self.cluster._account.id
            }, args)
                .finally(function () {
                    $lodash.pull(self.workers, worker);

                    if (self.workers.length <= 0) {
                        return self.close();
                    }
                });
        });
    }

    isClosed() {
        return this.cluster.isClosed() || super.isClosed();
    }

    _beforeClose() {
        if (this.workers.length > 0)
            return Promise.allSettled($lodash.map(this.workers, (worker) => worker.close()));
    }

    _close() {
        var self = this;

        if (self.container) {
            $logger.log('stop container');
            return Promise.parse(self.container.stop())
                .finally(() => {
                    $logger.log('closing container');
                    return self.container.delete({ force: true });
                })
                .finally(() => {
                    $logger.log('container closed');
                });
        }
    }
}