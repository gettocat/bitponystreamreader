import { getLastBlockHeight, testBlockAddressOuts } from './utils.js'

let N = 15;

const versions = {
    '-1': 'OP_RETURN',
    0: 'P2PK',
    1: 'P2PKH',
    2: 'P2SH',
    3: 'P2WPKH',
    4: 'P2WSH',
    5: 'P2TR',
}

export function testAddress() {
    return getLastBlockHeight()
        .then(height => {
            let addrVersionTested = {};

            let promise = Promise.resolve();

            for (let i = 0; i < N; i++) {
                promise = promise.then(() => {
                    let rand = Math.floor(Math.random() * height);
                    return testBlockAddressOuts(rand);
                })
                    .then((res) => {
                        addrVersionTested = res.addrVersionTested;
                        console.log('random block:', res.hash, 'height', res.number, 'result outs', res.result);
                        return Promise.resolve();
                    })
            }

            return promise
                .then(() => {
                    let count = 1;
                    let res = [];
                    let cnt = Object.keys(versions).length;
                    for (let i in versions) {
                        let str = "[" + (count++) + "/" + cnt + "]" + " " + 'version' + " " + versions[i] + " " + 'tested=' + (addrVersionTested[i] ? 'yes' : 'no') + " " + 'result' + " " + addrVersionTested[i]
                        console.log(str);
                        //res.push(str);
                    }

                    return res;
                })

        });
}
/*
testBLockAddressOuts(1)
    .then(res => {
        console.log(res)
    })

testBLockAddressOuts(100000)
    .then(res => {
        console.log(res)
    })


testBLockAddressOuts(500000)
    .then(res => {
        //console.log(res)
    })*/
