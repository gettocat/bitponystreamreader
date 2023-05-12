const { BitcoinStreamModule } = require("../bitcoinstreammodule.js");
const hash = require('hash.js');
const base58 = require('base-58');
const crypto = require('crypto');
const { bech32, bech32m } = require('bech32');

let createAddress = (buffer, type) => {
    let sha256 = function (message, output) {
        if (!output)
            output = '';
        return crypto.createHash('sha256').update(message).digest(output);
    }

    if (type == 'P2PKH' || type == 'P2SH') { //it is okay
        let network = '00';

        if (type == 'P2SH')
            network = '05';

        let keyh1 = Buffer.from(buffer, 'hex');
        let keyhash = sha256(Buffer.concat([
            Buffer.from(network, 'hex'),
            keyh1
        ]));

        let checksum = sha256(keyhash).slice(0, 4);
        return base58.encode(Buffer.from(network + keyh1.toString('hex') + checksum.toString('hex'), 'hex'));
    }


    if (!type || type == 'P2PK') { //it is okay
        let network = '00';
        let k = Buffer.concat([
            Buffer.from(network, 'hex'),
            Buffer.from(hash.ripemd160().update(sha256(buffer)).digest())
        ]);
        let keyhash = sha256(sha256(k));
        let checksum = keyhash.slice(0, 4);

        return base58.encode(Buffer.from(k.toString('hex') + checksum.toString('hex'), 'hex'));
    }

    if (type == 'P2WPKH' || type == 'P2WSH' || type == 'P2TR') {
        let pack = bech32;
        if (type == 'P2TR')
            pack = bech32m;
        //https://stackoverflow.com/questions/63670096/how-to-generate-bech32-address-from-the-public-key-bitcoin
        const keyhash = buffer.length == 20 || buffer.length == 32 ? buffer : hash.ripemd160().update(sha256(buffer)).digest()
        const bech32Words = pack.toWords(Buffer.from(keyhash, "hex"));
        const words = new Uint8Array([type == 'P2TR' ? 1 : 0, ...bech32Words]);
        return pack.encode('bc', words);
    }

    //p2tr todo.
}


let scriptToAddress = (script) => {
    //https://www.reddit.com/r/Bitcoin/comments/jmiko9/a_breakdown_of_bitcoin_standard_script_types/
    //https://en.bitcoin.it/wiki/List_of_address_prefixes
    let scr = Buffer.from(script, 'hex');
    let address;
    let address_source;
    let type;

    if (Buffer.concat([
        Buffer.from([scr[0]]),
        Buffer.from([scr[1]]),
        Buffer.from([scr[scr.length - 1]])
    ]).toString('hex') == '4104ac') {
        type = 0;
        let key = scr.slice(1, scr.length - 1);

        address_source = key;
        address = createAddress(key, 'P2PK');
    }

    if (scr.length == 35 && Buffer.concat([
        Buffer.from([scr[0]]),
        Buffer.from([scr[34]])
    ]).toString('hex') == '21ac') {
        //script to pubkey pay
        //b58_encode(pfx + hash160(spk[1:34]))
        type = 0;
        address_source = scr.slice(1, 34);
        address = createAddress(address_source, 'P2PK');
    }

    if (scr.length === 25 && Buffer.concat([scr.slice(0, 3), scr.slice(23, 25)]).toString('hex') == '76a91488ac') {
        //pay to publickeyhash
        //b58_encode(pfx + spk[3:23])
        type = 1;
        address_source = scr.slice(3, 23);
        address = createAddress(scr.slice(3, 23), 'P2PKH');
    }

    if (scr.length === 23 && Buffer.concat([scr.slice(0, 2), Buffer.from([scr[22]])]).toString('hex') == 'a91487') {
        //Pay to Script Hash
        //it also can be P2SH-P2WPKH or P2SH-P2WSH but it is not our problem right now.
        //b58_encode(pfx + spk[2:22])
        type = 2;
        address_source = scr.slice(2, 22);
        address = createAddress(address_source, 'P2SH');
    }

    if (scr.length == 22 && scr.slice(0, 2).toString('hex') == '0014') {
        //Pay to Witness Public Key Hash
        //b32_encode(pfx + spk[2:22])
        type = 3;
        address_source = scr.slice(2, 22);
        address = createAddress(address_source, 'P2WPKH');
    }

    if (scr.length == 34 && scr.slice(0, 2).toString('hex') == '0020') {//OP0
        //Pay to Witness Script Hash
        //b32_encode(pfx + spk[2:34])
        type = 4;
        address_source = scr.slice(2, 34);
        address = createAddress(address_source, 'P2WSH');
    }

    if (scr.length == 34 && scr.slice(0, 2).toString('hex') == '5120') {//OP1
        type = 5;
        address_source = scr.slice(2, 34);
        address = createAddress(address_source, 'P2TR');
    }

    //also multisign

    if (scr[0] == 106) {
        type = -1;
        address_source = scr;
        address = 'OP_RETURN';
        //op return, do nothing.
    }

    return {
        type,
        address,
        source: address_source //BLOB
    }
}

module.exports.BitcoinStreamAddressModule = class BitcoinStreamAddressModule extends BitcoinStreamModule {
    constructor() {
        super('txout_script', 'address', function () {
            this.tx.out[this.readOut - 1].address = scriptToAddress(this.tx.out[this.readOut - 1].script);
        });
    }
}