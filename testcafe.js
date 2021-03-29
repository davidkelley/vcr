const { start, stop } = require('.');

start();

process.on('exit', stop);