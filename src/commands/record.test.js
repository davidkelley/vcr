const fetch = require('node-fetch');
const glob = require('glob');
const rimraf = require('rimraf');

const Cache = require('../server/cache');

const { record } = require('./record');

const FIXTURE_DIR = `${__dirname}/__fixtures__/__vcr__/`;

Cache.outputDirectory = FIXTURE_DIR;

const getHAR = () => glob.sync(`${FIXTURE_DIR}/**/*.har`, { nodir: true });

const config = {
  servers: [
    {
      name: 'Test',
      origin: 'https://httpbin.org',
      port: 56210,
    },
  ],
};

let consoleSpy;

let server;

describe('record', () => {
  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => null);
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  beforeEach(async () => {
    const servers = await record(config);
    server = servers[0];
  });

  afterEach(async () => {
    await server.stop();
  });

  describe('when a request is already cached', () => {
    it('returns the cached response', async () => {
      const fixtureHARs = getHAR();

      expect(fixtureHARs.length).toBeGreaterThan(0);

      const res = await fetch('http://localhost:56210/get?valid=1', {
        headers: {
          'X-Test-Header': 'test value',
        },
      });

      await expect(res.json()).resolves.toEqual(
        expect.objectContaining({
          args: {
            valid: '1',
          },
          headers: expect.objectContaining({
            'X-Test-Header': 'test value',
          }),
        })
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringMatching(/HIT.+200.+\/get\?valid=1/)
      );

      expect(fixtureHARs.length).toBe(getHAR().length);
    });
  });
});
