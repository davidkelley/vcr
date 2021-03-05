const { Readable } = require('stream');

const HAR = require('./har');

const testHAR = {
  log: {
    entries: [
      {
        response: {
          status: 200,
          headers: [
            {
              name: 'x-custom',
              value: 'custom-value',
            },
          ],
          content: {
            mimeType: 'application/json',
            text: Buffer.from('test value', 'utf8').toString('base64'),
            encoding: 'base64',
          },
        },
      },
    ],
  },
};

describe('HAR', () => {
  it('sets the correct class properties', () => {
    expect(new HAR(testHAR).entries).toBe(testHAR.log.entries);
    expect(new HAR().entries).toEqual([]);
  });

  describe('#toJSON', () => {
    it('returns the correct JSON', () => {
      const har = new HAR(testHAR);

      const json = JSON.parse(JSON.stringify(har));

      expect(json).toEqual(
        expect.objectContaining({
          log: expect.objectContaining({
            version: '1.2',
            entries: testHAR.log.entries,
          }),
        })
      );
    });
  });

  describe('#isValid', () => {
    describe('when there are no entries', () => {
      it('returns false', () => {
        const har = new HAR({
          log: {
            entries: ['blob'],
          },
        });
        return expect(har.isValid()).resolves.toBe(false);
      });
    });
  });

  describe('#generateHarReply', () => {
    let reply;

    beforeEach(() => {
      reply = {
        code: jest.fn(),
        header: jest.fn(),
        type: jest.fn(),
        send: jest.fn(),
      };
    });

    it('creates the correct reply', () => {
      const har = new HAR(testHAR);

      har.generateHarReply(reply);

      expect(reply.code).toHaveBeenCalledWith(200);

      expect(reply.header).toHaveBeenCalledWith('x-custom', 'custom-value');

      expect(reply.type).toHaveBeenCalledWith('application/json');

      expect(reply.send).toHaveBeenCalledWith(expect.any(Readable));
    });
  });

  describe('#generateHarEntry', () => {
    it('returns a valid HAR entry', async () => {
      const har = new HAR();

      const payload = new Readable();

      payload.push('test');
      payload.push(null);

      const request = {
        raw: {
          httpVersion: 1.1,
        },
        method: 'GET',
        hostname: 'example.com',
        url: '/a/b/c',
        startTimer: process.hrtime(),
        cookies: {
          'cookie-a': 'value-a',
        },
        headers: {
          'test-header': 'header-a',
        },
        query: {
          'test-query': 'query-a',
        },
        body: { foo: 'bar' },
      };

      const reply = {
        statusCode: 201,
        statusMessage: 'Created',
        protocol: 'https:',
        getHeaders: () => ({
          'response-header': 'response-a',
          'content-encoding': 'gzip',
          'content-type': 'plain/text',
        }),
      };

      expect(har.entries).toHaveLength(0);

      const entry = await har.generateHarEntry(request, reply, payload);

      await expect(har.isValid()).resolves.toBeTruthy();

      expect(entry).toEqual(
        expect.objectContaining({
          request: expect.objectContaining({
            url: expect.stringMatching(/^https?:\/\/example\.com\/a\/b\/c/),
            method: 'GET',
            httpVersion: 'HTTP/1.1',
            cookies: expect.arrayContaining([
              expect.objectContaining({ name: 'cookie-a', value: 'value-a' }),
            ]),
            headers: expect.arrayContaining([
              expect.objectContaining({
                name: 'test-header',
                value: 'header-a',
              }),
            ]),
            queryString: expect.arrayContaining([
              expect.objectContaining({ name: 'test-query', value: 'query-a' }),
            ]),
            postData: expect.objectContaining({
              text: expect.stringMatching(/"foo"/),
            }),
          }),
          response: expect.objectContaining({
            status: 201,
            statusText: 'Created',
            httpVersion: 'HTTP/1.1',
            headers: expect.arrayContaining([
              expect.objectContaining({
                name: 'response-header',
                value: 'response-a',
              }),
            ]),
          }),
        })
      );

      expect(entry).toMatchSnapshot({
        startedDateTime: expect.any(String),
        timings: {
          send: expect.any(Number),
        },
      });

      expect(har.entries).toHaveLength(1);
    });
  });
});

describe('#generateEntryObjectList', () => {
  it('returns the correct object', () => {
    expect(HAR.generateEntryObjectList({ foo: 1, bar: 2 })).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'foo',
          value: '1',
        }),
        expect.objectContaining({
          name: 'bar',
          value: '2',
        }),
      ])
    );
  });
});

describe('#streamToEncodedString', () => {
  describe('when the input is a string', () => {
    it('returns the string', () => {
      expect(HAR.streamToEncodedString('test string')).toEqual('test string');
    });
  });

  it('returns the correct encoded string', async () => {
    const stream = new Readable();

    const promise = HAR.streamToEncodedString(stream);

    stream.push('test');

    stream.push(null);

    const encodedString = await promise;

    expect(encodedString).toEqual(
      Buffer.from('test', 'utf8').toString('base64')
    );
  });
});

describe('#createReadableStream', () => {
  it('returns the correct data', (done) => {
    expect.assertions(1);

    const stream = HAR.createReadableStream(testHAR.log.entries[0]);

    const chunks = [];

    stream.on('data', function (chunk) {
      chunks.push(chunk);
    });

    stream.on('end', function () {
      const data = Buffer.concat(chunks).toString('utf8');

      expect(data).toEqual('test value');

      done();
    });
  });
});
