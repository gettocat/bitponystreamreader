module.exports.BitcoinStreamModule = class BitcoinStreamModule {
    constructor(typeName, filterName, fn) {
        this.filter = "module." + filterName;
        this.fn = fn;
        this.type = typeName;
    }
}