/*
 * Copyright 2018 Allanic.me ISC License License
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 * Created by mallanic <maxime@allanic.me> at 03/12/2018
 */

const $lodash = require('lodash');
const $getFunctionArguments = require('get-function-arguments');


var services = {};
var $service = services['$service'] = module.exports = {
    add: (name, value) => {
        services[ name ] = value;
    },
    invoke: (method, thisArg, additionalService) => {
        var args = $getFunctionArguments(method);
        args = $lodash.map(args, (arg) => {
            if ($lodash.isObject(additionalService) && $lodash.has(additionalService, arg))
                return additionalService[ arg ];
            return $service.get(arg);
        });
        return method.apply(thisArg, args);
    },
    get: (serviceName) => {
        if (!services[ serviceName ]) {
            var match = serviceName.match(/\$(.*)/);
            if (!match)
                throw new Error(`No service ${ serviceName } exist`);
            var service = require(`./${ match[1] }`);
            services[ serviceName ] = $service.invoke(service);
        }
        return services[ serviceName ];
    }
}