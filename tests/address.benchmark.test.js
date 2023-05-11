import { getBlockByHeight, getBlock } from './utils.js'
import fs from 'fs'
import { BitcoinBlockStream } from '../index.js'

let start, end, start2, end2;
//get block without addressess
//get block with addressess
let promise = getBlockByHeight(750000)
    .then(block => {
        return getBlock(block.hash, 'hex')
            .then(bytes => {

                return new Promise(resolve => {
                    Promise.resolve()
                        .then(() => {
                            console.log('random block:', block.hash, 'height', block.height, 'tx', block.tx.length);
                            let hashes = [];
                            for (let i in block.tx) {
                                hashes.push(block.tx[i].hash);
                            }

                            return hashes
                        })
                        .then(hashes => {
                            let errors = [];
                            let blockhash = false;
                            let result = {};

                            fs.writeFileSync('./block-1', bytes);
                            let res = fs.createReadStream('./block-1', { highWaterMark: 1024 });
                            let r = new BitcoinBlockStream({
                                header: ['hash'],
                                tx: ['output.script']
                            }, {
                                highWaterMark: 1024
                            });


                            r.on('header', (header) => {

                                if (block.hash == header.hash) {
                                    blockhash = true;
                                } else
                                    errors.push('block');
                            });


                            r.on('tx', ({ tx, index }) => {
                                if (hashes.indexOf(tx.hash) != -1)
                                    result[index] = true;
                                else
                                    result[index] = false;
                            })

                            r.on('finish', () => {

                                //stop bench
                                end = Date.now();

                                console.log('just parser: ', end - start, 'ms');

                                for (let i in result) {
                                    if (!result[i]) {
                                        console.log('tx index: ', i, 'have invalid hash');
                                        errors.push(block.height + '/tx/' + i);
                                    }
                                }

                                fs.unlinkSync('./block-1');
                                resolve(errors);
                            })

                            //start bench
                            start = Date.now();
                            res.pipe(r);
                        })
                })
            })
    })



promise.then(() => {
    getBlockByHeight(750000)
        .then(block => {
            return getBlock(block.hash, 'hex')
                .then(bytes => {

                    return new Promise(resolve => {
                        Promise.resolve()
                            .then(() => {
                                console.log('random block:', block.hash, 'height', block.height, 'tx', block.tx.length);
                                let hashes = [];
                                for (let i in block.tx) {
                                    hashes.push(block.tx[i].hash);
                                }

                                return hashes
                            })
                            .then(hashes => {
                                let errors = [];
                                let blockhash = false;
                                let result = {};


                                fs.writeFileSync('./block-2', bytes);
                                let res = fs.createReadStream('./block-2', { highWaterMark: 1024 });

                                let r = new BitcoinBlockStream({
                                    header: ['hash'],
                                    tx: ['output.script']
                                }, {
                                    highWaterMark: 1024,
                                    address: true
                                });


                                r.on('header', (header) => {

                                    if (block.hash == header.hash) {
                                        blockhash = true;
                                    } else
                                        errors.push('block');
                                });


                                r.on('tx', ({ tx, index }) => {
                                    if (hashes.indexOf(tx.hash) != -1)
                                        result[index] = true;
                                    else
                                        result[index] = false;
                                })

                                r.on('finish', () => {

                                    //stop bench
                                    end2 = Date.now();

                                    console.log('parser + address builder: ', end2 - start2, 'ms');
                                    console.log('=====================');
                                    console.log('mark: ', (end2 - start2) - (end - start), 'ms');

                                    for (let i in result) {
                                        if (!result[i]) {
                                            console.log('tx index: ', i, 'have invalid hash');
                                            errors.push(block.height + '/tx/' + i);
                                        }
                                    }

                                    fs.unlinkSync('./block-2');
                                    resolve(errors);
                                })


                                //start bench
                                start2 = Date.now();
                                res.pipe(r);
                            })
                    })
                })
        })
})