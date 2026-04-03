declare module "tronweb" {
  class TronWeb {
    constructor(options: {
      fullHost: string;
      headers?: Record<string, string>;
      privateKey?: string;
    });

    trx: {
      getBalance(address: string): Promise<number>;
      sign(transaction: any, privateKey?: string): Promise<any>;
      sendRawTransaction(transaction: any): Promise<any>;
    };

    transactionBuilder: {
      triggerSmartContract(
        contractAddress: string,
        functionSelector: string,
        options: any,
        parameters: any[],
        issuerAddress: string,
      ): Promise<any>;
      sendTrx(to: string, amount: number, from: string): Promise<any>;
    };

    contract(abi: any[], address: string): Promise<any>;
    setAddress(address: string): void;
    setPrivateKey(privateKey: string): void;
    address: {
      fromPrivateKey(privateKey: string): string;
    };

    static address: {
      fromPrivateKey(privateKey: string): string;
    };
  }

  export = TronWeb;
}
