const chalk = require('chalk');

const Server = require('../server');
const Theme = require('../theme');
const debug = require('../utils/debug');
const { getColorForString } = require('../utils/getColorForString');

const HIT = chalk.hex(Theme.colors.success).bold('[HIT] ');

const MISS = chalk.hex(Theme.colors.danger).bold('[MISS]');

const handleServer = (server) => {
  const { config } = server;

  const { name = 'Unnamed' } = config;

  server.start();

  let color = Theme.colors.secondary;

  if (name) {
    color = getColorForString(name);
  }

  const displayName = chalk.hex(color).bold(`[${name}]`);

  server.events.on('onStart', ({ host, port: assignedPort }) => {
    debug(
      chalk`${displayName} {hex("${color}") Listening on http://${host}:${assignedPort}}`
    );
  });

  server.events.on('onPreHandler', (request, reply, isCached) => {
    const cacheStatus = isCached ? HIT : MISS;

    debug(
      chalk`${displayName} ${cacheStatus} {${isCached ? 'dim' : 'visible'} ${
        request.url
      }}`
    );

    if (!isCached) {
      reply.code(501);
      reply.send('');
      reply.sent = true;
    }
  });
};

exports.play = (appConfig) => {
  const { servers: serverConfig } = appConfig;

  const servers = serverConfig.map((config) => new Server(config));

  servers.forEach(handleServer);

  return servers;
};
