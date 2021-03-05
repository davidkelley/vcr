const cosmiconfig = require('cosmiconfig');
const merge = require('deepmerge');
const path = require('path');

const { validate } = require('./schema');

const defaultConfig = {
  snapshotsDir: './__vcr__',
};

const extendConfig = (moduleName, configFile, config) => {
  if (!config.extends) {
    return config;
  }

  const filepath = path.resolve(path.dirname(configFile), config.extends);

  const extended = cosmiconfig.cosmiconfigSync(moduleName).load(filepath);

  return { ...extendConfig(moduleName, filepath, extended.config), ...config };
};

exports.loadConfig = (moduleName) => {
  const file = cosmiconfig.cosmiconfigSync(moduleName).search();

  if (!file) {
    throw new Error(`
      No VCR configuration file was found.

      Use --help for more information on how to get started.
    `);
  }

  const { config, filepath } = file;

  const resolvedConfig = merge(
    defaultConfig,
    extendConfig(moduleName, filepath, config)
  );

  validate(resolvedConfig);

  return resolvedConfig;
};
