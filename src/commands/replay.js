const { URL } = require('url');
const chalk = require('chalk');
const fetch = require('node-fetch');
const fs = require('fs-extra');

const Server = require('../server');
const Theme = require('../theme');
const Cache = require('../server/cache');
const HAR = require('../server/har');
const { getColorForString } = require('../utils/getColorForString');

/**
 * Replay the HAR request using the configured, running server.
 *
 * It gets the request from the HAR file and modifies the URL so that it
 * calls the origin through proxy server to generate an updated HAR file.
 *
 * Before sending the request, it deletes the original HAR file, only restoring
 * the original file if there is a library/network error from the fetch library.
 */
const replayHAR = async (server, filepath) => {
  const { host, port } = server;

  // read the cached HAR file and create a new HAR instance
  const cachedHAR = fs.readJSONSync(filepath);

  const har = new HAR(cachedHAR);

  const [requestUrl, options] = har.generateHarRequest();

  // destructure the pathname and search parameters being used in the URL
  const { pathname, search } = new URL(requestUrl);

  // modify the URL to call the proxy server
  const replayUrl = `http://${host}:${port}${pathname}${search}`;

  try {
    // delete the existing har file
    fs.unlinkSync(filepath);
    /**
     * we do not inspect the status of the response as it may be
     * intentional to return a non-200 status code
     */
    await fetch(replayUrl, options);

    if (!fs.existsSync(filepath)) {
      // WARN: The expected HAR file does not exist anymore
      console.warn(
        chalk.yellow(
          `URL "${replayUrl}" did not create expected HAR file: "${filepath.replace(
            process.cwd(),
            ''
          )}"`
        )
      );
    }
  } catch (err) {
    /**
     * recover from a library/network error!
     * rewrite the original HAR file
     */
    fs.outputJSONSync(filepath, cachedHAR);
    // output the error message but do not throw it
    console.log(chalk.red(`Error: ${replayUrl}`));
    console.error(err);
  }

  return true;
};

/**
 * replay all requests from a specific proxy server, first starting the server
 * and then stopping the server after all the requests have been replayed.
 */
const replayRequests = async (server) => {
  const { config } = server;

  const { name = 'Unnamed', origin } = config;

  const color = getColorForString(name);

  const displayName = chalk.hex(color).bold(`[${name}]`);

  const { host } = new URL(origin);

  // get all the cached requests stored under the host
  const cachedRequests = Cache.all(host);

  await server.start();

  server.events.on('onSend', (request, har) => {
    const { status } = har.entries[0].response;

    const statusColor = Theme.colors.getStatusColor(status);
    /**
     * display a useful message informing the caller the request has been replayed
     */
    console.log(
      chalk`${displayName} Replayed {hex("${statusColor}") (${status})} {bold [${request.method}]} ${request.url}`
    );
  });

  await cachedRequests.reduce(async (previousPromise, harFilepath) => {
    await previousPromise;
    return replayHAR(server, harFilepath);
  }, Promise.resolve(true));

  await server.stop();

  return true;
};

/**
 * update all of the cached responses from all of the origins
 */
exports.replay = async (appConfig) => {
  const { servers: serverConfig } = appConfig;

  // loop over all the servers and replay requests one at a time to
  // avoid bombarding the origin server
  await serverConfig.reduce(async (previousPromise, config) => {
    await previousPromise;
    return replayRequests(new Server(config));
  }, Promise.resolve(true));

  return true;
};
