/*
 * Copyright 2018 Allanic.me ISC License License
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 * Created by mallanic <maxime@allanic.me> at 14/10/2018
 */

const $lodash = require('lodash');

const $event = require('../../event');
const Account = require('./account');
const { EntityManager } = require('../../entity');
const { HiddenError } = require('../../error');

const $config = require('../../config');

$config.setDefault({
    maxContainerPerCluster: 1,
    maxDriverPerContainer: 3,
    maxContainerPerVPN: 5,
    debug: false
});
$config.set({
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
});

module.exports.DockerMachineAccountRepository = class AccountManager extends EntityManager {
    constructor (_database, Entity) {
        super(_database, Entity);

        this.watchList();
    }

    isAvailable() {
        return $lodash.some(this._entities, (account) => account.isAvailable());
    }

    newDriver(callback, args, prefixName) {
        let account = $lodash.find(this._entities, (account) => account.isAvailable());
        if (!account) {
            return Promise.reject(new HiddenError('no account is available'));
        }
        return account.newDriver(callback, args, prefixName);
    }

    close() {
        if (this._entities.length > 0)
            return Promise.allSettled($lodash.map(this._entities, (account) => account.close()));
        return Promise.resolve();
    }

    newMusicSession(session) {
        return this.newDriver(`${ session.type } ${ session.id }`);
    }
}

module.exports.DockerMachineAccount = Account;
/**
module.exports = ($config, $vpn, $event, $database, $log, $error) => {

    var $manager = new AccountManager($config, $vpn, $event, $database, $log, $error);
    $event.on('close', () => {
        return $manager.close();
    });
    return $manager;
}*/