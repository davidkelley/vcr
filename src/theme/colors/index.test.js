const Colors = require('.');

describe('Colors', () => {
  it('exports the correct colors', () => {
    expect(Colors).toEqual(
      expect.objectContaining({
        primary: expect.stringMatching(/^\#[A-Z0-9]+$/),
        secondary: expect.stringMatching(/^\#[A-Z0-9]+$/),
        success: expect.stringMatching(/^\#[A-Z0-9]+$/),
        warning: expect.stringMatching(/^\#[A-Z0-9]+$/),
        danger: expect.stringMatching(/^\#[A-Z0-9]+$/),
        getStatusColor: expect.any(Function),
      })
    );
  });

  describe('#getStatusColor', () => {
    it('returns the correct colors for the status', () => {
      expect(Colors.getStatusColor(200)).toBe(Colors.success);
      expect(Colors.getStatusColor(201)).toBe(Colors.success);
      expect(Colors.getStatusColor(400)).toBe(Colors.warning);
      expect(Colors.getStatusColor(404)).toBe(Colors.warning);
      expect(Colors.getStatusColor(500)).toBe(Colors.danger);
    });
  });
});
