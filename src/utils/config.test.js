const fs = require('fs-extra');

const { loadConfig } = require('./config');

const moduleName = 'foo';

describe('#loadConfig', () => {
  describe('when no config file is found', () => {
    it('throws an error', () => {
      expect(() => loadConfig(moduleName)).toThrow(/no .+ configuration file/i);
    });
  });

  describe('when the config file is invalid', () => {
    beforeEach(() => {
      fs.outputJSONSync('.foorc.json', {});
    });

    afterEach(() => {
      fs.unlinkSync('.foorc.json');
    });

    it('throws an error', () => {
      expect(() => loadConfig(moduleName)).toThrow(
        /should have required property/i
      );
    });
  });

  describe('when a config file is found', () => {
    beforeEach(() => {
      fs.outputJSONSync('.foorc.json', {
        extends: './extended.yml',
        servers: [
          {
            name: 'test',
            origin: 'https://google.com',
          },
        ],
      });
      fs.writeFileSync('extended.yml', 'snapshotsDir: "./.vcr"', 'utf8');
    });

    afterEach(() => {
      fs.unlinkSync('.foorc.json');
      fs.unlinkSync('extended.yml');
    });

    it('contains the correct config', () => {
      expect(loadConfig(moduleName)).toEqual(
        expect.objectContaining({
          snapshotsDir: './.vcr',
          servers: expect.arrayContaining([
            expect.objectContaining({
              name: 'test',
              origin: 'https://google.com',
            }),
          ]),
        })
      );
    });
  });
});
