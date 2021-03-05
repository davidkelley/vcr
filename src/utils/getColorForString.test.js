const { getColorForString } = require('./getColorForString');

describe('#getColorForString', () => {
  it('returns a valid color', () => {
    expect(getColorForString('test text')).toEqual(
      expect.stringMatching(/^\#[A-Z0-9]{6}$/)
    );
  });
});
