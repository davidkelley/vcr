const Theme = require('.');

describe('Theme', () => {
  it('exports the correct object', () => {
    expect(Theme).toEqual(
      expect.objectContaining({
        colors: expect.objectContaining({
          success: expect.any(String),
        }),
      })
    );
  });
});
