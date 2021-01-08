export default interface CryptoConfiguration {
  key: string;
  algorithm: string;
  blockCypher?: string;
  keySize?: number;
  operationMode?: string;
}
