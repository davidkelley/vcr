const fs = require('fs-extra');
const crypto = require('crypto');
const merge = require('deepmerge');
const punycode = require('punycode');
const path = require('path');
const { mainModule } = require('process');

const DEFAULT_IGNORE_HEADERS = ['host', 'user-agent'];

class Cache {
  constructor(method, host, pathname, parameters = {}, options = {}) {
    this.options = merge(
      {
        ignoreHeaders: DEFAULT_IGNORE_HEADERS,
      },
      options
    );

    this.request = Cache.sanitizeRequestParameters(
      {
        ...parameters,
        method,
        host,
        pathname,
      },
      options
    );

    this.signature = Cache.generateSignature(this.request);
  }

  get filepath() {
    const { storeDir, signature } = this;
    return path.join(storeDir, `${signature}.har`);
  }

  get storeDir() {
    const { outputDirectory } = Cache;
    const { host, pathname } = this.request;
    return path.join(outputDirectory, host, pathname);
  }

  read() {
    const { filepath } = this;
    return fs.readJsonSync(filepath);
  }

  store(obj) {
    const { filepath } = this;
    return fs.outputJsonSync(filepath, obj, { spaces: 2 });
  }

  isCached() {
    const { filepath } = this;
    return fs.pathExistsSync(filepath);
  }

  static sanitizeRequestParameters(
    { method, host, pathname, query = {}, headers, body = '' },
    { ignoreHeaders = [] }
  ) {
    return {
      method: method.toUpperCase(),
      host: punycode.toASCII(host).toLowerCase(),
      pathname: punycode.toASCII(pathname).toLowerCase(),
      body: Cache.generateSignature(body),
      query: Cache.sanitizeRequestObject(query),
      headers: Cache.sanitizeRequestObject(headers, ignoreHeaders),
    };
  }

  static generateSignature(sanitizedRequest) {
    const stringified = JSON.stringify(sanitizedRequest);
    const hash = crypto.createHash('sha256').update(stringified).digest('hex');
    return hash;
  }

  static sanitizeRequestObject(obj, filteredKeys = []) {
    const sanitizedObject = Object.entries(obj).map(([key, value]) => {
      const name = punycode.toASCII(key).toLowerCase();

      if (filteredKeys.includes(name)) {
        return null;
      }

      let resolvedValue;

      if (typeof value === 'object') {
        resolvedValue = JSON.stringify(value);
      } else {
        resolvedValue = punycode.toASCII(value.toString());
      }

      return {
        name,
        value: resolvedValue,
      };
    });

    const filteredObject = sanitizedObject
      .filter(Boolean)
      .sort(({ name: a }, { name: b }) => {
        return a.localeCompare(b);
      });

    return filteredObject;
  }
}

Cache.outputDirectory = path.join(process.cwd(), '__vcr__');

module.exports = Cache;
