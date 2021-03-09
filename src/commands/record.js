const chalk = require('chalk');

const Server = require('../server');
const Theme = require('../theme');
const { getColorForString } = require('../utils/getColorForString');

const HIT = chalk.hex(Theme.colors.success).bold('[HIT] ');

const MISS = chalk.hex(Theme.colors.warning).bold('[MISS]');

/**
 * receives an instance of server and binds to events that are generated, in order
 * to display useful information to the caller
 */
const handleServer = async (server) => {
  const { config } = server;

  const { name = 'Unnamed' } = config;

  await server.start();

  let color = Theme.colors.secondary;

  if (name) {
    color = getColorForString(name);
  }

  const displayName = chalk.hex(color).bold(`[${name}]`);

  server.events.on('onStart', ({ host, port: assignedPort }) => {
    /**
     * display a helpful message to let the caller know the server is listening
     * and on which port
     */
    console.log(
      chalk`${displayName} {hex("${color}") Listening on http://${host}:${assignedPort}}`
    );
  });

  server.events.on('onSend', (request, har, isCached) => {
    const { status } = har.entries[0].response;

    const statusColor = Theme.colors.getStatusColor(status);

    const cacheStatus = isCached ? HIT : MISS;

    /**
     * display a helpful message to indicate a request has been served from the cache
     * or is newly cached
     */
    console.log(
      chalk`${displayName} ${cacheStatus} {hex("${statusColor}") (${status})} {${
        isCached ? 'dim' : 'visible'
      } ${request.url}}`
    );
  });

  return server;
};

/**
 * begins recording requests and responses to all of the configured origins.
 */
exports.record = (appConfig) => {
  const { servers: serverConfig } = appConfig;

  // loop over each configured proxy and create a server!
  const servers = serverConfig.map((config) => new Server(config));

  return Promise.all(servers.map(handleServer));
};
