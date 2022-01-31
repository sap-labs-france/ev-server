import { HttpAssignTransactionsToUserRequest, HttpConsumptionFromTransactionRequest, HttpExportTransactionCdrRequest, HttpPushTransactionCdrRequest, HttpTransactionRequest, HttpTransactionsRequest, HttpUnassignTransactionsToUserRequest } from '../../../../types/requests/HttpTransactionRequest';

import Schema from '../../../../types/validator/Schema';
import SchemaValidator from '../../../../validator/SchemaValidator';
import fs from 'fs';
import global from '../../../../types/GlobalType';

export default class TransactionValidator extends SchemaValidator {
  private static instance: TransactionValidator | undefined;
  private transactionsGet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/transaction/transactions-get.json`, 'utf8'));
  private transactionGet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/transaction/transaction-get.json`, 'utf8'));
  private transactionsByIDsGet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/transaction/transactions-by-ids-get.json`, 'utf8'));
  private transactionCdrPush: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/transaction/transaction-cdr-push.json`, 'utf8'));
  private transactionCdrExport: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/transaction/transaction-cdr-export.json`, 'utf8'));
  private transactionConsumptionsGet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/transaction/transaction-consumptions-get.json`, 'utf8'));
  private transactionsUserAssign: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/transaction/transactions-user-assign.json`, 'utf8'));
  private transactionsUnassignedCountGet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/transaction/transactions-unassigned-count-get.json`, 'utf8'));
  private transactionsInErrorGet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/transaction/transactions-inerror-get.json`, 'utf8'));


  private constructor() {
    super('TransactionValidator');
  }

  public static getInstance(): TransactionValidator {
    if (!TransactionValidator.instance) {
      TransactionValidator.instance = new TransactionValidator();
    }
    return TransactionValidator.instance;
  }

  public validateTransactionsGetReq(data: Record<string, unknown>): HttpTransactionsRequest {
    return this.validate(this.transactionsGet, data);
  }

  public validateTransactionGetReq(data: Record<string, unknown>): HttpTransactionRequest {
    return this.validate(this.transactionGet, data);
  }

  public validateTransactionCdrExportReq(data: Record<string, unknown>): HttpExportTransactionCdrRequest {
    return this.validate(this.transactionCdrExport, data);
  }

  public validateTransactionsByIDsGetReq(data: Record<string, unknown>): { transactionsIDs: number[] } {
    return this.validate(this.transactionsByIDsGet, data);
  }

  public validateTransactionCdrPushReq(data: Record<string, unknown>): HttpPushTransactionCdrRequest {
    return this.validate(this.transactionCdrPush, data);
  }

  public validateTransactionConsumptionsGetReq(data: Record<string, unknown>): HttpConsumptionFromTransactionRequest {
    return this.validate(this.transactionConsumptionsGet, data);
  }

  public validateTransactionsUserAssignReq(data: Record<string, unknown>): HttpAssignTransactionsToUserRequest {
    return this.validate(this.transactionsUserAssign, data);
  }

  public validateTransactionsUnassignedCountReq(data: Record<string, unknown>): HttpUnassignTransactionsToUserRequest {
    return this.validate(this.transactionsUnassignedCountGet, data);
  }

  public validateTransactionsInErrorGetReq(data: Record<string, unknown>): HttpTransactionsRequest {
    return this.validate(this.transactionsInErrorGet, data);
  }
}
