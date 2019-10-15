/*
 * Copyright 2018 Allanic.me ISC License License
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 * Created by mallanic <maxime@allanic.me> at 30/11/2018
 */

const $lodash = require('lodash');
const $waitPort = require('wait-port');
const $util = require('../util');
const { Docker } = require('node-docker-api');
const { HiddenError } = require('../../../lib/error');

const Container = require('./container');

var promisifyStream = (stream) => new Promise((resolve, reject) => {
    stream.on('data', (d) => { });
    stream.on('end', resolve)
    stream.on('error', reject)
});

module.exports = class Cluster {
    constructor (data) {
        this._data = data;
        this._containers = [];
        this._isClosed = false;

        var config = {};
        if (this.getIP()) {
            config.host = this.getIP();
            config.port = self.port;
        }
        else {
            config.socketPath = '/var/run/docker.sock';
        }
        this._docker = new Docker(config);
    }

    getIP() {
        return this._data.ip;
    }

    create() {
        var self = this;
        if (self._isClosed)
            return Promise.resolve();

        self.log('pull docker image');
        // Wait docker pull image
        var splitted = options.container.Image.split(':');
        var containerConfig = {
            fromImage: splitted[ 0 ],
            tag: splitted[ 1 ] || 'latest'
        };
        return self.docker.image.create({}, containerConfig)
            .then((stream) => {
                if (self._isClosed)
                    return Promise.resolve();
                return promisifyStream(stream)
            })
            .then(() => {
                if (self._isClosed)
                    return Promise.resolve();
                return self.docker.image.get(options.container.Image).status();
            })
            .then(() => {
                if (self._isClosed)
                    return Promise.resolve();
                return self.cluster.account.manager.getAvailableVPN();
            })
            .then((vpn) => {
                if (self._isClosed)
                    return Promise.resolve();
                self.log('create container');

                var config = $lodash.extend({
                    name: $util.uuid()
                }, $lodash.cloneDeep(options.container));

                if (vpn) {
                    vpn.addContainer(self);
                    config[ 'Env' ].push('VPN_CONFIG=' + vpn.getConfig());
                    config[ 'Env' ].push('VPN_AUTH_USER=' + vpn.getUser());
                    config[ 'Env' ].push('VPN_AUTH_PASSWORD=' + vpn.getPassword());
                }

                // Create Docker container
                return self.docker.container.create(config)
                    .then((container) => {
                        if (self._isClosed)
                            return Promise.resolve();
                        self.container = container;
                        return container.start();
                    })
                    .then(() => {
                        return self.container.status();
                    })
                    .then((container) => {
                        container = new Container(container);
                        self.containers.push(container);
                        if (self._isClosed)
                            return Promise.resolve();
                        return self.checkAvailability(30000);
                    })
                    .then(() => {
                        (function checkAvailability() {
                            self.checkAvailability()
                                .then(() => $util.setTimeout(30000))
                                .then(() => checkAvailability());
                        })();
                        self.log('container started');
                        return self.container;
                    });
            });
    }

    checkAvailability(timeout) {
        if (this._isClosed)
            return Promise.reject(new HiddenError('is closed'));

        if (this.getIP())
            return $waitPort({
                host: this.getIP(),
                port: 2375,
                timeout: timeout || 10000,
                output: 'silent'
            })
                .then((open) => {
                    if (!open) {
                        return Promise.reject('cluster not opened');
                    }
                });
        return Promise.resolve();
    }
}