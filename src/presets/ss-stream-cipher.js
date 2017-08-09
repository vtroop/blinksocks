import crypto from 'crypto';
import {EVP_BytesToKey} from '../utils';
import {IPreset} from './defs';

const IV_LEN = 16;

// available ciphers
const ciphers = [
  // both supported
  'aes-128-ctr', 'aes-192-ctr', 'aes-256-ctr',
  'aes-128-cfb', 'aes-192-cfb', 'aes-256-cfb',
  'camellia-128-cfb', 'camellia-192-cfb', 'camellia-256-cfb'
];

/**
 * @description
 *   Perform encrypt/decrypt using Node.js 'crypto' module(OpenSSL wrappers).
 *
 * @params
 *   method: A cipher picked from OpenSSL library.
 *
 * @examples
 *   {
 *     "name": "ss-stream-cipher",
 *     "params": {
 *       "method": "aes-256-cfb"
 *     }
 *   }
 *
 * @protocol
 *
 *   # TCP stream
 *   +-------+---------------------+---------+
 *   |  IV   |       PAYLOAD       |   ...   |
 *   +-------+---------------------+---------+
 *   | Fixed |      Variable       |   ...   |
 *   +-------+---------------------+---------+
 *
 *   # TCP chunks
 *   +---------------------+
 *   |       PAYLOAD       |
 *   +---------------------+
 *   |      Variable       |
 *   +---------------------+
 *
 * @explain
 *   1. Key derivation function is EVP_BytesToKey.
 *   2. IV is plaintext.
 *   3. Client Cipher IV = Server Decipher IV, vice versa.
 *
 * @reference
 *   [1] EVP_BytesToKey
 *       https://www.openssl.org/docs/man1.0.2/crypto/EVP_BytesToKey.html
 *       https://github.com/shadowsocks/shadowsocks/blob/master/shadowsocks/cryptor.py#L53
 */
export default class SsStreamCipherPreset extends IPreset {

  _cipherName = '';

  _key = null;

  _cipher = null;

  _decipher = null;

  constructor({method}) {
    super();
    if (typeof method !== 'string' || method === '') {
      throw Error('\'method\' must be set');
    }
    if (!ciphers.includes(method)) {
      throw Error(`method '${method}' is not supported.`);
    }
    this._cipherName = method;
    if (global.__KEY__) {
      this._key = EVP_BytesToKey(__KEY__, this._cipherName.split('-')[1] / 8, IV_LEN);
    }
  }

  beforeOut({buffer}) {
    if (!this._cipher) {
      const iv = crypto.randomBytes(IV_LEN);
      this._cipher = crypto.createCipheriv(this._cipherName, this._key, iv);
      return Buffer.concat([iv, this.encrypt(buffer)]);
    } else {
      return this.encrypt(buffer);
    }
  }

  beforeIn({buffer, fail}) {
    if (!this._decipher) {
      if (buffer.length < IV_LEN) {
        return fail(`cannot get iv, buffer is too short(${buffer.length}bytes): ${buffer.toString('hex')}`);
      }
      const iv = buffer.slice(0, IV_LEN);
      this._decipher = crypto.createDecipheriv(this._cipherName, this._key, iv);
      return this.decrypt(buffer.slice(IV_LEN));
    } else {
      return this.decrypt(buffer);
    }
  }

  encrypt(buffer) {
    return this._cipher.update(buffer);
  }

  decrypt(buffer) {
    return this._decipher.update(buffer);
  }

}
