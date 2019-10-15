/*
 * Copyright 2018 Allanic.me ISC License License
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 * Created by mallanic <maxime@allanic.me> at 30/11/2018
 */

module.exports = class Container {
    constructor (container) {
        this._container = container;
    }

    close() {
        return this._container.close();
    }
};