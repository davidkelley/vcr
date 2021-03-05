#!/usr/bin/env DEBUG=vcr,$DEBUG node

const path = require('path');
const commander = require('commander');

const Cache = require('../server/cache');
const { loadConfig } = require('../utils/config');
const { record } = require('../commands/record');
const { play } = require('../commands/play');
const pkg = require('../../package.json');

const { Command } = commander;

const appConfig = loadConfig('vcr');

Cache.outputDirectory = path.resolve(process.cwd(), appConfig.snapshotsDir);

const program = new Command();

program.version(pkg.version);

program
  .command('record')
  .description('Record HTTP requests using a .vcrrc configuration file.')
  .action(() => {
    record(appConfig);
  });

program
  .command('play')
  .description(
    'Only respond with recorded HTTP requests, returning a 501 (Not Implemented) error for any requests that do not match.'
  )
  .action(() => {
    play(appConfig);
  });

program
  .command('replay')
  .description(
    'Replay all recorded HTTP requests and re-record all the responses.'
  )
  .action(() => {});

program.parse(process.argv);
