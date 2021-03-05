const mock = require('mock-fs');

const Cache = require('./cache');

beforeEach(() => {
  Cache.outputDirectory = '/__vcr__';
});

afterEach(() => {
  mock.restore();
});

describe('Cache', () => {
  it('works', () => {
    expect(Cache).not.toBe(true);
  });
});

const exampleRequest = {
  method: 'post',
  host: 'example.com',
  pathname: '/foo/bar',
  body: JSON.stringify({ foo: 'bar' }),
  query: {
    limit: 10,
    page: 1,
  },
  headers: {
    'X-Forwarded-For': '34.65.12.34',
    Host: 'example.com',
    Authorization: 'Bearer sj29rtj09ja9dja09eja',
  },
};

const setup = () => {
  return new Cache('GET', 'example.com', '/foo/bar', exampleRequest, {
    testOption: 34,
    ignoreHeaders: ['x-forwarded-for'],
  });
};

describe('Cache', () => {
  it('correctly initializes', () => {
    const cache = setup();

    expect(cache.options).toEqual(
      expect.objectContaining({
        testOption: 34,
        ignoreHeaders: expect.arrayContaining(['host', 'x-forwarded-for']),
      })
    );

    expect(cache.request).toEqual(
      expect.objectContaining({
        method: 'GET',
        host: 'example.com',
        pathname: '/foo/bar',
        headers: expect.arrayContaining([
          expect.objectContaining({
            name: 'authorization',
            value: expect.any(String),
          }),
        ]),
        query: expect.arrayContaining([
          expect.objectContaining({ name: 'limit', value: '10' }),
          expect.objectContaining({ name: 'page', value: '1' }),
        ]),
      })
    );

    expect(cache.signature).toEqual(expect.stringMatching(/^[a-z0-9]+$/i));

    expect(cache.signature).toMatchSnapshot();
  });

  describe('#filepath', () => {
    it('calculates the filepath correctly', () => {
      expect(setup().filepath).toEqual(
        expect.stringMatching(
          /^\/__vcr__\/example\.com\/foo\/bar\/[a-z0-9]+\.har$/i
        )
      );
    });
  });

  describe('#storeDir', () => {
    it('calculates the store directory correctly', () => {
      expect(setup().storeDir).toEqual('/__vcr__/example.com/foo/bar');
    });
  });

  describe('#read', () => {
    beforeEach(() => {
      mock({
        '/test.json': JSON.stringify({ test: 1234 }),
      });
    });

    it('reads the file correctly', () => {
      const cache = setup();

      Object.defineProperty(cache, 'filepath', {
        value: '/test.json',
      });

      expect(cache.read()).toEqual(
        expect.objectContaining({
          test: 1234,
        })
      );
    });
  });

  describe('#store', () => {
    beforeEach(() => {
      mock({});
    });

    it('correctly stores the object', () => {
      const cache = setup();

      Object.defineProperty(cache, 'filepath', {
        value: '/test.json',
      });

      expect(cache.isCached()).toBeFalsy();

      cache.store({ test: 4567 });

      expect(cache.isCached()).toBeTruthy();

      expect(cache.read()).toEqual(
        expect.objectContaining({
          test: 4567,
        })
      );
    });
  });

  describe('#isCached', () => {
    describe('when the request is cached', () => {
      beforeEach(() => {
        mock({
          '/test.json': JSON.stringify({ test: 1234 }),
        });
      });

      it('returns true', () => {
        const cache = setup();

        Object.defineProperty(cache, 'filepath', {
          value: '/test.json',
        });

        expect(cache.isCached()).toBeTruthy();
      });
    });

    describe('when the request is not cached', () => {
      beforeEach(() => {
        mock({});
      });

      it('returns false', () => {
        const cache = setup();

        Object.defineProperty(cache, 'filepath', {
          value: '/test.json',
        });

        expect(cache.isCached()).toBeFalsy();
      });
    });
  });
});

describe('Cache.sanitizeRequestParameters', () => {
  it('correctly sanitises parameters', () => {
    const ignoreHeaders = ['authorization'];

    const sanitizedRequest = Cache.sanitizeRequestParameters(exampleRequest, {
      ignoreHeaders,
    });

    expect(sanitizedRequest).toEqual(
      expect.objectContaining({
        method: 'POST',
        host: 'example.com',
        pathname: '/foo/bar',
        body: expect.stringMatching(/^[a-z0-9]+$/i),
        headers: expect.arrayContaining([
          expect.objectContaining({
            name: 'x-forwarded-for',
            value: '34.65.12.34',
          }),
        ]),
        query: expect.arrayContaining([
          expect.objectContaining({ name: 'limit', value: '10' }),
          expect.objectContaining({ name: 'page', value: '1' }),
        ]),
      })
    );
  });
});

describe('Cache.generateSignature', () => {
  it('produces a signature', () => {
    const testObject = { test: 1234 };

    const signature = Cache.generateSignature(testObject);

    expect(signature).toEqual(expect.stringMatching(/^[a-z0-9]+$/i));

    expect(signature).toMatchSnapshot();
  });
});

describe('Cache.sanitizeRequestObject', () => {
  it('correctly sanitizes an object', () => {
    const testObject = {
      b: 4,
      Test: 1234,
      a: true,
      OTHER_KEY: ['foo', 'bar'],
      EMOJI: '👍',
    };

    const sanitized = Cache.sanitizeRequestObject(testObject, ['test']);

    expect(sanitized).toEqual([
      { name: 'a', value: 'true' },
      { name: 'b', value: '4' },
      { name: 'emoji', value: 'xn--yp8h' },
      { name: 'other_key', value: JSON.stringify(['foo', 'bar']) },
    ]);
  });
});
