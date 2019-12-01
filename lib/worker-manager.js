#!/usr/bin/env node

/*
 * Copyright 2019 Allanic.me ISC License License
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 * Created by mallanic <maxime@allanic.me> at 18/01/2019
 */


const $process = require('process');
const $service = require('./service');
const $logger = require('@nivuus/logger');
const $lodash = require('lodash');
const Driver = require('./driver');
const $vm = require('vm');
const $path = require('path');
const Module = require('module');

var mod = new Module($process.env.filename, module);
var dirname = $path.dirname($process.env.filename);

mod.filename = $process.env.filename;
mod.paths = Module._nodeModulePaths(dirname);

mod._compile($process.env.callback, $process.env.filename);
mod.loaded = true;

var script = $vm.createScript($process.env.callback, $process.env.filename);
var context = $vm.createContext({
    __filename: $process.env.filename,
    __dirname: dirname,
    console: $logger,
    exports: exports,
    require: function (path) {
        return mod.require(path);
    },
    module: mod,
    process: $process
});
var fn = script.runInNewContext(context);

/*$event.on((eventName, ...args) => {
    $process.send({
        name: eventName,
        data: args
    });
});
$process.on('message', (message) => {
    //$event.emit(message.name, ...message.data);
});*/

try {
    var driver = new Driver($logger);
    Promise.parse($service.invoke(fn, null, $lodash.extend({
        driver: driver
    }, $process.env)))
        .then(() => {
            $process.exit();
        }, async (error) => {
            $process.exit(1);
        });
} catch (e) {
    $logger.error(error)
        .then(() => $process.exit(1));
}