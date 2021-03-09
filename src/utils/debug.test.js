const debug = require('./debug');

describe('#debug', () => {
  it('exports a function', () => {
    expect(debug).toEqual(expect.any(Function));
  });
});
