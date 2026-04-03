const { Wallet } = require("ethers");
console.log(Wallet.createRandom().mnemonic.phrase);
