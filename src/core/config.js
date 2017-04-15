import fs from 'fs';
import winston from 'winston';
import {Utils} from '../utils';

export const DEFAULT_LOG_LEVEL = 'error';

export class Config {

  static init(json) {
    if (typeof json !== 'object' || Array.isArray(json)) {
      throw Error('Invalid configuration file');
    }

    // host

    if (typeof json.host !== 'string' || json.host === '') {
      throw Error('\'host\' must be provided and is not empty');
    }

    global.__LOCAL_HOST__ = json.host;

    // port

    if (!Utils.isValidPort(json.port)) {
      throw Error('\'port\' is invalid');
    }

    global.__LOCAL_PORT__ = json.port;

    // servers

    if (typeof json.servers !== 'undefined') {

      if (!Array.isArray(json.servers)) {
        throw Error('\'servers\' must be provided as an array');
      }

      if (json.servers.length < 1) {
        throw Error('\'servers\' must contain at least one item');
      }

      global.__SERVERS__ = json.servers.filter((server) => server.enabled === true);

      global.__IS_SERVER__ = false;
      global.__IS_CLIENT__ = true;
    } else {
      global.__IS_SERVER__ = true;
      global.__IS_CLIENT__ = false;
      this.initServer(json);
    }

    // redirect

    if (typeof json.redirect === 'string' && json.redirect !== '') {
      const address = json.redirect.split(':');
      if (address.length !== 2 || !Utils.isValidPort(+address[1])) {
        throw Error('\'redirect\' is an invalid address');
      }
    }

    global.__REDIRECT__ = json.redirect;

    // timeout

    if (typeof json.timeout !== 'number') {
      throw Error('\'timeout\' must be a number');
    }

    if (json.timeout < 1) {
      throw Error('\'timeout\' must be greater than 0');
    }

    if (json.timeout < 60) {
      console.warn(`==> [config] 'timeout' is too short, is ${json.timeout}s expected?`);
    }

    global.__TIMEOUT__ = json.timeout;

    // profile
    global.__PROFILE__ = !!json.profile;

    // watch
    global.__IS_WATCH__ = !!json.watch;

    // log_level
    global.__LOG_LEVEL__ = this.setUpLogger(json.log_level || DEFAULT_LOG_LEVEL);

    global.__ALL_CONFIG__ = json;
  }

  static initServer(server) {
    // key

    if (typeof server.key !== 'string') {
      throw Error('\'key\' must be a string');
    }

    if (server.key === '') {
      throw Error('\'key\' cannot be empty');
    }

    global.__KEY__ = server.key;

    // presets & presets' parameters

    if (!Array.isArray(server.presets)) {
      throw Error('\'presets\' must be an array');
    }

    if (server.presets.length < 1) {
      throw Error('\'presets\' must contain at least one preset');
    }

    for (const preset of server.presets) {
      const {name, params} = preset;

      if (typeof name === 'undefined') {
        throw Error('\'preset.name\' must be a string');
      }

      if (name === '') {
        throw Error('\'preset.name\' cannot be empty');
      }

      // 1. check for the existence of the preset
      const ps = require(`../presets/${preset.name}`).default;

      // 2. check parameters, but ignore the first preset
      if (name !== server.presets[0].name) {
        delete new ps(params || {});
      }
    }

    global.__PRESETS__ = server.presets;
  }

  static setUpLogger(level = '') {
    // create logs directory
    try {
      fs.lstatSync('logs');
    } catch (err) {
      if (err.code === 'ENOENT') {
        fs.mkdirSync('logs');
      }
    }

    // determine log level
    let _level = level.toLowerCase();
    switch (_level) {
      case 'silly':
      case 'debug':
      case 'verbose':
      case 'info':
      case 'warn':
      case 'error':
        break;
      default:
        _level = DEFAULT_LOG_LEVEL;
        break;
    }

    // configure transports
    winston.configure({
      level: _level,
      transports: [
        new (winston.transports.Console)({
          colorize: true,
          prettyPrint: true
        }),
        new (winston.transports.File)({
          filename: `logs/blinksocks-${__IS_CLIENT__ ? 'client' : 'server'}.log`,
          maxsize: 2 * 1024 * 1024, // 2MB
          silent: ['test', 'debug'].includes(process.env.NODE_ENV)
        })
      ]
    });
    return _level;
  }

}
