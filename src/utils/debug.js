const { DEBUG } = process.env;

const debug = (message) => {
  if (!DEBUG || !DEBUG.includes('vcr')) {
    return;
  }
  console.log(message);
};

module.exports = debug;
