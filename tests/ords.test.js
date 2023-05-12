
import { BitcoinTxStream } from '../index.js'
import fs from 'fs';

export function testOrdParsing() {

    return new Promise(resolve => {
        const txstream = new BitcoinTxStream(
            { tx: '*' },
            { address: true, ords: true, highWaterMark: 1024 });

        txstream.on('tx', (tx) => {
            //console.log(tx, JSON.parse(tx.ords[0].content));
            fs.unlinkSync('./tx1');
            resolve(tx.ords[0].content);
        })

        fs.writeFileSync('./tx1', Buffer.from('0200000000010109c34c2c9d4420b66dfb9987c86f9a804fe16aa89d76142d4fb3a13145877ef80000000000fdffffff02220200000000000022512017e9fe82a3efc9df858890dc5c1c33cae87353843b2c330223eb69b65dd3395d360b0000000000001600148639a85ef445e0fc311c2a8dcf569cc6adb3756c0340f55945bb5c20d367d6a722648309c884dc497886be1b6ce3bcdf501e763733f1552033e4994b7bfb7e1c0f2fefd1d5bda6de237bfca734141c9265ff6ee5fb489720117f692257b2331233b5705ce9c682be8719ff1b2b64cbca290bd6faeb54423eac06443c6c088801750063036f7264010118746578742f706c61696e3b636861727365743d7574662d3800497b0a20202270223a20226272632d3230222c0a2020226f70223a20227472616e73666572222c0a2020227469636b223a20226f726469222c0a202022616d74223a2022313134220a7d6821c0117f692257b2331233b5705ce9c682be8719ff1b2b64cbca290bd6faeb54423e00000000', 'hex'));
        let res = fs.createReadStream('./tx1', { highWaterMark: 1024 });

        res.pipe(txstream)
    })
}