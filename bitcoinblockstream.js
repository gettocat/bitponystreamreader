const { BitcoinStream } = require("./bitcoinstream.js");
const { BitcoinTxStream } = require("./bitcointxstream.js");
const crypto = require('crypto');

module.exports.BitcoinBlockStream = class BitcoinBlockStream extends BitcoinStream {

    constructor(filter, opts, moduleList) {
        super(filter, opts, moduleList);

        this._modules = moduleList || [];
        this.opts = opts;
        this.state = 'version';
        this.temp = null;
        this.length = 0;
        this.offset = 0;
        this.txcount = 0;
        this.header = {};
        this.txs = [];

        this.readTx = 0;
        this._tx = null;

        this.setEnterPoint('version');
        this.addType('version', {
            scan: (buff) => {
                return { length: this._offsetUint32(buff), next: 'prev_block' };
            },
            read: () => {
                if (this.filter.header.indexOf('version') != -1)
                    this.header.version = this._readUint32(this.temp);
            }
        });

        this.addType('prev_block', {
            scan: (buff) => {
                return { length: this._offsetHash(buff), next: 'merkle_root' };
            },
            read: () => {
                if (this.filter.header.indexOf('prevBlock') != -1)
                    this.header.prevBlock = this._readHash(this.temp);
            }
        });

        this.addType('merkle_root', {
            scan: (buff) => {
                return { length: this._offsetHash(buff), next: 'timestamp' };
            },
            read: () => {
                if (this.filter.header.indexOf('merkleRoot') != -1)
                    this.header.merkleRoot = this._readHash(this.temp);
            }
        });

        this.addType('timestamp', {
            scan: (buff) => {
                return { length: this._offsetUint32(buff), next: 'bits' };
            },
            read: () => {
                if (this.filter.header.indexOf('timestamp') != -1)
                    this.header.timestamp = this._readUint32(this.temp);
            }
        });

        this.addType('bits', {
            scan: (buff) => {
                return { length: this._offsetUint32(buff), next: 'nonce' };
            },
            read: () => {
                if (this.filter.header.indexOf('bits') != -1)
                    this.header.bits = this._readUint32(this.temp);
            }
        });

        this.addType('nonce', {
            scan: (buff) => {
                return { length: this._offsetUint32(buff), next: 'txcount' };
            },
            read: () => {
                //stop hash
                if (this.filter.header.indexOf('nonce') != -1)
                    this.header.nonce = this._readUint32(this.temp);
                this.hashStream.end();

                this.hash = this._reverseBuffer(crypto.createHash('sha256')
                    .update(this.hashStream.digest())
                    .digest()).toString('hex');

                this.header.hash = this.hash;
                this.hashing = false;
                this.hashStream = null;
            }
        });

        this.addType('txcount', {
            scan: (buff) => {
                return { length: this._offsetVarInt(buff), next: 'tx' };
            },
            read: () => {
                this.txcount = this._readVarInt(this.temp);
                if (this.filter.header.indexOf('txcount') != -1)
                    this.header.txcount = this.txcount;

                this.emit('header', this.header);
            }
        });

        this.addType('tx', {
            scan: (buff) => {
                let lastbyte = buff[buff.length - 1];
                let next;
                if (this.readTx < this.txcount) {
                    next = 'tx';
                } else
                    next = 'end';

                if (!this._tx) {
                    //this.opts.debug = true;
                    //this.opts.highWaterMark = 1;
                    this._tx = new BitcoinTxStream(this.filter, this.opts, this._modules);
                    this._tx.on('tx', (tx) => {
                        let index = this.readTx;
                        this.emit('tx', { tx, index });
                    })
                }

                if (!this._tx.writableFinished && !this._tx.writableEnded)
                    this._tx.write(Buffer.from([lastbyte]));

                return { length: (this._tx.writableFinished || this._tx.writableEnded) ? 0 : 1, next };
            },
            read: () => {
                this.txs.push(this._tx.tx);
                //console.log('tx len', this.readTx, this._tx.tx);
                this.readTx++;
                this._tx = null;
            }
        });

    }
}