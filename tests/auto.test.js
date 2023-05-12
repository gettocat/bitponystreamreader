const fs = require('fs');
const { BitcoinBlockStream } = require('../index.js')
const { getBlockByHeight, getLastBlockHeight, getBlock } = require('./utils.js')

const N = 10;//check 10 random blocks

//get last block
//get {random} from 0 to last block
//get {random} block data

//get header from stream
//check block hash
//check all tx hash


function checkRandomBlock(height) {

    let rand = Math.floor(Math.random() * height);
    return getBlockByHeight(rand)
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

                                fs.writeFileSync('./block' + block.height, bytes);
                                let res = fs.createReadStream('./block' + block.height, { highWaterMark: 1024 });

                                let r = new BitcoinBlockStream({
                                    header: ['hash'],
                                    tx: ['hash']
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
                                    for (let i in result) {
                                        if (!result[i]) {
                                            console.log('tx index: ', i, 'have invalid hash');
                                            errors.push(block.height + '/tx/' + i);
                                        }
                                    }


                                    console.log(block.height, 'errors', errors);
                                    fs.unlinkSync('./block' + block.height);
                                    resolve(errors);
                                })

                                res.pipe(r);
                            })
                    })
                })


            //get block hash
            //get all tx hash of this blocks
            //create stream with hex data
            //check

        })

}

module.exports.testStream = function testStream() {
    return getLastBlockHeight()
        .then(height => {

            let promise = Promise.resolve();
            let res = [];

            for (let i = 0; i < N; i++) {
                promise = promise.then(() => {
                    return checkRandomBlock(height)
                })
                    .then(r => {
                        res.push(r);
                        return Promise.resolve();
                    })
            }

            return promise.then(() => {
                console.log('done')
                return res;
            })

        })

}
