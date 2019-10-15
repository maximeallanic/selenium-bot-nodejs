#!/usr/bin/env node

/*
 * Copyright 2019 Allanic.me ISC License License
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 * Created by mallanic <maxime@allanic.me> at 18/01/2019
 */


const $process = require('process');
const $service = require('../../service');

$service.add('$cwd', __dirname);
const $log = $service.get('$log');

eval('var fn = ' + $process.env.callback);

var $event = $service.get('$event');
$event.on((eventName, ...args) => {
    $process.send({
        name: eventName,
        data: args
    });
});
/*$process.on('message', (message) => {
    $event.emit(message.name, ...message.data);
});*/

try {
    Promise.parse($service.invoke(fn, null, $process.env))
        .then(() => {
            $process.exit();
        }, (error) => {
            $log.error(error)
                .finally(() => {
                    $process.exit(1);
                });
        });
} catch (error) {
    $log.error(error);
}