import https from 'https';
import fs from 'fs';
import { BitcoinBlockStream } from '../index.js'

export function getLastBlockHeight() {

    return new Promise((resolve, reject) => {
        https.request({
            host: 'blockchain.info',
            path: '/latestblock'
        }, function (resp) {
            let data = "";
            resp.on('data', function (chunk) {
                data += chunk;
            });

            resp.on('end', function () {

                try {
                    let json = JSON.parse(data);
                    // do something with JSON

                    resolve(json.height);

                } catch (error) {
                    reject(error)
                }

            });

        }).end();
    })
}

export function getBlockByHeight(height, format) {
    if (!format)
        format = 'json';

    return new Promise((resolve, reject) => {
        https.request({
            host: 'blockchain.info',
            path: '/block-height/' + height + '?format=' + format
        }, function (resp) {
            let data = "";
            resp.on('data', function (chunk) {
                data += chunk;
            });

            resp.on('end', function () {

                try {
                    if (format == 'hex') {
                        resolve(Buffer.from(data, 'hex'));
                    } else {
                        let json = JSON.parse(data);
                        // do something with JSON

                        resolve(json.blocks[0]);
                    }
                } catch (error) {
                    reject(error)
                }

            });

        }).end();
    })
}

export function getBlock(hash, format) {
    if (!format)
        format = 'json';

    return new Promise((resolve, reject) => {
        https.request({
            host: 'blockchain.info',
            path: '/rawblock/' + hash + '?format=' + format
        }, function (resp) {
            let data = "";
            resp.on('data', function (chunk) {
                data += chunk;
            });

            resp.on('end', function () {

                try {
                    if (format == 'hex') {
                        resolve(Buffer.from(data, 'hex'));
                    } else {
                        let json = JSON.parse(data);
                        // do something with JSON

                        resolve(json);
                    }
                } catch (error) {
                    reject(error)
                }

            });

        }).end();
    })
}

export function testBlockAddressOuts(num) {
    let addrVersionTested = {};
    let txhashes = [];
    let origs = {};
    let out = {};
    let adrs_res = {};
    let final_res = true;

    let hash;

    return getBlockByHeight(num)
        .then((block) => {

            hash = block.hash;
            return getBlock(block.hash, 'hex')
                .then(bytes => {

                    return new Promise(resolve => {
                        Promise.resolve()
                            .then(() => {

                                for (let i in block.tx) {
                                    origs[i] = block.tx[i].out;
                                }

                                return origs
                            })
                            .then(hashes => {

                                //we need make stream of bytes from bytes array
                                fs.writeFileSync('./block' + num, bytes);
                                let res = fs.createReadStream('./block' + num, { highWaterMark: 1024 });

                                let r = new BitcoinBlockStream({
                                    header: ['*'],
                                    tx: ['*']
                                }, {
                                    address: true,
                                    highWaterMark: 1024
                                });


                                r.on('tx', ({ tx, index }) => {
                                    out[index] = tx.out;
                                    txhashes[index] = tx.hash;
                                })

                                r.on('finish', () => {
                                    //console.log(out, origs)
                                    for (let tx_index in out) {

                                        for (let o in out[tx_index]) {
                                            if (!adrs_res[tx_index])
                                                adrs_res[tx_index] = [];

                                            let r = origs[tx_index][o].addr == out[tx_index][o].address.address;
                                            if (out[tx_index][o].address.type == -1)
                                                r = true;//OP_RETURN is true everytime
                                            adrs_res[tx_index][o] = (r).toString() + "" + out[tx_index][o].address.type;

                                            if (!r) {
                                                final_res = false;
                                                addrVersionTested[out[tx_index][o].address.type] = false;
                                                console.log('txHash', txhashes[tx_index], 'txIndex', tx_index, 'outIndex', o, out[tx_index][o].script, origs[tx_index][o].addr, out[tx_index][o].address);
                                            } else
                                                addrVersionTested[out[tx_index][o].address.type] = true;
                                        }
                                    }

                                    resolve({ hash: hash, number: num, result: final_res, matrix: adrs_res, addrVersionTested });
                                    fs.unlinkSync('./block' + num)
                                })

                                res.pipe(r);
                            })
                    })
                })

        })
}