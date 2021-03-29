const path = require('path');

const Cache = require('./src/server/cache');
const { play } = require('./src/commands/play');
const { loadConfig } = require('./src/utils/config');

const appConfig = loadConfig('vcr');

Cache.outputDirectory = path.resolve(process.cwd(), appConfig.snapshotsDir);

let vcr;

exports.start = async () => {
  if (vcr) {
    return vcr;
  }

  vcr = play(appConfig);
  
  return vcr;
};

exports.servers = async () => {
  return await vcr;
};

exports.stop = async () => {
  if (!vcr) {
    return true;
  }
  
  const servers = await vcr;

  await Promise.all(servers.map((server) => {
    return server.stop();
  }));

  vcr = null;

  return true;
};
