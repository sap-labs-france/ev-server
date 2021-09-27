import { HttpAssignTransactionsToUserRequest, HttpConsumptionFromTransactionRequest, HttpPushTransactionCdrRequest, HttpTransactionRequest, HttpTransactionsRequest, HttpUnassignTransactionsToUserRequest } from '../../../../types/requests/HttpTransactionRequest';

import Schema from '../../../../types/validator/Schema';
import SchemaValidator from './SchemaValidator';
import fs from 'fs';
import global from '../../../../types/GlobalType';

export default class TransactionValidator extends SchemaValidator {
  private static instance: TransactionValidator | undefined;
  private transactionsGet: Schema;
  private transactionGet: Schema;
  private transactionsByIDsGet: Schema;
  private transactionCdrPush: Schema;
  private transactionConsumptionsGet: Schema;
  private transactionsUserAssign: Schema;
  private transactionsUnassignedCountGet: Schema;
  private transactionsInErrorGet: Schema;


  private constructor() {
    super('TransactionValidator');
    this.transactionsGet = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/transaction/transactions-get.json`, 'utf8'));
    this.transactionGet = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/transaction/transaction-get.json`, 'utf8'));
    this.transactionsByIDsGet = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/transaction/transactions-by-ids-get.json`, 'utf8'));
    this.transactionCdrPush = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/transaction/transaction-cdr-push.json`, 'utf8'));
    this.transactionConsumptionsGet = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/transaction/transaction-consumptions-get.json`, 'utf8'));
    this.transactionsUserAssign = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/transaction/transactions-user-assign.json`, 'utf8'));
    this.transactionsUnassignedCountGet = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/transaction/transactions-unassigned-count-get.json`, 'utf8'));
    this.transactionsInErrorGet = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/transaction/transactions-inerror-get.json`, 'utf8'));
  }

  public static getInstance(): TransactionValidator {
    if (!TransactionValidator.instance) {
      TransactionValidator.instance = new TransactionValidator();
    }
    return TransactionValidator.instance;
  }

  public validateTransactionsGetReq(data: unknown): HttpTransactionsRequest {
    return this.validate('validateTransactionsGetReq', this.transactionsGet, data);
  }

  public validateTransactionGetReq(data: unknown): HttpTransactionRequest {
    return this.validate('validateTransactionGetReq', this.transactionGet, data);
  }

  public validateTransactionsByIDsGetReq(data: unknown): { transactionsIDs: number[] } {
    return this.validate('validateTransactionsByIDsGetReq', this.transactionsByIDsGet, data);
  }

  public validateTransactionCdrPushReq(data: unknown): HttpPushTransactionCdrRequest {
    return this.validate('validateTransactionCdrPushReq', this.transactionCdrPush, data);
  }

  public validateTransactionConsumptionsGetReq(data: unknown): HttpConsumptionFromTransactionRequest {
    return this.validate('validateTransactionConsumptionsGetReq', this.transactionConsumptionsGet, data);
  }

  public validateTransactionsUserAssignReq(data: unknown): HttpAssignTransactionsToUserRequest {
    return this.validate('validateTransactionsUserAssignReq', this.transactionsUserAssign, data);
  }

  public validateTransactionsUnassignedCountReq(data: unknown): HttpUnassignTransactionsToUserRequest {
    return this.validate('validateTransactionsUnassignedCountReq', this.transactionsUnassignedCountGet, data);
  }

  public validateTransactionsInErrorGetReq(data: unknown): HttpTransactionsRequest {
    return this.validate('validateTransactionsInErrorGetReq', this.transactionsInErrorGet, data);
  }
}
