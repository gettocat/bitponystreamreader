const { BitcoinStreamModule } = require('./bitcoinstreammodule.js');
const { Uint64LE } = require('int64-buffer');
const { Writable } = require('stream');
const crypto = require('crypto');

module.exports.BitcoinStream = class BitcoinStream extends Writable {

    constructor(filter, opts, modules) {
        super(opts);

        if (modules) {
            for (let mod of modules) {
                if (!(mod instanceof BitcoinStreamModule))
                    continue;

                this.addModule(mod.type, mod.fn);
            }
        }

        this.bufferization = [];//only 8 bytes
        this.offset = 0;
        this.isFinish = false;
        this.hashing = true;
        this.hashStream = crypto.createHash('sha256');
        this.modules = {};

        if (opts.debug)
            this.debug = true;

        if (!filter) {
            filter = {
                header: "*",
                tx: "*"
            }
        }

        if (filter.header === '*') {
            filter.header = ['version', 'prevBlock', 'merkleRoot', 'timestamp', 'bits', 'nonce', 'txcount'];
        }

        if (filter.tx == '*') {
            filter.tx = ['version', 'lockTime', 'input.*', 'inputcount', 'output.*', 'outcount', 'witness', 'segwit', 'flags'];
        }

        if (filter.tx.indexOf('input.*') >= 0) {
            filter.tx.push('input.script');
            filter.tx.push('input.sequence');
            filter.tx.push('input.hash');
            filter.tx.push('input.index');
        }

        if (filter.tx.indexOf('output.*') >= 0) {
            filter.tx.push('output.script');
            filter.tx.push('output.amount');
        }

        this.filter = filter;

        this.on('byte', (byte) => {
            if (this.hashing)
                this.hashStream.write(byte);
        })
    }
    addType(typeName, { scan, read }) {
        if (!typeName || !scan || !read)
            throw new Error('Invalid parameters');

        if (this["_offset" + typeName] && this["_read" + typeName])
            throw new Error('Type ' + typeName + ' already exist');

        if (!(scan instanceof Function) || !(read instanceof Function)) {
            throw new Error('Invalid scan-read functions');
        }

        this["_offset" + typeName] = scan;
        this["_read" + typeName] = read;
    }
    addModule(typeName, handler) {
        if (!this.modules[typeName])
            this.modules[typeName] = [];

        this.modules[typeName].push(handler);
    }
    setEnterPoint(start) {
        this.state = start;
        this.length = 0;
        this.temp = null;
    }
    /* instant types */
    _offsetUint64(buffer) {
        return 8 - buffer.length;
    }
    _offsetUint32(buffer) {
        return 4 - buffer.length;
    }
    _offsetUint16(buffer) {
        return 2 - buffer.length;
    }
    _offsetUint8(buffer) {
        return 1 - buffer.length;
    }
    _offsetVarInt(buffer) {
        if (buffer[0] == 253) {
            return this._offsetUint16(buffer) + 1;
        } else if (buffer[0] == 254) {
            return this._offsetUint32(buffer) + 1;
        } else if (buffer[0] == 255) {
            return this._offsetUint64(buffer) + 1;
        } else {
            return this._offsetUint8(buffer);
        }
    }
    _offsetHash(buffer) {
        return 32 - buffer.length;
    }
    _offsetString(buffer) {
        let cnt = this._offsetVarInt(buffer);

        if (cnt > 0)
            return cnt;

        let num = this._readVarInt(buffer);

        return num + cnt;
    }
    //
    _readVarInt(buffer) {
        if (buffer[0] == 253) {
            return this._readUint16(buffer.slice(1, 4));
        } else if (buffer[0] == 254) {
            return this._readUint32(buffer.slice(1, 6));
        } else if (buffer[0] == 255) {
            return this._readUint64(buffer.slice(1, 10));
        } else {
            return this._readUint8(buffer);
        }
    }
    _readUint8(buffer) {
        return buffer[0];
    }
    _readUint16(buffer) {
        return buffer.readUInt16LE(0, true)
    }
    _readUint32(buffer) {
        return buffer.readUInt32LE(0, true)
    }
    _readUint64(buffer) {
        return new Uint64LE(buffer).toNumber(10);
    }
    _readChar(length, buffer) {
        return buffer.slice(0, length);
    }
    _readHash(buffer) {
        let buff = this._readChar(32, buffer);
        return this._reverseBuffer(buff).toString('hex');
    }
    _readString(buffer) {
        let cnt = this._offsetVarInt(buffer);
        return buffer.slice(buffer.length + cnt, buffer.length).toString('hex');
    }
    /* instant types */
    _writeByte(byte) {
        let n = byte.toString(16);
        if ((n.length % 2) > 0) {
            n = "0" + n;
        }
        return Buffer.from(n, 'hex');
    }
    _reverseBuffer(buffer) {
        let out_rev = Buffer.alloc(buffer.length), i = 0
        for (; i < buffer.length; i++) {
            out_rev[buffer.length - 1 - i] = buffer[i];
        }

        return out_rev;
    }
    _readByte(byte) {

        this._addByte(byte);

        let fn = this["_offset" + this.state];
        if (!fn instanceof Function)
            throw new Error('Invalid type, can not read ' + this.state);

        let { length, next } = fn.apply(this, [this.temp]);

        this.length = length;

        if (this.debug)
            console.log('state: ' + this.state, 'length: ' + length, 'next state: ' + next)

        if (!this.length || this.length < 0) {
            //last byte of current state = change state
            //add this byte to temp
            //change state
            this.length = 0;
            this._setNextState(next);
        }
        return length;

    }
    _addByte(byte) {

        if (!this.temp) {
            this.temp = Buffer.alloc(this.length);
        }

        let b = this._writeByte(byte);
        this.emit('byte', b);

        this.temp = Buffer.concat([
            this.temp,
            b
        ]);

        return ++this.offset;
    }
    _setNextState(nextstate) {
        let newstate = this._saveCurrentState();
        this.state = newstate ? newstate : nextstate;
        this.temp = null;
    }
    _saveCurrentState() {
        let newstate;
        let fn = this["_read" + this.state];

        if (!fn instanceof Function)
            throw new Error('Invalid type, can not read ' + this.state);

        newstate = fn.apply(this);

        if (this.modules[this.state]) {
            for (let h of this.modules[this.state]) {
                if (h instanceof Function)
                    h.apply(this, []);
            }
        }

        return newstate;
    }
    _write(chunk, encoding, callback) {

        for (let i = 0; i < chunk.length; i++) {
            let offset;

            let byte = chunk[i];
            if (i < 0) {
                byte = this.bufferization[this.bufferization.length - 1 + i];
            }

            if (!this.writableFinished && !this.writableEnded)
                offset = this._readByte(byte);

            if (i >= 0) {
                this.bufferization.push(byte)
                this.bufferization = this.bufferization.slice(-8);
            }

            if (this.state == 'end')
                return this.end();

            if (offset < 0)
                i += offset;
        }

        callback();
    }
}
