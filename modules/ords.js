import { BitcoinStreamModule } from "../bitcoinstreammodule.js";

function haveOrds(scriptHex) {
    return scriptHex.indexOf("0063036f72640101") != -1;
}

function getOrd(scriptHex) {
    let buff = Buffer.from(scriptHex, 'hex');
    let startOffset = 0;
    let contentTypeStart = 0;
    let contentTypeEnd = 0;
    let contentStart = 0;
    let contentEnd = 0;

    let content = '';
    let contentType = '';
    let ords = {};

    for (let i = 0; i < buff.length - 1; i++) {
        if (buff[i] == 0x00 && buff[i + 1] == 0x63) {
            startOffset = i;
            contentTypeStart = i + 8;
            contentTypeEnd = contentTypeStart + buff[contentTypeStart];
            contentType = buff.subarray(contentTypeStart + 1, contentTypeEnd + 1);

            contentStart = contentTypeEnd + 2;
            contentEnd = contentStart + buff[contentStart] + 1;
            content = buff.subarray(contentStart + 1, contentEnd);

            ords = { contentType: Buffer.from(contentType).toString(), content: Buffer.from(content).toString() };
        }
    }

    return ords;
}

export class BitcoinStreamOrdModule extends BitcoinStreamModule {
    constructor() {
        super('txin_script', 'ords', function () {
            if (!this.tx.in[this.readIn - 1])
                return;

            const script = this.tx.in[this.readIn - 1].script;

            if (script && haveOrds(script)) {
                if (!this.tx.ords)
                    this.tx.ords = [];

                this.tx.ords[this.readIn - 1] = getOrd(script);
            }
        });
    }
}

export class BitcoinStreamOrdWitnessModule extends BitcoinStreamModule {
    constructor() {
        super('witness', 'ords', function () {
            const w = this.tx.witness[this.readWitnessArray - 1];
            for (let i in w) {
                if (w[i] && haveOrds(w[i])) {
                    if (!this.tx.ords)
                        this.tx.ords = [];

                    this.tx.ords[this.readWitnessArray - 1] = getOrd(w[i]);
                }
            }


        });
    }
}