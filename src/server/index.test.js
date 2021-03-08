const fetch = require('node-fetch');
const rimraf = require('rimraf');
const fs = require('fs');
const glob = require('glob');

const Server = require('.');
const Cache = require('./cache');

const PORT = 63241;

const HOST = `http://localhost:${PORT}`;

const VCR_DIR = `${__dirname}/__fixtures__/__vcr__`;

Cache.outputDirectory = VCR_DIR;

beforeEach(() => {
  fs.mkdirSync(VCR_DIR, { recursive: true });
});

afterEach(() => {
  rimraf.sync(VCR_DIR);
});

const getHAR = () => glob.sync(`${VCR_DIR}/**/*.har`, { nodir: true });

const readHAR = (har) => JSON.parse(fs.readFileSync(har, 'utf8'));

describe('Server', () => {
  let server;

  let config;

  beforeEach(() => {
    config = {
      port: PORT,
      origin: 'https://httpbin.org',
      options: {
        ignoreHeaders: ['x-test-header'],
        ignoreQueryParameters: ['test-param'],
      },
    };
  });

  beforeEach(async () => {
    server = new Server(config);

    await server.start();
  });

  afterEach(async () => {
    await server.stop();
  });

  describe('#start', () => {
    describe('when the server is already started', () => {
      it('does nothing', () => {
        return expect(server.start()).resolves.toEqual(true);
      });
    });
  });

  describe('#stop', () => {
    describe('when the server is not started', () => {
      it('does not do anything', async () => {
        await server.stop();

        return expect(server.stop()).resolves.toEqual(true);
      });
    });
  });

  describe('when no port is specified', () => {
    beforeEach(() => {
      delete config.port;
    });

    beforeEach(async () => {
      await server.stop();

      server = new Server(config);

      await server.start();
    });

    it('assigns a random port', () => {
      expect(server.port).toEqual(expect.any(Number));
      expect(server.port).toBeGreaterThan(0);
    });
  });

  describe('when a request is received', () => {
    it('calls the origin and caches the response', async () => {
      expect(getHAR()).toHaveLength(0);

      await fetch(`${HOST}/get?test-param=123`, {
        headers: {
          'x-test-header': 'req-1',
        },
      });

      expect(getHAR()).toHaveLength(1);

      await fetch(`${HOST}/get?test-param=456`, {
        headers: {},
      });

      expect(getHAR()).toHaveLength(1);

      const har = readHAR(getHAR()[0]);

      const [entry] = har.log.entries;

      expect(entry.request.url).toEqual(
        'https://httpbin.org/get?test-param=123'
      );

      expect(entry.request.headers).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: 'x-test-header',
            value: 'req-1',
          }),
        ])
      );

      expect(entry.response.status).toBe(200);

      expect(() =>
        JSON.parse(
          Buffer.from(entry.response.content.text, 'base64').toString('utf8')
        )
      ).not.toThrow();
    });
  });
});
