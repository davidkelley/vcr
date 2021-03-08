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

/**
 * Start a server and begin to proxy requests and cache responses from the origin.
 *
 * If the request has already been responded to, it will be served from the cache.
 */
class Server {
  constructor(config) {
    /**
     * destructure the config used for this proxy server
     */
    const { options, origin, port = 0, host = 'localhost' } = config;

    this.config = config;

    this.events = new EventEmitter();

    /**
     * store options for this proxy server
     */
    this.options = options;

    /**
     * store the host and port this server will bind to and the origin
     * url to proxy requests to
     */
    this.port = port;
    this.host = host;
    this.url = new URL(origin);

    this.onRequest = this.onRequest.bind(this);
    this.onPreHandler = this.onPreHandler.bind(this);
    this.onSendHook = this.onSendHook.bind(this);
    this.rewriteUrl = this.rewriteUrl.bind(this);

    /**
     * Setup the fastify server and register necessary handlers for the proxy
     */
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

    // send all routes and all methods to this.onRequest handler!
    server.route({
      method: HTTP_METHODS,
      url: '*',
      handler: this.onRequest,
    });

    this.server = server;
  }

  /**
   * Join the url pathname used to configure the origin in the proxy configuration
   * with the url requested. ie. if the proxy URL is set to: example.com/a/b/c
   * and the URL requested is localhost:5678/d/e/f this method
   * should return /a/b/c/d/e/f
   */
  rewriteUrl(request) {
    const { url } = this;
    return `${url.pathname}${request.url}`.replace(/\/(?:\/|(\?))/g, '$1');
  }

  /**
   * Handle an incoming request and proxy it to the origin
   */
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

  /**
   * This prehandler hook is registered to the fastify server and
   * determines configures the Cache and the HAR class instances
   * for the request.
   *
   * @see https://github.com/fastify/fastify/blob/master/docs/Hooks.md#prehandler
   */
  async onPreHandler(request, reply) {
    const { events, url, options } = this;

    const { method, body, query, headers } = request;

    const urlData = request.urlData();

    /**
     * start a timer for HAR purposes
     */
    request.startTimer = process.hrtime();

    /**
     * set the reply protocol to match the request url protocol
     * for the origin
     */
    reply.protocol = url.protocol;

    /**
     * Configure a Cache instance that generates a signature and
     * determines it this request has already been cached
     */
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

    /**
     * determine if this request has already been cached
     */
    const isCached = await cache.isCached();

    events.emit('onPreHandler', request, reply, isCached);

    /**
     * if this request has already been cached, then create
     * a HAR instance, commit it to the request and send the cached
     * reply.
     *
     * If the request was cached and the reply has been sent,
     * no further fastify hooks or handlers are executed.
     */
    if (isCached) {
      const har = new HAR(cache.read());
      // this line sends the cached reply!
      await har.generateHarReply(reply);
      request.har = har;
    }

    return;
  }

  /**
   * the on send hook is triggered after the response has been received
   * from the origin and is about to be sent back to the caller.
   */
  async onSendHook(request, reply, payload) {
    const { events } = this;

    const { cache } = request;

    /**
     * determine if the request is already cached
     */
    const isCached = await cache.isCached();

    /**
     * the request has already been cached, emit the
     * onSend event and return
     */
    if (isCached) {
      const { har } = request;
      events.emit('onSend', request, har, isCached);
      return;
    }

    /**
     * check the status code and if it indicates the endpoint has
     * not been implemented (or pre-cached), then do not cache
     * the response
     */
    if (reply.statusCode === 501) {
      return;
    }

    /**
     * the request was not already cached, create a new HAR object and cache it
     */
    const har = new HAR();

    const entry = await har.generateHarEntry(request, reply, payload);

    await cache.store(har.toJSON());

    events.emit('onSend', request, har, isCached);

    /**
     * create a readable stream to send back to the caller, from the cached
     * HAR response.
     */
    return HAR.createReadableStream(entry);
  }

  /**
   * start the server and bind to the configured port or pick one
   * at random. If the port is randomly assigned, record the
   * port that was used.
   */
  async start() {
    const { events, server, host, port } = this;

    /**
     * if the server has already started, do nothing
     */
    if (this.started) {
      return true;
    }

    return new Promise((resolve, reject) => {
      server.listen({ host, port }, (err, address) => {
        if (err) {
          reject(err);
        }
        this.started = true;
        if (port === 0) {
          // get the port the server has bound to and apply it to the class
          const [, boundPort] = address.match(/:([0-9]+)$/);
          this.port = parseInt(boundPort, 10);
        }
        events.emit('onStart', this);
        resolve(true);
      });
    });
  }

  /**
   * stop a running proxy server. This method has no effect if the
   * server is not running.
   */
  async stop() {
    const { events, server, started } = this;

    if (!started) {
      return true;
    }

    await server.close();
    this.started = false;
    events.emit('onStop', this);

    return true;
  }
}

module.exports = Server;
