/*
 * Copyright 2018 Allanic.me ISC License License
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 * Created by mallanic <maxime@allanic.me> at 30/11/2018
 */

module.exports = class LocalMachine {
    constructor (options) {
        this.vms = {};
    }

    create(name) {
        return Promise.resolve({
          name: name,
          ip: "18.203.156.42",
          localIp: "18.203.156.42"
        });
    }

    rm() {
        return Promise.resolve();
    }

    getBillAmount() {
        return 0;
    }
}