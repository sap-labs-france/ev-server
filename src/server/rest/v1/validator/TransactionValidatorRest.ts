import { HttpAssignTransactionsToUserRequest, HttpTransactionCdrExportRequest, HttpTransactionCdrPushRequest, HttpTransactionConsumptionsAdvenirGetRequest, HttpTransactionConsumptionsGetRequest, HttpTransactionDeleteRequest, HttpTransactionGetRequest, HttpTransactionStopRequest, HttpTransactionsByIDsGetRequest, HttpTransactionsGetRequest, HttpUnassignTransactionsToUserRequest } from '../../../../types/requests/HttpTransactionRequest';

import Schema from '../../../../types/validator/Schema';
import SchemaValidator from '../../../../validator/SchemaValidator';
import fs from 'fs';
import global from '../../../../types/GlobalType';

export default class TransactionValidatorRest extends SchemaValidator {
  private static instance: TransactionValidatorRest | undefined;
  private transactionsGet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/transaction/transactions-get.json`, 'utf8'));
  private transactionGet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/transaction/transaction-get.json`, 'utf8'));
  private transactionStop: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/transaction/transaction-stop.json`, 'utf8'));
  private transactionDelete: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/transaction/transaction-delete.json`, 'utf8'));
  private transactionsByIDsGet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/transaction/transactions-by-ids-get.json`, 'utf8'));
  private transactionCdrPush: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/transaction/transaction-cdr-push.json`, 'utf8'));
  private transactionCdrExport: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/transaction/transaction-cdr-export.json`, 'utf8'));
  private transactionConsumptionsGet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/transaction/transaction-consumptions-get.json`, 'utf8'));
  private transactionConsumptionsAdvenirGet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/transaction/transaction-consumptions-advenir-get.json`, 'utf8'));
  private transactionsUserAssign: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/transaction/transactions-user-assign.json`, 'utf8'));
  private transactionsInErrorGet: Schema = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/transaction/transactions-inerror-get.json`, 'utf8'));


  private constructor() {
    super('TransactionValidatorRest');
  }

  public static getInstance(): TransactionValidatorRest {
    if (!TransactionValidatorRest.instance) {
      TransactionValidatorRest.instance = new TransactionValidatorRest();
    }
    return TransactionValidatorRest.instance;
  }

  public validateTransactionsGetReq(data: Record<string, unknown>): HttpTransactionsGetRequest {
    return this.validate(this.transactionsGet, data);
  }

  public validateTransactionGetReq(data: Record<string, unknown>): HttpTransactionGetRequest {
    return this.validate(this.transactionGet, data);
  }

  public validateTransactionStopReq(data: Record<string, unknown>): HttpTransactionStopRequest {
    return this.validate(this.transactionStop, data);
  }

  public validateTransactionDeleteReq(data: Record<string, unknown>): HttpTransactionDeleteRequest {
    return this.validate(this.transactionDelete, data);
  }

  public validateTransactionCdrExportReq(data: Record<string, unknown>): HttpTransactionCdrExportRequest {
    return this.validate(this.transactionCdrExport, data);
  }

  public validateTransactionsByIDsGetReq(data: Record<string, unknown>): HttpTransactionsByIDsGetRequest {
    return this.validate(this.transactionsByIDsGet, data);
  }

  public validateTransactionCdrPushReq(data: Record<string, unknown>): HttpTransactionCdrPushRequest {
    return this.validate(this.transactionCdrPush, data);
  }

  public validateTransactionConsumptionsGetReq(data: Record<string, unknown>): HttpTransactionConsumptionsGetRequest {
    return this.validate(this.transactionConsumptionsGet, data);
  }

  public validateTransactionConsumptionsAdvenirGetReq(data: Record<string, unknown>): HttpTransactionConsumptionsAdvenirGetRequest {
    return this.validate(this.transactionConsumptionsAdvenirGet, data);
  }

  public validateTransactionsUserAssignReq(data: Record<string, unknown>): HttpAssignTransactionsToUserRequest {
    return this.validate(this.transactionsUserAssign, data);
  }

  public validateTransactionsInErrorGetReq(data: Record<string, unknown>): HttpTransactionsGetRequest {
    return this.validate(this.transactionsInErrorGet, data);
  }
}
