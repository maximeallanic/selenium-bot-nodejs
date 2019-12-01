/*
 * Copyright 2018 Allanic.me ISC License License
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 * Created by mallanic <maxime@allanic.me> at 04/07/2018
 */

const $lodash = require('lodash');
const $util = require('./util');
const $fs = require('fs');
const { Builder, WebDriver, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const { HiddenError } = require('./error');

const { EventClose } = require('./event-close');

const DEFAULT_TIMEOUT = 10000;

module.exports = class extends EventClose {
    constructor (logger) {
        super();
        let options = new chrome.Options();
        options = options.addArguments('always-authorize-plugins')
            .addArguments('allow-outdated-plugins')
            .addArguments('autoplay-policy=no-user-gesture-required')
            .addArguments('disable-session-crashed-bubble')
            .addArguments('no-user-gesture-required')
            .addArguments('enable-plugins')
            //.addArguments('disable-gpu')
            .addArguments('disable-infobars')
            //.addArguments('disable-dev-shm-usage')
            .addArguments('allow-running-insecure-content')
            //.addArguments('new-window')
            .addArguments('start-fullscreen')
            //.addArguments('dump-dom')
            //.addArguments("--window-size=1366,968")
            //.addArguments("no-sandbox")
            .addArguments("user-data-dir=/tmp/" + $util.uuid())
            .setUserPreferences({
                //"profile.default_content_setting_values.plugins": 1,
                //"profile.content_settings.plugin_whitelist.adobe-flash-player": 1,
                //"profile.content_settings.exceptions.plugins.*,*.per_resource.adobe-flash-player": 1,
                //"credentials_enable_service": false,
                //"profile.password_manager_enabled": false
            });

        this.driver = new Builder();
        this.id = $lodash.uniqueId();
        this.driver
            .forBrowser('chrome')
            .setChromeOptions(options);

        this.log = logger;

        this.log.info('configuration');
    }

    start(ip, port) {
        this.log.info('connect');
        if (!port)
            port = 4444;
        if (ip && ip !== 'localhost')
            this.driver.usingServer(`http://${ ip }:${ port }/wd/hub`);

        var self = this;

        try {
            this.log.info('build');
            self.driver = self.driver.build();
            this.log.info('wait');
            return $util.getTimeoutPromise(self.driver, 40000)
                .catch((error) => {
                    return self.close(true)
                        .finally(() => Promise.reject(error));
                });
        } catch (e) {
            return Promise.reject(e);
        }
    }

    takeScreenshot() {
        var self = this;
        if (this.isClosed())
            return Promise.reject(new HiddenError('web driver closed'));
        return Promise.parse(self.driver.takeScreenshot());
    }

    logScreenshot() {
        console.log('log');
        var filename = $util.uuid() + ".png";
        var self = this;
        console.log('log1');
        var basePath = "/tmp/screenshot-selenium/";
        console.log('log2');
        var promise = Promise.resolve();
        console.log('log3');
        if (!$fs.existsSync(basePath))
            promise = $util.mkdir(basePath, { recursive: true });
            console.log('log4');
        return promise
            .then(() => {
                console.log('tak');
                return self.takeScreenshot();
            })
            .then((base64Data) => {
                console.log('write');
                return $util.writeFile(basePath + filename, base64Data, 'base64');
            })
            .then(() => {
                console.log('t');
                console.log(basePath + filename);
            })
            .catch(console.error);
    }

    get(url) {
        return $util.getTimeoutPromise(this.driver.get(url), 40000, `timeout when fetch ${ url }`);
    }

    _close() {
        try {
            if (this.driver && $lodash.isFunction(this.driver.quit))
                this.driver.quit().catch((e) => { });
            return Promise.resolve();
        } catch (e) {
            return Promise.reject(e);
        }
    }

    addCookies(domain, cookies) {
        var self = this;
        return self.get(domain).then(() => {
            self.log.info('page loaded');
            if (cookies.length <= 0)
                return;
            return Promise.all($lodash.map(cookies, (cookie) => {
                cookie = $lodash.defaults(cookie, {
                    path: '/',
                    secure: true,
                    httpOnly: false
                });
                return $util.getTimeoutPromise(self.manage().addCookie(cookie), DEFAULT_TIMEOUT);
            }));
        });
    }

    waitAndFindElement(selector, timeout) {
        var self = this;
        return $util.getTimeoutPromise(self.wait(until.elementLocated(selector)), timeout || DEFAULT_TIMEOUT)
            .then(function () {
                return $util.getTimeoutPromise(self.findElement(selector), DEFAULT_TIMEOUT);
            });
    }

    waitAndFindElements(selector, timeout) {
        var self = this;
        return $util.getTimeoutPromise(self.wait(until.elementLocated(selector)), timeout || DEFAULT_TIMEOUT)
            .then(function () {
                return $util.getTimeoutPromise(self.findElements(selector), DEFAULT_TIMEOUT);
            });
    }

    waitFindAndVisibleElement(selector, timeout) {
        var self = this;
        return this.waitAndFindElement(selector)
            .then((element) => {
                return $util.getTimeoutPromise(self.wait(until.elementIsVisible(element)), timeout || DEFAULT_TIMEOUT);
            })
            .then(() => {
                return $util.getTimeoutPromise(self.findElement(selector), DEFAULT_TIMEOUT);
            });
    }

    waitElementEnable(selector, timeout) {
        var self = this;

        return self.waitAndFindElement(selector, (timeout || DEFAULT_TIMEOUT) / 2)
            .then((element) => {
                return $util.getTimeoutPromise(self.wait(until.elementIsEnabled(element)), (timeout || DEFAULT_TIMEOUT) / 2);
            });
    }

    waitFindAndEnableElement(selector, timeout) {
        var self = this;
        return this.waitAndFindElement(selector, (timeout || DEFAULT_TIMEOUT) / 2)
            .then(function (element) {
                return self.waitElementEnable(selector, (timeout || DEFAULT_TIMEOUT) / 2)
                    .then(() => {
                        return element;
                    });
            });
    }

    waitFindGetTextElement(selector, timeout) {
        return this.waitAndFindElement(selector, timeout)
            .then(function (element) {
                return $util.getTimeoutPromise(element.getText(), DEFAULT_TIMEOUT);
            });
    }

    waitClickElement(selector, timeout) {
        var self = this;
        return this.waitFindAndEnableElement(selector, timeout)
            .then(function () {
                self.log.info('click');
                return $util.getTimeoutPromise(self.driver.findElement(selector).click(), DEFAULT_TIMEOUT);
            });
    }

    waitSendKeysElement(selector, text, timeout) {
        return this.waitFindAndEnableElement(selector, timeout)
            .then(function (element) {
                return $util.getTimeoutPromise(element.sendKeys(text), DEFAULT_TIMEOUT);
            });

    }

    waitClearElement(selector, timeout) {
        return this.waitFindAndEnableElement(selector, timeout)
            .then(function (element) {
                return $util.getTimeoutPromise(element.clear(), DEFAULT_TIMEOUT);
            });;

    }

    waitDebounce(callback, maxTimeout) {
        var self = this;

        var e = new Error('max timeout');
        var p = (function wait() {
            return $util.setTimeout(1000)
                .then(() => {
                    return Promise.parse(callback(self));
                })
                .then((result) => {
                    self.log.info(result);
                    if (!result) {
                        maxTimeout -= 1000;
                        if (maxTimeout <= 0)
                            return Promise.reject(e);
                        return wait();
                    }
                    return Promise.resolve();
                }, (e) => {
                    maxTimeout -= 1000;
                    if (maxTimeout <= 0) {
                        return Promise.reject(e);
                    }

                    return wait();
                });
        })();
        return $util.getTimeoutPromise(p, maxTimeout, 'max timeout');
    }

    enableFlashPlayer() {
        var self = this;
        return self.driver.get('chrome://settings/content/flash')
            .then(() => {
                return self.driver.wait(until.elementLocated(By.css('settings-ui /deep/ site-list:last-child /deep/ #addSite')), 20000);
            })
            .then(() => {
                return self.driver.findElement(By.css('settings-ui /deep/ site-list:last-child /deep/ #addSite')).click();
            })
            .then(() => {
                return self.driver.findElement(By.css('settings-ui /deep/ add-site-dialog /deep/ input')).sendKeys('https://*');
            })
            .then(() => {
                return self.driver.findElement(By.css('settings-ui /deep/ add-site-dialog /deep/ #add.action-button')).click();
            })
            .then(() => {
                return self.driver.get('chrome://components');
            })
            .then(() => {
                return self.driver.findElement(By.xpath("//span[text()='Adobe Flash Player']/parent::*/parent::*/parent::*/parent::*//button[contains(@class, 'button-check-update')]")).click();
            })
            .then(() => {
                return self.driver.sleep(1000);
            });
    }

    try(callback, numberOfRetries) {
        var self = this;
        return Promise.parse(callback())
            .fail((e) => {
                if (numberOfRetries > 0)
                    return self.try(callback, --numberOfRetries);
                return Promise.reject(e);
            });
    }
};

// Inherit method inside previous class
$lodash.forEach(Object.getOwnPropertyNames(WebDriver.prototype), (name) => {
    if (!module.exports.prototype[ name ])
        module.exports.prototype[ name ] = function () {
            if (this.isClosed())
                throw new HiddenError('web driver closed');

            var self = this;
            var result;
            try {
                result = WebDriver.prototype[ name ].apply(this.driver, arguments);
            } catch (e) {
                self.log.error(e);
                result = false;
            }
            if (Promise.isPromiseLike(result)) {
                var callback = (error) => {
                    //self.log.info(error);
                    if (error && error.message && error.message.match(/(E[A-Z]+|No\sactive\ssession\swith)/)) {
                        self.close(true);
                        error = new HiddenError(error.message);
                    }
                };

                if ($lodash.isFunction(result.fail))
                    result.fail(callback);
                else
                    result.catch(callback);
            }
            return result;
        };
});
