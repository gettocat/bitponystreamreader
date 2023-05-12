const { testStream } = require('./auto.test.js');
const { testAddress } = require('./address.test.js');
const { testOrdParsing } = require('./ords.test.js');

console.log("===== start test by random blocks=====");
testStream()
    .then(errors => {
        console.log("===== stop test by random blocks=====");

        console.log("===== start test address builder =====");
        return testAddress();
    })
    .then((res) => {
        console.log("===== stop test address builder =====");
        return Promise.resolve();
    })
    .then(() => {
        console.log("===== start ords parsing =====");
        return testOrdParsing()
    })
    .then((res) => {
        let ord = JSON.parse(res);
        console.log(res, ord.p == 'brc-20' && ord.op == 'transfer' && ord.tick == 'ordi' ? 'ok' : 'error');
        console.log("===== finish ords parsing =====");
    })