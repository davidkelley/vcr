const fs = require('fs-extra');
const crypto = require('crypto');
const merge = require('deepmerge');
const punycode = require('punycode');
const path = require('path');
const glob = require('glob');

const DEFAULT_IGNORE_HEADERS = ['host', 'user-agent'];

/**
 * The Cache class controls reading a cached response, based upon the signature of
 * a request. If a cached response does not exist, one is created from the response
 * once it is received.
 */
class Cache {
  constructor(method, host, pathname, parameters = {}, options = {}) {
    /**
     * Merge the options passed through with the default ignore headers
     */
    this.options = merge(
      {
        ignoreHeaders: DEFAULT_IGNORE_HEADERS,
      },
      options
    );

    /**
     * Sanitize the request object that is being used to build the cache signature
     */
    this.request = Cache.sanitizeRequestParameters(
      {
        ...parameters,
        method,
        host,
        pathname,
      },
      options
    );

    /**
     * Generate a request signature based upon the santized request structure
     */
    this.signature = Cache.generateSignature(this.request);
  }

  /**
   * Using the .storeDir and request signature, build the complete filepath that
   * will be used to store the cached HAR response file.
   */
  get filepath() {
    const { storeDir, signature } = this;
    return path.join(storeDir, `${signature}.har`);
  }

  /**
   * Determine the directory where cached HAR response files
   * will be stored. The directory path is the joined host and pathname.
   */
  get storeDir() {
    const { outputDirectory } = Cache;
    const { host, pathname } = this.request;
    return path.join(outputDirectory, host, pathname);
  }

  /**
   * Return all cached files for a particular host
   */
  all() {
    const { outputDirectory } = Cache;
    const { host } = this.request;

    return glob.sync(path.join(outputDirectory, host, '**/*'), {
      nodir: true,
    });
  }

  /**
   * Read a cached HAR response file.
   */
  read() {
    const { filepath } = this;
    return fs.readJsonSync(filepath);
  }

  /**
   * Store a HAR file using the filepath consiting of the pathname
   * and request signature.
   */
  store(obj) {
    const { filepath } = this;
    return fs.outputJsonSync(filepath, obj, { spaces: 2 });
  }

  /**
   * Returns true if the request is already cached, false otherwise.
   */
  isCached() {
    const { filepath } = this;
    return fs.pathExistsSync(filepath);
  }

  /**
   * Sanitize parts of the request that are used to build the signature. For example, this method
   * takes information like the HTTP method and ensures that its been uppercased.
   */
  static sanitizeRequestParameters(
    { method, host, pathname, query = {}, headers, body = '' },
    { ignoreHeaders = [], ignoreQueryParameters = [] }
  ) {
    return {
      method: method.toUpperCase(),
      host: punycode.toASCII(host).toLowerCase(),
      pathname: punycode.toASCII(pathname).toLowerCase(),
      body: Cache.generateSignature(body),
      query: Cache.sanitizeRequestObject(query, ignoreQueryParameters),
      headers: Cache.sanitizeRequestObject(headers, ignoreHeaders),
    };
  }

  /**
   * Take a request object and generate the signature using a JSON stringified
   * version of the request and return a hash digest.
   */
  static generateSignature(sanitizedRequest) {
    const stringified = JSON.stringify(sanitizedRequest);
    const hash = crypto.createHash('sha256').update(stringified).digest('hex');
    return hash;
  }

  /**
   * Take the keys and values of an object, sort them and return the sanitized
   * values for each property.
   */
  static sanitizeRequestObject(obj, filteredKeys = []) {
    /**
     * Take the object and return an array containing { name, value } objects
     * for each key.
     */
    const sanitizedArray = Object.entries(obj).map(([key, value]) => {
      /**
       * sanitize the string and lower case the key name
       */
      const name = punycode.toASCII(key).toLowerCase();

      /**
       * determine if the key needs to be filtered out
       */
      if (filteredKeys && filteredKeys.includes(name)) {
        return null;
      }

      let resolvedValue;

      /**
       * stringify any non-string value type and sanitize
       * a string value
       */
      if (typeof value === 'object') {
        resolvedValue = JSON.stringify(value);
      } else {
        resolvedValue = punycode.toASCII(value.toString());
      }

      /**
       * return the name and value pair for each key and value
       */
      return {
        name,
        value: resolvedValue,
      };
    });

    /**
     * Take the sanitized array object, filter null values and
     * sort the keys alphabetically.
     */
    const filteredObject = sanitizedArray
      .filter(Boolean)
      .sort(({ name: a }, { name: b }) => {
        return a.localeCompare(b);
      });

    return filteredObject;
  }
}

/**
 * Provide a default outputDirectory as a static property
 */
Cache.outputDirectory = path.join(process.cwd(), '__vcr__');

module.exports = Cache;
