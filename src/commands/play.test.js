const fetch = require('node-fetch');

const Cache = require('../server/cache');

const { play } = require('./play');

const FIXTURE_DIR = `${__dirname}/__fixtures__/__vcr__/`;

Cache.outputDirectory = FIXTURE_DIR;

const config = {
  servers: [
    {
      name: 'Test',
      origin: 'https://httpbin.org',
      port: 56209,
    },
  ],
};

let server;

beforeEach(async () => {
  [server] = await play(config);
});

afterEach(async () => {
  await server.stop();
});

describe('play', () => {
  it('responds with a 501 when the request is not implemented', async () => {
    const res = await fetch('http://localhost:56209/get?missing=1');

    return expect(res.status).toEqual(501);
  });

  // it('responds with the correct response when the request is implemented', async () => {
  //   const res = await fetch('http://localhost:56209/get?valid=1');
  // });
});
