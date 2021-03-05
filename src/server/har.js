const harValidator = require('har-validator');
const { Readable } = require('stream');

class HAR {
  constructor(initialHar = {}) {
    this.entries = [];

    if (initialHar.log) {
      this.entries = initialHar.log.entries;
    }
  }

  async isValid() {
    try {
      return await HAR.validateHar(this.toJSON());
    } catch (err) {
      return false;
    }
  }

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

  static validateHar(har) {
    return harValidator.har(har);
  }

  static generateEntryObjectList(obj) {
    return Object.keys(obj).map((key) => ({
      name: key,
      value: obj[key].toString(),
    }));
  }

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
