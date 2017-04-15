import net from 'net';
import url from 'url';
import crypto from 'crypto';
import ip from 'ip';
import {
  ATYP_DOMAIN,
  ATYP_V4,
  ATYP_V6
} from '../proxies/common';

export const BYTE_ORDER_BE = 0;
export const BYTE_ORDER_LE = 1;

export class Utils {

  /**
   * convert a number to a buffer with specified length in big-endian
   * @param num
   * @param len
   * @param byteOrder
   * @returns {Buffer}
   */
  static numberToUInt(num, len = 2, byteOrder = BYTE_ORDER_BE) {
    if (len < 1) {
      throw Error('len must be greater than 0');
    }

    const isOutOfRange = num > parseInt(`0x${'ff'.repeat(len)}`);
    if (isOutOfRange) {
      throw Error(`Number ${num} is too long to store in a '${len}' length buffer`);
    }

    const buf = Buffer.alloc(len);
    if (byteOrder === BYTE_ORDER_BE) {
      buf.writeUIntBE(num, 0, len);
    } else {
      buf.writeUIntLE(num, 0, len);
    }
    return buf;
  }

  /**
   * convert an uri to Address
   * @param uri
   * @returns {{type: Number, host: Buffer, port: Buffer}}
   */
  static parseURI(uri) {
    let _uri = uri;
    if (_uri.indexOf('http') !== 0 && _uri.indexOf('https') !== 0) {
      if (_uri.indexOf(':443') !== -1) {
        // e.g, bing.com:443
        _uri = `https://${_uri}`;
      } else {
        // e.g, bing.com
        _uri = `http://${_uri}`;
      }
    }
    const {protocol, hostname} = url.parse(_uri);
    const addrType = net.isIP(hostname) ? (net.isIPv4(hostname) ? ATYP_V4 : ATYP_V6) : ATYP_DOMAIN;
    const port = {'http:': 80, 'https:': 443}[protocol];
    return {
      type: addrType,
      host: net.isIP(hostname) ? ip.toBuffer(hostname) : Buffer.from(hostname),
      port: this.numberToUInt(port)
    };
  }

  /**
   * returns a random integer in [min, max).
   * @param min
   * @param max
   * @returns {Number}
   */
  static getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min)) + min;
  }

  /**
   * verify hostname
   *
   * @param hostname
   * @returns {boolean}
   *
   * @reference
   *   http://stackoverflow.com/questions/1755144/how-to-validate-domain-name-in-php
   */
  static isValidHostname(hostname) {
    // overall length check
    if (hostname.length < 1 || hostname.length > 253) {
      return false;
    }
    // valid chars check
    if (/^([a-z\d](-*[a-z\d])*)(\.([a-z\d](-*[a-z\d])*))*$/i.test(hostname) === false) {
      return false;
    }
    // length of each label
    if (/^[^.]{1,63}(\.[^.]{1,63})*$/.test(hostname) === false) {
      return false;
    }
    return true;
  }

  /**
   * whether a port is valid or not
   * @param port
   * @returns {boolean}
   */
  static isValidPort(port) {
    if (typeof port !== 'number') {
      return false;
    }
    if (port < 0 || port > 65535) {
      return false;
    }
    return true;
  }

  /**
   * md5 message digest
   * @param buffer
   * @returns {*}
   */
  static md5(buffer) {
    const md5 = crypto.createHash('md5');
    md5.update(buffer);
    return md5.digest();
  }

  /**
   * EVP_BytesToKey with the digest algorithm set to MD5, one iteration, and no salt
   *
   * @algorithm
   *   D_i = HASH^count(D_(i-1) || data || salt)
   */
  static EVP_BytesToKey(password, keyLen, ivLen) {
    let _data = Buffer.from(password);
    let i = 0;
    const bufs = [];
    while (Buffer.concat(bufs).length < (keyLen + ivLen)) {
      if (i > 0) {
        _data = Buffer.concat([bufs[i - 1], Buffer.from(password)]);
      }
      bufs.push(this.md5(_data));
      i += 1;
    }
    return Buffer.concat(bufs).slice(0, keyLen);
  }

}
