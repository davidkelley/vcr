const chalk = require('chalk');

const Server = require('../server');
const Theme = require('../theme');
const { getColorForString } = require('../utils/getColorForString');

const HIT = chalk.hex(Theme.colors.success).bold('[HIT] ');

const MISS = chalk.hex(Theme.colors.warning).bold('[MISS]');

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
    console.log(
      chalk`${displayName} {hex("${color}") Listening on http://${host}:${assignedPort}}`
    );
  });

  server.events.on('onSend', (request, har, isCached) => {
    const { status } = har.entries[0].response;

    const statusColor = Theme.colors.getStatusColor(status);

    const cacheStatus = isCached ? HIT : MISS;

    console.log(
      chalk`${displayName} ${cacheStatus} {hex("${statusColor}") (${status})} {${
        isCached ? 'dim' : 'visible'
      } ${request.url}}`
    );
  });
};

exports.record = (appConfig) => {
  const { servers: serverConfig } = appConfig;

  const servers = serverConfig.map((config) => new Server(config));

  servers.forEach(handleServer);

  return true;
};
