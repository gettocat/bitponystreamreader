const { BitcoinStream } = require("./bitcoinstream.js");
const { BitcoinStreamAddressModule } = require('./modules/address.js')
const { BitcoinStreamOrdModule, BitcoinStreamOrdWitnessModule } = require('./modules/ords.js')
const crypto = require('crypto');

module.exports.BitcoinTxStream = class BitcoinTxStream extends BitcoinStream {

    constructor(filter, opts, moduleList) {
        super(filter, opts, moduleList);

        if (opts.address) {

            if (this.filter.tx.indexOf('output.script') == -1)
                throw new Error('Filter output.script must be enabled for address builder module');

            let mod = new BitcoinStreamAddressModule();
            this.addModule(mod.type, mod.fn);
        }

        if (opts.ords) {
            if (this.filter.tx.indexOf('input.script') == -1 || this.filter.tx.indexOf('witness') == -1)
                throw new Error('Filter input.script and witness must be enabled for ords builder module');

            let mod = new BitcoinStreamOrdModule();
            this.addModule(mod.type, mod.fn);

            let mod2 = new BitcoinStreamOrdWitnessModule();
            this.addModule(mod2.type, mod2.fn);
        }

        this.whashing = true;
        this.whashStream = crypto.createHash('sha256');

        this.segwit = false;

        this.state = 'tx_version';
        this.temp = null;
        this.length = 0;

        this.incount = 0;
        this.readIn = 0;
        this.outcount = 0;
        this.readOut = 0;

        this.witness = 0;
        this.readWitnessArray = 0;
        this.readWitnessArrayCnt = [];
        this.readWitness = 0;

        this.writeIn = 0;
        this.writeOut = 0;

        this.tx = { in: [], out: [], witness: [] };

        this.on('byte', (byte) => {
            if (this.whashing) {
                this.whashStream.write(byte);
            }
        })

        this.setEnterPoint('tx_version');
        this.addType('tx_version', {
            scan: (buff) => {
                return { length: this._offsetUint32(buff), next: 'flags' };
            },
            read: () => {
                this.hashing = false;

                if (this.debug)
                    console.log('tx_version', this.temp);

                if (this.filter.tx.indexOf('version') != -1)
                    this.tx.version = this._readUint32(this.temp);
            }
        });

        //here we need read 2 bytes of flags. 
        //If they 0x0 && 0x1 - then its segwit tx - next byte is txin_count, 
        //else - legacy, we need keep this bytes to txin_count, 
        //also txin_count can be 1 byte, so, we need to keep this 1 byte to next state
        this.addType('flags', {
            scan: (buff) => {
                if (buff.length == 1) {
                    if (buff[0] != 0x00) {
                        //next state, legacy tx 100%
                        //-1 bytes
                        //update state
                        return { length: -1, next: 'txin_count' };
                    } else {
                        return { length: 1 };// one more byte need
                    }
                }

                if (buff.length == 2) {
                    if (buff[0] === 0 && buff[1] === 1) {
                        //next state, its segwit tx
                        return { length: 0, next: 'txin_count' };
                    } else {
                        //-2 bytes, its legacy tx
                        return { length: -2, next: 'txin_count' };
                    }
                }
            },
            read: () => {
                if (this.temp[0] == 0x0 && this.temp[1] == 0x1)
                    this.segwit = true;

                if (this.filter.tx.indexOf('flags') != -1)
                    this.tx.flags = this.temp.toString('hex');

                if (this.filter.tx.indexOf('segwit') != -1)
                    this.tx.segwit = this.segwit;


                if (this.debug)
                    console.log('flags', this.temp);

                this.hashing = true;
            }
        });

        this.addType('txin_count', {
            scan: (buff) => {
                return { length: this._offsetVarInt(buff), next: 'txin_hash' }//after script need to check next state correctly
            },
            read: () => {
                let n = this._readVarInt(this.temp);
                if (this.filter.tx.indexOf('incount') != -1)
                    this.tx.incount = n;

                this.incount = n;

                if (this.debug)
                    console.log('txin_count', this.temp);
            }
        });

        this.addType('txin_hash', {
            scan: (buff) => {
                return { length: this._offsetHash(buff), next: 'txin_index' }
            },
            read: () => {
                if (this.filter.tx.indexOf('input.hash') != -1) {
                    if (!this.tx.in[this.writeIn])
                        this.tx.in[this.writeIn] = {};

                    this.tx.in[this.writeIn].hash = this._readHash(this.temp);
                }

                if (this.debug)
                    console.log('txin_hash', this.writeIn, this.temp);
            }
        });

        this.addType('txin_index', {
            scan: (buff) => {
                return { length: this._offsetUint32(buff), next: 'txin_script' }
            },
            read: () => {
                if (this.filter.tx.indexOf('input.index') != -1) {
                    if (!this.tx.in[this.writeIn])
                        this.tx.in[this.writeIn] = {};

                    this.tx.in[this.writeIn].index = this._readUint32(this.temp);
                }

                if (this.debug)
                    console.log('txin_hash', this.writeIn, this.temp);
            }
        });

        this.addType('txin_script', {
            scan: (buff) => {
                return { length: this._offsetString(buff), next: 'txin_sequence' }
            },
            read: () => {
                if (this.filter.tx.indexOf('input.script') != -1) {
                    if (!this.tx.in[this.writeIn])
                        this.tx.in[this.writeIn] = {};

                    this.tx.in[this.writeIn].script = this._readString(this.temp);
                }

                if (this.debug)
                    console.log('txin_script', this.writeIn, this.temp);
            }
        });

        this.addType('txin_sequence', {
            scan: (buff) => {
                return { length: this._offsetUint32(buff), next: 'txout_count' }//after script need to check next state correctly
            },
            read: () => {
                this.readIn++;

                if (this.filter.tx.indexOf('input.sequence') != -1) {
                    if (!this.tx.in[this.writeIn])
                        this.tx.in[this.writeIn] = {};

                    this.tx.in[this.writeIn].sequence = this._readUint32(this.temp);
                }

                if (this.debug)
                    console.log('txin_sequence', this.writeIn, this.temp);

                if (this.readIn < this.incount) {
                    this.writeIn++;
                    return 'txin_hash';
                }
            }
        });

        this.addType('txout_count', {
            scan: (buff) => {
                return { length: this._offsetVarInt(buff), next: 'txout_amount' }//after script need to check next state correctly
            },
            read: () => {
                let n = this._readVarInt(this.temp);
                if (this.filter.tx.indexOf('outcount') != -1)
                    this.tx.outcount = n;

                this.outcount = n;

                if (this.debug)
                    console.log('txout_count', this.temp);
            }
        });

        this.addType('txout_amount', {
            scan: (buff) => {
                return { length: this._offsetUint64(buff), next: 'txout_script' }
            },
            read: () => {
                if (this.filter.tx.indexOf('output.amount') != -1) {
                    if (!this.tx.out[this.writeOut])
                        this.tx.out[this.writeOut] = {};

                    this.tx.out[this.writeOut].amount = this._readUint64(this.temp);
                }

                if (this.debug)
                    console.log('txout_amount', this.writeOut, this.temp);
            }
        });

        this.addType('txout_script', {
            scan: (buff) => {
                return { length: this._offsetString(buff), next: this.segwit ? 'witness_cnt' : 'time_lock' }
            },
            read: () => {
                if (this.filter.tx.indexOf('output.script') != -1) {
                    if (!this.tx.out[this.writeOut])
                        this.tx.out[this.writeOut] = {};

                    this.tx.out[this.writeOut].script = this._readString(this.temp);
                }

                if (this.debug)
                    console.log('txout_script', this.writeOut, this.temp);

                this.readOut++;
                if (this.readOut < this.outcount) {
                    this.writeOut++;
                    return 'txout_amount';
                } else
                    if (this.segwit)
                        this.hashing = false;
            }
        });

        this.addType('witness_cnt', {
            scan: (buff) => {
                return { length: this._offsetVarInt(buff), next: 'witness' };
            },
            read: () => {
                this.readWitnessArray++;
                let num = this._readVarInt(this.temp);
                this.readWitnessArrayCnt[this.readWitnessArray] = num;

                if (this.debug)
                    console.log('witness_cnt', this.temp);

                if (num == 0) {

                    let next = 'witness_cnt';
                    if (this.readWitnessArray >= this.incount) {
                        this.hashing = true;
                        next = 'time_lock';
                    }

                    if (this.filter.tx.indexOf('witness') != -1) {
                        if (!this.tx.witness[this.readWitnessArray - 1])
                            this.tx.witness[this.readWitnessArray - 1] = [];
                    }

                    return next;
                }

                this.witness += num;
            }
        });

        this.addType('witness', {
            scan: (buff) => {
                let length = this._offsetString(buff);
                if (length == 0) {
                    this.readWitness++;
                    let next = 'witness';

                    if (this.readWitness >= this.witness) {
                        if (this.readWitnessArray >= this.incount) {
                            next = 'time_lock';
                            this.hashing = true;
                        } else
                            next = 'witness_cnt';

                    }

                    return { length, next };
                }

                return { length, next: 'witness' }
            },
            read: () => {
                if (this.filter.tx.indexOf('witness') != -1) {
                    if (!this.tx.witness[this.readWitnessArray - 1])
                        this.tx.witness[this.readWitnessArray - 1] = [];

                    this.tx.witness[this.readWitnessArray - 1].push(this._readString(this.temp));

                    if (this.debug)
                        console.log('witness', this.readWitnessArray - 1, this.tx.witness[this.readWitnessArray - 1].length, this.temp);
                }
            }
        });

        this.addType('time_lock', {
            scan: (buff) => {
                return { length: this._offsetUint32(buff), next: 'end' }//after script need to check next state correctl
            },
            read: () => {
                if (this.filter.tx.indexOf('lockTime') != -1)
                    this.tx.lockTime = this._readUint32(this.temp);

                if (this.debug)
                    console.log('time_lock', this.temp);

                this.hashStream.end();
                this.whashStream.end();

                this.hash = this.tx.hash = this._reverseBuffer(crypto.createHash('sha256')
                    .update(this.hashStream.digest())
                    .digest()).toString('hex');

                this.whash = this.tx.whash = this._reverseBuffer(crypto.createHash('sha256')
                    .update(this.whashStream.digest())
                    .digest()).toString('hex');

                this.emit('tx', this.tx);
            }
        });

    }
}