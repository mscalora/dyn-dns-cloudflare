#!/usr/bin/env node
"use strict";

const public_ip = require('public-ip'),
    cf = require('cloudflare'),
    chalk = require('chalk'),
    fs = require('fs');

let configPath = '/etc/dyn-dns-cloudflare.json',
    config = {},
    args = {};

function fatal (msg) {
  process.stderr.write(msg + '\n');
  process.exit(1);
}

for (let arg of process.argv.slice(2)) {
  if (args.config === true) {
    configPath = arg;
    delete args.config;
  } else if (/^(-v|--v(e(r(b(o(s(e)?)?)?)?)?)?)$/.test(arg)) {
    args.verbose = true;
  } else if (/^(-c|--c(o(n(f(i(g)?)?)?)?)?)$/.test(arg)) {
    args.config = true;
  } else if (arg[0] === '-') {
    fatal(chalk.red(`ERROR: Unexpected commandline option: ${arg}`));
  } else if (!args.fqdn) {
    args.fqdn = arg;
  } else if (!args.email) {
    args.email = arg;
  } else if (!args.key) {
    args.key = arg;
  } else {
    fatal(chalk.red(`ERROR: Unexpected commandline argument: ${arg}`));
  }
}

if (!fs.existsSync(configPath)) {
  if (!args.key) {
    fatal(chalk.red(`ERROR: config file ${configPath} does not exist, not all required configuration has been specified.`));
  }
} else {
  config = require(configPath);
}

Object.assign(config, args, {
  config_path: configPath,
  config_exists: fs.existsSync(configPath),
});

const verbose = config.verbose ? console.log.bind(console) : function () {},
    required = [
      'fqdn',
      'email',
      'key'
    ];

function log (msg) {
  if (config.log) {
    fs.appendFileSync(config.log, msg + '\n');
  }
  if (config.verbose) {
    console.log(msg);
  }
}

if (config.verbose) {
  log('Configuration:\n' + JSON.stringify(config, null, 2))
}

let ip = null,
    error = false;

for (let key of required) {
  if (!config[key]) {
    fatal(chalk.red(`ERROR: value for ${chalk.blue(key)} is required in config or command line`));
  }
}
if (error) {
  process.exit(1);
}

const cf_api = cf({
  email: config.email,
  key: config.key
});

public_ip.v4().then(function (resp) {

  ip = resp;
  log(`ip=${ip}`);
  return cf_api.zones.browse();

}).then(function (resp) {

  if (resp && resp.result) {
    let i = 0;
    for (let zone of resp.result) {
      i++;
      if (config.fqdn.substr(-zone.name.length) === zone.name) {
        return zone;
      }
    }
    fatal(chalk.red(`ERROR: zone not found for ${chalk.blue(fqdn)} in the specified floudflare account.`));
  } else {
    fatal(JSON.stringify(resp, null, 2));
  }

}).then(function (zone) {

  return cf_api.dnsRecords.browse(zone.id).then(function (resp) {

    if (resp && resp.result) {
      let i = 0;
      for (let record of resp.result) {
        i++;
        if (record.name === config.fqdn) {
          return [true, record];
        }
      }
    } else {
      fatal(JSON.stringify(resp, null, 2));
    }
    return [false, zone];
  });

}).then(function (info) {

  let params = {
    name: config.fqdn,
    type: 'A',
    content: ip,
    proxied: config.proxied || false
  }

  //console.log(JSON.stringify(info, null, 2));
  //process.exit(0);

  if (info[0]) {
    if (info[1].type === params.type && info[1].content === params.content && info[1].proxied === params.proxied) {
      log(`FQDN ${info[1].name} is already set to ${JSON.stringify(params)}, set ${info[1].modified_on || info[1].created_on || 'unknown'}`);
      return {
        result: info[1],
        success: true,
        errors: [],
        messages: []
      };
    } else {
      log(JSON.stringify(info[1], null, 2));
      log(`Updating record ${info[1].id} of zone ${info[1].zone_id} with ${JSON.stringify(params)}`);
      return cf_api.dnsRecords.edit(info[1].zone_id, info[1].id, params);
    }
  } else {
    log(`Adding record in zone ${info[1].id} with ${JSON.stringify(params)}`);
    return cf_api.dnsRecords.add(info[1].id, params);
  }

}).then(function (resp) {

  verbose(JSON.stringify(resp, null, 2));
  process.exit(0);

}).catch(function (e) {

  if (!config.verbose) {
    process.stderr.write('Configuration:\n' + JSON.stringify(config, null, 2) + '\n');
  }

  fatal(chalk.red('ERROR: uknown\n' + JSON.stringify(e, null, 2)));

});

