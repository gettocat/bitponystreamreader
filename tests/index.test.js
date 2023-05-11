import { testStream } from './auto.test.js';
import { testAddress } from './address.test.js';

console.log("===== start test by random blocks=====");
testStream()
    .then(errors => {
        console.log("===== stop test by random blocks=====");

        console.log("===== start test address builder =====");
        return testAddress();
    })
    .then((res) => {

        console.log("===== stop test address builder =====");
    })