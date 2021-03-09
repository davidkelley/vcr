const chalk = require('chalk');

const Server = require('../server');
const Theme = require('../theme');
const debug = require('../utils/debug');
const { getColorForString } = require('../utils/getColorForString');

const HIT = chalk.hex(Theme.colors.success).bold('[HIT] ');

const MISS = chalk.hex(Theme.colors.danger).bold('[MISS]');

/**
 * receives an instance of Server and configures the behavior and listens for events
 * that are happening.
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
     * display a listening message when the server has started
     */
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

    /**
     * if the request is not cached, then immediately reply with a 501
     * status code (not implemented) and ensure fastify knows the reply
     * has been sent.
     */
    if (!isCached) {
      reply.code(501);
      reply.send('');
      reply.sent = true;
    }
  });

  return server;
};

/**
 * play all the cached responses only! This means that is a request is received
 * that has not been cached already, a 501 status code will be returned!
 */
exports.play = (appConfig) => {
  const { servers: serverConfig } = appConfig;

  // start a new server for each configured proxy!
  const servers = serverConfig.map((config) => new Server(config));

  return Promise.all(servers.map(handleServer));
};
