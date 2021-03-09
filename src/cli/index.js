#!/usr/bin/env DEBUG=vcr,$DEBUG node

const path = require('path');
const commander = require('commander');

const Cache = require('../server/cache');
const { loadConfig } = require('../utils/config');
const { record } = require('../commands/record');
const { play } = require('../commands/play');
const { replay } = require('../commands/replay');
const pkg = require('../../package.json');

const { Command } = commander;

const appConfig = loadConfig('vcr');

/**
 * Update the HAR cache directory to use the app configuration directory
 */
Cache.outputDirectory = path.resolve(process.cwd(), appConfig.snapshotsDir);

const program = new Command();

/**
 * Use the CLI version from the package.json file
 */
program.version(pkg.version);

/**
 * Start caching responses from servers that have been configured to be proxies.
 */
program
  .command('record')
  .description('Record HTTP requests using a .vcrrc configuration file.')
  .action(() => {
    record(appConfig);
  });

/**
 * Respond with cached responses only; any requests received that have not been
 * recorded before are responded with a 501 Status Code.
 */
program
  .command('play')
  .description(
    'Only respond with recorded HTTP requests, returning a 501 (Not Implemented) error for any requests that do not match.'
  )
  .action(() => {
    play(appConfig);
  });

/**
 * The replay command loops all over all of the configured origins and all of the cached requests for
 * each origin, updating the responses for each.
 */
program
  .command('replay')
  .description(
    'Automatically replay all cached requests for all origins, updating the responses.'
  )
  .action(() => {
    replay(appConfig);
  });

/**
 * Take each HAR file and send another request to the origin,
 * refreshing the cached response.
 */
program
  .command('replay')
  .description(
    'Replay all recorded HTTP requests and re-record all the responses.'
  )
  .action(() => {});

program.parse(process.argv);
