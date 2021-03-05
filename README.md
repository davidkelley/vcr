# VCR 📼 <!-- omit in toc -->

Record, save and replay HTTP requests to one or more back-end APIs. Useful for building up stubbed data for your integration tests. Configuring VCR is easy and creating recorded requests is as simple as browsing your application.

Cached requests are stored locally as HTTP Archive Format (HAR) files, so they can be easily inspected, modified and replayed with lots of other applications.

- [⏱ Getting Started](#-getting-started)
  - [Cypress](#cypress)
- [⏺ Record HTTP Requests](#-record-http-requests)
- [⏯ Play HTTP Requests](#-play-http-requests)
- [🔀 Replay HTTP Requests](#-replay-http-requests)

## ⏱ Getting Started

Install the library:

```
npm i @simplenode/vcr -D
```

Once the library has been installed, create a `.vcrrc.js` file in your project and add the back-end APIs you use to the file:

```js
module.exports = {
  // snapshots are stored under this directory, relative to the root
  // of your project
  snapshotsDir: './__vcr__',
  // you can define one or more back-end APIs:
  servers: [
    {
      // a recognisable name for the API
      name: 'Example API',
      // the URL to the destination that VCR is proxying.
      //
      // note: pathnames are not currently supported in the origin. Pathnames should be passed
      // through to the proxy from the caller.
      origin: 'https://example.com',
      // a port to serve the proxy on
      port: 56845,
      // (OPTIONAL) the host to bind the server to
      host: 'localhost',
      options: {
        // ignore specfic headers when generating the signature for a request.
        // This is particularly useful if your application uses different values
        // for specific headers in each request, such as a request ID.
        ignoreHeaders: ['x-dynamic-correlation-id'],
      },
    },
  ],
};
```

The library uses [cosmiconfig](https://www.npmjs.com/package/cosmiconfig), so configuration files can be created in a number of different languages and locations.

After configuring your APIs, you now need to alter any environment variables that set the location of your back-end APIs. For example:

```
BACK_END_API=https://example.com/path/to/location
```

Would become:

```
BACK_END_API=http://localhost:56845
```

You're now ready to begin recording requests to your back-end APIs. Use `vcr record` from the command line to start the proxying requests.

Once VCR starts, simply browse your application as normal. You should start to see requests being proxied to your back-end APIs, multiple identical requests will be served from the cached HAR files, whilst new requests are proxied and cached.

As an example, using `curl http://localhost:56845/products?a=1` would create a HAR file in your project with the path `./__vcr__/example.com/path/to/location/products/3456ygfdw34.....56ygf.har`.

### Cypress

VCR can easily be integrated with Cypress, simply add the following to the top of your Cypress plugins file (`cypress/plugins/index.js`):

```js
require('vcr/cypress');
```

When Cypress starts, VCR will automatically start using the configuration file you've provided.

## ⏺ Record HTTP Requests

When recording, requests are proxied to your back-end application. Load and "use" your application as normal; each request will be cached locally as HAR files and identical requests will be served from the cached HAR file.

`vcr record`

## ⏯ Play HTTP Requests

When using VCR in `play` mode, requests are not proxied to your back-end application, any requests that are not cached return a status code 501 (Not Implemented).

`vcr play` || `vcr`

## 🔀 Replay HTTP Requests

Once the cached requests become "stale" and you need to refresh the data, simply use `reply` and it will update each cached HAR file by sending a request to your back-end application.

`vcr replay`
