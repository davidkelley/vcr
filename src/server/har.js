const harValidator = require('har-validator');
const { Readable } = require('stream');

/**
 * The HAR class is responsible for taking request and response objects
 * and building HAR entries files from them.
 *
 * It is also capable of taking existing HAR files from cached requests and
 * generating consumable response streams from them.
 */
class HAR {
  /**
   * Accept an initial HAR file to use if one is apssed through
   */
  constructor(initialHar = {}) {
    this.entries = [];

    if (initialHar.log) {
      this.entries = initialHar.log.entries;
    }
  }

  /**
   * Determine if the HAR file in this instance is valid
   */
  async isValid() {
    try {
      return await HAR.validateHar(this.toJSON());
    } catch (err) {
      return false;
    }
  }

  /**
   * Take the entries this HAR class has generated and
   * create a JSON Structure that is compatible with HAR.
   */
  toJSON() {
    const { entries } = this;

    const httpArchive = {
      log: {
        version: '1.2',
        creator: {
          name: 'vcr',
          version: '0.0.1',
        },
        pages: [
          {
            startedDateTime: new Date().toISOString(),
            id: `vcr-har`,
            title: `vcr-har`,
            pageTimings: {},
          },
        ],
        entries,
      },
    };

    return httpArchive;
  }

  /**
   * Using the first entry in the HAR instance, use the reply
   * object that has been passed in, to construct a response back to the
   * caller using the cached response.
   *
   * @note The reply parameter should be a fastify reply object
   *
   * @see https://www.fastify.io/docs/latest/Reply/
   */
  async generateHarReply(reply) {
    const {
      entries: [entry],
    } = this;

    const { response } = entry;

    reply.code(response.status);

    response.headers.forEach(({ name, value }) => {
      reply.header(name, value);
    });

    reply.type(response.content.mimeType);

    reply.send(HAR.createReadableStream(entry));
  }

  /**
   * Using the original request, the reply and the payload from the origin,
   * build a HAR entry that can be consumed to produce cached responses in
   * the future.
   *
   * @see https://en.wikipedia.org/wiki/HAR_(file_format)
   * @see http://www.softwareishard.com/blog/har-12-spec/
   */
  async generateHarEntry(request, reply, payload) {
    const { httpVersion } = request.raw;

    const nsDuration = process.hrtime(request.startTimer);

    const duration = parseFloat(
      (nsDuration[0] * 1e3 + nsDuration[1] / 1e6).toFixed(2)
    );

    const text = await HAR.streamToEncodedString(payload);

    const responseHeaders = reply.getHeaders();

    const url = `${reply.protocol}//${request.hostname}${request.url}`;

    const entry = {
      startedDateTime: new Date().toISOString(),
      time: -1,
      request: {
        url,
        method: request.method,
        httpVersion: `HTTP/${httpVersion}`,
        cookies: HAR.generateEntryObjectList(request.cookies),
        headers: HAR.generateEntryObjectList(request.headers),
        queryString: HAR.generateEntryObjectList(request.query),
        headersSize: -1,
        bodySize: -1,
      },
      response: {
        status: reply.statusCode,
        statusText: reply.statusMessage || 'OK',
        httpVersion: `HTTP/${httpVersion}`,
        cookies: [],
        headers: HAR.generateEntryObjectList(responseHeaders),
        content: {
          size: text.length,
          text: text,
          encoding: 'base64',
          comment: responseHeaders['content-encoding'],
          mimeType: responseHeaders['content-type'],
        },
        redirectURL: '',
        headersSize: -1,
        bodySize: -1,
      },
      timings: {
        blocked: -1,
        dns: -1,
        connect: 15,
        send: duration,
        wait: 0,
        receive: 0,
      },
      cache: {},
    };

    if (request.body) {
      entry.request.postData = {
        mimeType: 'application/octet-stream',
        text: JSON.stringify(request.body),
      };
    }

    this.entries.push(entry);

    return entry;
  }

  /**
   * take a HAR object and validate it, returns true
   * if the object is valid, false otherwise.
   */
  static validateHar(har) {
    return harValidator.har(har);
  }

  /**
   * Take an object and return an array of HAR name and value tuples
   */
  static generateEntryObjectList(obj) {
    return Object.keys(obj).map((key) => ({
      name: key,
      value: obj[key].toString(),
    }));
  }

  /**
   * Transform the readable stream that respresents the response body
   * from an origin into a base64 encoded string. Doing this, also allows
   * us to cache binary content such as images and audio.
   */
  static streamToEncodedString(stream) {
    if (typeof stream === 'string') {
      return stream;
    }

    return new Promise((resolve) => {
      const chunks = [];

      stream.on('data', function (chunk) {
        chunks.push(chunk);
      });

      stream.on('end', function () {
        resolve(Buffer.concat(chunks).toString('base64'));
      });
    });
  }

  /**
   * Create a consumable readable stream from the response body content of
   * the HAR entry passed in.
   */
  static createReadableStream(entry) {
    const { content } = entry.response;
    return new Readable({
      read() {
        this.push(Buffer.from(content.text, content.encoding || 'utf8'));
        this.push(null);
      },
    });
  }
}

module.exports = HAR;
