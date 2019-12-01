/*
 * Copyright 2019 Allanic.me ISC License License
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 * Created by mallanic <maxime@allanic.me> at 18/04/2019
 */

const $lodash = require('lodash');
const $aws = require("aws-sdk");
const $util = require('../util');

var defaultFirewallName = 'default-firewall-chrome';

module.exports = class AWSMachine {
    constructor (options) {
        options = $lodash.defaults(options, {
          apiVersion: "2016-11-15",
          region: "eu-west-1"
        });
        this.ec2 = new $aws.EC2(options);
        this.groups = {};
        this.instances = {};
    }

    createSecurityGroupIfNotExist(name, options) {
        var self = this;
        var promise;
        if (!self.groups[ name ])
            promise = Promise.parse(this.ec2.describeSecurityGroups({
                GroupNames: [ name ]
            }).promise())
              .then((data) => {
                self.groups[name] =
                    data.SecurityGroups[ 0 ].GroupId;

                return $util.getIP()
                      .then((publicIp) => {
                        var isExist = $lodash.some(data.SecurityGroups[ 0 ].IpPermissions, (IpPermission) => {
                            return $lodash.some(IpPermission.IpRanges, (IpRange) => {
                                return IpRange.CidrIp === publicIp + '/32';
                            });
                        });
                        if (isExist)
                            return self.groups[ name ];
                        return self.ec2.authorizeSecurityGroupIngress({
                            GroupId: data.SecurityGroups[ 0 ].GroupId,
                            IpPermissions: [
                                {
                                    FromPort: 4444,
                                    IpProtocol: 'tcp',
                                    IpRanges: [ {
                                        CidrIp: publicIp + '/32'
                                    }],
                                    ToPort: 4444
                                },
                                {
                                    FromPort: 2375,
                                    IpProtocol: 'tcp',
                                    IpRanges: [ {
                                        CidrIp: publicIp + '/32'
                                    }],
                                    ToPort: 2375
                                }
                            ]
                        }).promise()
                      })
                      .then(() => {
                        return self.groups[ name ];
                      })
                }, () => {
                    return Promise.parse(self.ec2.createSecurityGroup({
                        GroupName: 'main',
                        Description: 'Default security group'
                    }).promise())
                        .then((data) => {
                            self.groups[ name ] = data.GroupId;
                        })
                        .then(() => {
                            var params = {
                              GroupId:
                                self.groups[name],
                              IpPermissions: [
                                {
                                  FromPort: 2375,
                                  IpProtocol: "tcp",
                                  IpRanges: [
                                    {
                                      CidrIp:
                                        "51.15.15.198/32",
                                      Description:
                                        "Open Docker Port"
                                    }
                                  ],
                                  ToPort: 2375
                                },
                                {
                                  FromPort: 4444,
                                  IpProtocol: "tcp",
                                  IpRanges: [
                                    {
                                      CidrIp:
                                        "51.15.15.198/32",
                                      Description:
                                        "Open Docker Port"
                                    }
                                  ],
                                  ToPort: 4444
                                }
                              ]
                            };
                            return self.ec2.authorizeSecurityGroupIngress(params).promise();
                        })
                        .then(() => {
                            return self.groups[ name ];
                        })
                })
        else
            promise = Promise.resolve(self.groups[ name ]);

        return promise;

    }

    create(name, options) {
        options = $lodash.defaults(options, {
          ImageId: "ami-07a46bae20778bcf8",
          InstanceType: "t2.micro",
          MinCount: 1,
          MaxCount: 1
        });

        var self = this;

        return this.createSecurityGroupIfNotExist('main', {
            2375: '0.0.0.0'
        })
            .then(function (groupId) {
                options.SecurityGroupIds = [ groupId ];
                return self.ec2.runInstances(options).promise();
            })
            .then((data) => {
                self.instances[name] = data.Instances[ 0 ];
                return self.waitStatus(self.instances[name].InstanceId, 'running');
            })
            .then(() => {
                return self.ec2.describeInstances({
                    InstanceIds: [self.instances[name].InstanceId]
                }).promise();
            })
            .then((data) => {

                self.instances[name] = data.Reservations[ 0 ].Instances[ 0 ];
                return {
                  name: self.instances[name].InstanceId,
                  ip:
                    self.instances[name].PublicIpAddress,
                  localIp:
                    self.instances[name].PublicIpAddress
                };
            });
    }

    waitStatus(ec2, status) {
        var self = this;

        return Promise.parse(this.ec2.describeInstanceStatus({
            InstanceIds: [ec2]
        }).promise())
            .then((data) => {

                if (data.InstanceStatuses[ 0 ]
                    && data.InstanceStatuses[ 0 ].InstanceState
                    && data.InstanceStatuses[ 0 ].InstanceState.Name
                    && data.InstanceStatuses[ 0 ].InstanceState.Name === status)
                        return Promise.resolve();
                return $util.setTimeout(10000)
                    .then(() => {
                        return self.waitStatus(ec2, status);
                    })
            })
    }

    delete(instance) {
       return Promise.parse(
         this.ec2
           .terminateInstances({
             InstanceIds: [instance.InstanceId]
           })
           .promise()
       );
    }

    rm(name) {
        var self = this;

        var instanceId = self.instances[ name ].InstanceId;

         return Promise.parse(self.ec2
           .terminateInstances({
             InstanceIds: [instanceId]
           })
           .promise());
    }

    list() {
        var vms = [];
        return this.ec2.describeInstances({
            Filters: [
                {
                    Name: "instance-state-name",
                    Values: [
                        'running',
                        'pending'
                    ]
                }
            ]
        })
        .promise()
        .then((data) => {
            $lodash.forEach(data.Reservations, (reservation) => {
                $lodash.forEach(reservation.Instances, (Instance) => {
                    vms.push(Instance);
                });
            });
            return vms;
        });
    }

    getBillAmount() {
        return 0;
    }
}