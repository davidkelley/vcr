const AJV = require('ajv');
const AjvErrors = require('better-ajv-errors');

const schema = require('./schema.json');

exports.validate = (data, options = {}) => {
  const ajv = new AJV.default(options);
  const validate = ajv.compile(schema);
  const valid = validate(data);

  if (!valid) {
    throw new Error(AjvErrors(schema, data, validate.errors));
  }

  return valid;
};
