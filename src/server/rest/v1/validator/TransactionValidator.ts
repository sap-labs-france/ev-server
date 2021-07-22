import { HttpPushTransactionCdrRequest, HttpTransactionRequest, HttpTransactionsRequest } from '../../../../types/requests/HttpTransactionRequest';

import Schema from '../../../../types/validator/Schema';
import SchemaValidator from './SchemaValidator';
import fs from 'fs';
import global from '../../../../types/GlobalType';

export default class TransactionValidator extends SchemaValidator {
  private static instance: TransactionValidator | undefined;
  private transactionsGet: Schema;
  private transactionGet: Schema;
  private transactionsGetByIDs: Schema;
  private transactionPushCDR: Schema;


  private constructor() {
    super('TransactionValidator');
    this.transactionsGet = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/transaction/transactions-get.json`, 'utf8'));
    this.transactionGet = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/transaction/transaction-get.json`, 'utf8'));
    this.transactionsGetByIDs = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/transaction/transactions-get-by-ids.json`, 'utf8'));
    this.transactionPushCDR = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/transaction/transaction-push-cdr.json`, 'utf8'));
  }

  public static getInstance(): TransactionValidator {
    if (!TransactionValidator.instance) {
      TransactionValidator.instance = new TransactionValidator();
    }
    return TransactionValidator.instance;
  }

  public validateTransactionsGetReq(data: any): HttpTransactionsRequest {
    // Validate schema
    this.validate(this.transactionsGet, data);
    return data;
  }

  public validateTransactionGetReq(data: any): HttpTransactionRequest {
    // Validate schema
    this.validate(this.transactionGet, data);
    return data;
  }

  public validateTransactionsGetByIDsReq(data: any): { transactionsIDs: number[] } {
    // Validate schema
    this.validate(this.transactionsGetByIDs, data);
    return data;
  }

  public validateTransactionPushCDRReq(data: any): HttpPushTransactionCdrRequest {
    // Validate schema
    this.validate(this.transactionPushCDR, data);
    return data;
  }
}
