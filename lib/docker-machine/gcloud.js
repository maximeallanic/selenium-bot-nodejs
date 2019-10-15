/*
 * Copyright 2018 Allanic.me ISC License License
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 * Created by mallanic <maxime@allanic.me> at 15/10/2018
 */

const $compute = require('@google-cloud/compute');
const $lodash = require('lodash');

var defaultFirewallName = 'default-firewall-chrome';
module.exports = class GCloudMachine {
    constructor (options) {
        this.compute = new $compute({
            projectId: options.project_id,
            credentials: options
        });
        var self = this;
        this.options = options;
        this.vms = {};

        this.compute.firewall(defaultFirewallName)
            .exists()
            .then((response) => {
                var exist = response[ 0 ];
                if (!exist) {
                    return self.compute.createFirewall(defaultFirewallName, {
                        protocols: {
                            tcp: [ 4444, 2375, 22 ],
                            udp: [ 4444, 2375, 22 ]
                        },
                        ranges: [
                            '51.15.15.198',
                            '2.3.72.160'
                        ]
                    });
                }
            })
            .catch(() => {});
    }

    create(name, options) {
        options = $lodash.defaults(options, {
            os: 'debian',
            machineType: 'g1-small',
            zone: 'europe-west1-b',
            http: true,
            metadata: {
                items: [
                    {
                        key: 'startup-script',
                        value: `
                            #!/bin/bash
                            apt-get remove docker docker-engine docker.io
                            apt-get update
                            apt-get install -y apt-transport-https ca-certificates curl gnupg2 software-properties-common
                            curl -fsSL https://download.docker.com/linux/debian/gpg | sudo apt-key add -
                            apt-key fingerprint 0EBFCD88
                            add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/debian $(lsb_release -cs) stable"

                            apt-get update
                            apt-get install -y docker-ce

                            service docker stop

                            dockerd --host tcp://0.0.0.0:2375 &
                        `
                    }
                ],
            },
            tags: [ defaultFirewallName ]
        });

        var self = this;

        var zone = this.compute.zone(options.zone);
        return zone.createVM(name, options)
            .then((data) => {
                // `operation` lets you check the status of long-running tasks.
                var vm = data[ 0 ];
                self.vms[ name ] = vm;
                var operation = data[ 1 ];
                return operation.promise();
            })
            .then(() => {
                return self.vms[ name ].waitFor('RUNNING')
                    .then(() => {
                        return self.vms[ name ].getMetadata();
                    })
                    .then((metadata) => {
                        return {
                            name: name,
                            ip: metadata[ 0 ].networkInterfaces[ 0 ].accessConfigs[ 0 ].natIP,
                            localIp: metadata[ 0 ].networkInterfaces[ 0 ].networkIP
                        };
                    });
            });
    }

    rm(name) {
        var self = this;
        if (!self.vms[ name ])
            return Promise.reject(`${ name } doesn't exist`);
        return self.vms[ name ].delete()
            .then(() => {
                return self.vms[ name ].waitFor('TERMINATED');
            });
    }

    delete(instance) {
        return instance.delete().then(() => {
          return instance.waitFor("TERMINATED");
        });
    }

    list() {
        var vms = [];
        return this.compute.getVMs().then(vms => {
            return Promise.all(
              $lodash.map(vms, vm => {
                return Promise.all($lodash.map(vm, instance => {
                    return instance.getMetadata().then(result => {
                        if (result[ 0 ].status !== "TERMINATED" &&
                            result[ 0 ].status !== "SUSPENDED")
                            vms.push(instance);
                    });
                  })
                );
              })
            );
          })
          .then(() => {
              return vms;
          });
    }

    /*
    loadBillAmount() {
        console.log('load bill');
        let jwtClient = new JWT(
            this.options.client_email,
            null,
            this.options.private_key,
            [ "https://www.googleapis.com/auth/cloud-platform",
                "https://www.googleapis.com/auth/cloud-billing",
                "https://www.googleapis.com/auth/cloud-billing.readonly" ]);
        //authenticate request
        jwtClient.request({
            url: `https://cloudbilling.googleapis.com/v1/projects/${ this.options.project_id }/billingInfo`
        })
            .then((result) => {
                console.log(result.data, `https://cloudbilling.googleapis.com/v1/${ result.data.billingAccountName }`);

                return jwtClient.request({
                    url: `https://cloudbilling.googleapis.com/v1/${ result.data.billingAccountName }`
                })
            })
            .then((result) => {
                console.log(result);
            }, console.error);
        return;
        var self = this;
        jwtClient.authorize(function (err, tokens) {
            if (err) {
                console.log(err);
                return;
            } else {
                var t = new $google.cloudbilling_v1.Cloudbilling();
                t.projects.getBillingInfo({
                    authClient: jwtClient,
                    name: `projects/${self.options.project_id }`,
                    page_size: 100000
                }).then((result) => {
                    console.log(result);
                }, console.error);
            }
        });


    }*/
    getBillAmount() {
        return 0;
    }
}