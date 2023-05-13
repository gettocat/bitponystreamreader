const { BitcoinStreamModule } = require("../bitcoinstreammodule.js");
const { Uint64BE } = require("int64-buffer");

function haveOrds(scriptHex) {
    return scriptHex.indexOf("0063036f72640101") != -1;
}

function getOrd(scriptHex) {
    console.log(scriptHex);
    let buff = Buffer.from(scriptHex, 'hex');
    let startOffset = 0;
    let contentTypeStart = 0;
    let contentTypeEnd = 0;
    let contentStart = 0;
    let contentEnd = 0;
    let pushContentByte = 0;
    let offset = 1;
    let contentLengthOffset = 1;

    let content = '';
    let contentType = '';
    let contentLength = 1;
    let ords = {};

    for (let i = 0; i < buff.length - 1; i++) {
        if (buff[i] == 0x00 && buff[i + 1] == 0x63) {
            startOffset = i;
            contentTypeStart = i + 8;
            contentTypeEnd = contentTypeStart + buff[contentTypeStart];
            contentType = buff.subarray(contentTypeStart + 1, contentTypeEnd + 1);
            pushContentByte = contentTypeEnd + 2;//+0x00

            if (buff[pushContentByte] == 0x4c)//OP_PUSHDATA1
                offset = 1;
            else if (buff[pushContentByte] == 0x4d) {//OP_PUSHDATA2
                offset = 2;
            } else if (buff[pushContentByte] == 0x4e) {//OP_PUSHDATA4
                offset = 4;
            } else { //its a var_int
                contentLengthOffset = 0;

                if (buff[pushContentByte] == 253) {
                    //uint16
                    offset = 2;
                } else if (buff[pushContentByte] == 254) {
                    //uint32
                    offset = 4
                } else if (buff[pushContentByte] == 255) {
                    //uint64
                    offset = 8;
                } else {
                    //uint8
                    offset = 1;
                }
            }


            contentLength = buff.subarray(pushContentByte + contentLengthOffset, pushContentByte + contentLengthOffset + offset).readUIntBE(0, offset)
            contentStart = pushContentByte + offset + contentLengthOffset;

            contentEnd = contentStart + contentLength;
            content = buff.subarray(contentStart, contentEnd);


            ords = { contentType: Buffer.from(contentType).toString(), content: Buffer.from(content).toString() };

            break;
        }
    }

    return ords;
}

module.exports.BitcoinStreamOrdModule = class BitcoinStreamOrdModule extends BitcoinStreamModule {
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

module.exports.BitcoinStreamOrdWitnessModule = class BitcoinStreamOrdWitnessModule extends BitcoinStreamModule {
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