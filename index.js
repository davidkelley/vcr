const { play } = require('./src/commands/play');
const { loadConfig } = require('./src/utils/config');

const appConfig = loadConfig('vcr');

let servers;

exports.start = () => {
  servers = play(appConfig);
};

exports.servers = () => servers;

exports.stop = () => {
  servers.forEach((server) => {
    server.stop();
  });
  servers = null;
};
