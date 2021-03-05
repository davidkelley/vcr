const { URL } = require('url');
const Fastify = require('fastify');
const FastifyCookie = require('fastify-cookie');
const FastifyURLData = require('fastify-url-data');
const EventEmitter = require('events');
const Proxy = require('fastify-reply-from');

const Cache = require('./cache');
const HAR = require('./har');

const UNDICI_OPTIONS = {
  connections: 100,
  pipelining: 10,
};

const HTTP_METHODS = [
  'DELETE',
  'GET',
  'HEAD',
  'PATCH',
  'POST',
  'PUT',
  'OPTIONS',
];

class Server {
  constructor(config) {
    const { options, origin, port = 0, host = 'localhost' } = config;

    this.config = config;

    this.events = new EventEmitter();

    this.options = options;

    this.port = port;
    this.host = host;

    this.url = new URL(origin);

    this.onRequest = this.onRequest.bind(this);
    this.onPreHandler = this.onPreHandler.bind(this);
    this.onSendHook = this.onSendHook.bind(this);
    this.rewriteUrl = this.rewriteUrl.bind(this);

    const server = Fastify({
      logger: false,
      rewriteUrl: this.rewriteUrl,
    });

    server.register(FastifyCookie);

    server.register(FastifyURLData);

    server.register(Proxy, {
      base: this.url.origin,
      undici: UNDICI_OPTIONS,
    });

    server.addHook('preHandler', this.onPreHandler);
    server.addHook('onSend', this.onSendHook);

    server.route({
      method: HTTP_METHODS,
      url: '*',
      handler: this.onRequest,
    });

    this.server = server;
  }

  rewriteUrl(request) {
    const { url } = this;
    return `${url.pathname}${request.url}`.replace(/\/(?:\/|(\?))/g, '$1');
  }

  onRequest(request, reply) {
    const { events } = this;

    events.emit('onRequest', request, reply);

    reply.from(request.url, {
      onResponse: (request, reply, res) => {
        events.emit('onProxyResponse', request, reply, res);
        reply.send(res);
      },
    });
  }

  async onPreHandler(request, reply) {
    const { events, url, options } = this;

    const { method, body, query, headers } = request;

    const urlData = request.urlData();

    request.startTimer = process.hrtime();

    reply.protocol = url.protocol;

    const cache = new Cache(
      method,
      url.host,
      urlData.path,
      {
        query: query,
        headers: headers,
        body: body,
      },
      options
    );

    request.cache = cache;

    const isCached = await cache.isCached();

    events.emit('onPreHandler', request, reply, isCached);

    if (isCached) {
      const har = new HAR(cache.read());
      await har.generateHarReply(reply);
      request.har = har;
    }

    return;
  }

  async onSendHook(request, reply, payload) {
    const { events } = this;

    const { cache } = request;

    const isCached = await cache.isCached();

    if (isCached) {
      const har = new HAR(cache.read());
      events.emit('onSend', request, har, isCached);
      return;
    }

    if (reply.statusCode === 501) {
      return;
    }

    const har = new HAR();

    const entry = await har.generateHarEntry(request, reply, payload);

    await cache.store(har.toJSON());

    events.emit('onSend', request, har, isCached);

    return HAR.createReadableStream(entry);
  }

  async start() {
    const { events, server, host, port } = this;
    return new Promise((resolve, reject) => {
      server.listen({ host, port }, (err, address) => {
        if (err) {
          reject(err);
        }
        this.started = true;
        if (port === 0) {
          const [, boundPort] = address.match(/:([0-9]+)$/);
          this.port = parseInt(boundPort, 10);
        }
        events.emit('onStart', this);
        resolve(true);
      });
    });
  }

  async stop() {
    const { events, server, started } = this;

    if (!started) {
      return Promise.resolve(true);
    }

    await server.close();
    this.started = false;
    events.emit('onStop', this);

    return true;
  }
}

module.exports = Server;
