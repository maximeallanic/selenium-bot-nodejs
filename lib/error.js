/*
 * Copyright 2019 Allanic.me ISC License License
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 * Created by mallanic <maxime@allanic.me> at 14/02/2019
 */

module.exports.InstanceError = class extends Error {
    constructor (error, dockerMachineAccount) {
        super();
        this.name = error.name;
        this.code = error.code;
        this.message = error.message;
        this.stack = error.stack;
        this.dockerMachineAccount = dockerMachineAccount
    }
};
module.exports.SessionError = class extends module.exports.InstanceError {
    constructor (error, picture, source, ip, vpn, session, dockerMachineAccount) {
        super(error, dockerMachineAccount);
        this.picture = picture;
        this.vpn = vpn;
        this.session = session;
        this.source = source;
        this.ip = ip;
    }
};

module.exports.HiddenError = class extends Error {

};