import AbstractSoapClient from './AbstractSoapClient';
import BackendError from '../../../exception/BackendError';
import ConnectionStorage from '../../../storage/mongodb/ConnectionStorage';
import { ServerAction } from '../../../types/Server';
import Tenant from '../../../types/Tenant';
import User from '../../../types/User';
import global from '../../../types/GlobalType';
import { soap } from 'strong-soap';

const MODULE_NAME = 'ERPService';

export default class ERPService extends AbstractSoapClient {
  public execute: any;

  constructor(serverUrl: string, user: string, password: string) {
    super(
      `${serverUrl}/ARTIX/erpservices`,
      `${global.appRoot}/integration/pricing/convergent-charging/assets/wsdl/erpservices_1.wsdl`,
      'ERP',
      'ERPPort',
      user,
      password,
      new soap.ClientSSLSecurity(
        `${global.appRoot}/integration/pricing/convergent-charging/assets/ssl/hybris-access.key`,
        `${global.appRoot}/integration/pricing/convergent-charging/assets/ssl/hybris-access.crt`,
        { rejectUnauthorized: false, strictSSL: false }
      )
    );

  }

  /**
   *
   * @param {string} tenantId
   * @param tenant
   * @param {User} user
   * @returns {Promise<void>}
   */
  async createInvoice(tenant: Tenant, user: User) {
    const connection = await ConnectionStorage.getConnectionByConnectorIdAndUserId(tenant, 'convergent-invoicing', user.id);
    if (!connection) {
      throw new BackendError({
        module: MODULE_NAME,
        method: 'createInvoice',
        message: 'Convergent Invoicing connection is missing',
        action: ServerAction.BILLING,
        user: user
      });
    }
    const invoiceCreateRequest = new InvoiceCreateRequest(connection.data.gpart, connection.data.vkont, 1, 'SDBC', 'YN');
    const result = await this.execute(invoiceCreateRequest);
    if (!result.data.InvoiceDocumentNumber) {
      if (result.data.status === 'error') {
        throw new BackendError({
          module: MODULE_NAME,
          method: 'createInvoice',
          message: result.data.message,
          action: ServerAction.BILLING,
          user: user,
          detailedMessages: { result: result.data }
        });
      } else if (result.data.ReturnedMessage) {
        if (result.data.ReturnedMessage.detail && result.data.ReturnedMessage.detail[2].$attributes.value === '115') {
          return null;
        }
        throw new BackendError({
          module: MODULE_NAME,
          method: 'createInvoice',
          message: 'Unable to create invoice',
          action: ServerAction.BILLING,
          user: user,
          detailedMessages: { result: result.data }
        });
      }
      throw new BackendError({
        module: MODULE_NAME,
        method: 'createInvoice',
        message: 'Unable to create invoice',
        action: ServerAction.BILLING,
        user: user,
        detailedMessages: { result: result.data }
      });
    }
    return result.data.InvoiceDocumentNumber;
  }

  async getInvoiceDocumentHeader(invoiceDocumentNumber) {
    const invoiceDocumentSelectRequest = new InvoiceDocumentSelectRequest(invoiceDocumentNumber);
    const result = await this.execute(invoiceDocumentSelectRequest);
    if (!result.data.FKKInvDoc_H) {
      throw new Error(result.data.error.message);
    }
    return result.data.FKKInvDoc_H;
  }

  async getInvoiceDocument(invoiceDocumentHeader, invoiceDocumentNumber) {
    const invoiceDocumentPrintRequest = new InvoiceDocumentPrintRequest(invoiceDocumentHeader, invoiceDocumentNumber);
    const result = await this.execute(invoiceDocumentPrintRequest);
    if (!result.data.INVDOCPDF2) {
      return null;
    }
    const hexPayload = result.data.INVDOCPDF2.map((doc) => doc.detail.$attributes.value).join('');
    return Buffer.from(hexPayload, 'hex');
  }

}


export class InvoiceCreateRequest {
  public I_GPART: any;
  public I_VKONT: any;
  public I_MAX_PROBCL: any;
  public I_BILLING_PROCESS: any;
  public I_INVOICE_PROCESS: any;

  constructor(I_GPART, I_VKONT, I_MAX_PROBCL, I_BILLING_PROCESS, I_INVOICE_PROCESS, I_PROCESS?, I_BILLING_DATE?, I_INVOICE_DATE?,
      I_INVOICE_BLDAT?, I_INVOICE_BUDAT?, I_INVOICE_FIKEY?) {
    this.I_GPART = I_GPART;
    this.I_VKONT = I_VKONT;
    this.I_MAX_PROBCL = I_MAX_PROBCL;
    this.I_BILLING_PROCESS = I_BILLING_PROCESS;
    // pragma this.I_PROCESS = I_PROCESS;
    // this.I_BILLING_DATE = I_BILLING_DATE;
    this.I_INVOICE_PROCESS = I_INVOICE_PROCESS;
    // pragma this.I_INVOICE_DATE = I_INVOICE_DATE;
    // this.I_INVOICE_BLDAT = I_INVOICE_BLDAT;
    // this.I_INVOICE_BUDAT = I_INVOICE_BUDAT;
    // this.I_INVOICE_FIKEY = I_INVOICE_FIKEY;
  }

  getName() {
    return 'InvoiceCreate';
  }
}

export class InvoiceDocumentSelectRequest {
  public InvoiceDocumentNumber: any;

  constructor(invoiceDocumentNumber) {
    this.InvoiceDocumentNumber = invoiceDocumentNumber;
  }

  getName() {
    return 'InvoiceDocumentSelect';
  }
}

export class InvoiceDocumentPrintRequest {
  public INVDOCHEADER: any;
  public X_GETPDF: any;

  constructor(invoiceDocumentHeader, invoiceDocumentNumber) {

    this.INVDOCHEADER = {
      APPL_AREA: invoiceDocumentHeader.APPLK,
      BUSINESS_PARTNER: invoiceDocumentHeader.GPART,
      CONT_ACCT: invoiceDocumentHeader.VKONT,
      CREATE_DATE: invoiceDocumentHeader.INVOICE_BASEDATE.replace(/-/g, ''),
      CREATE_MODE: invoiceDocumentHeader.CRMODE,
      CREATE_TIME: invoiceDocumentHeader.CRTIME.replace(/:/g, ''),
      CREATED_BY: invoiceDocumentHeader.CRNAME,
      DISCOUNT_DUE_DATE: invoiceDocumentHeader.FAEDS.replace(/-/g, ''),
      DOC_DATE: invoiceDocumentHeader.BLDAT.replace(/-/g, ''),
      DOC_TYPE: invoiceDocumentHeader.DOCTYPE,
      FORM_KEY: invoiceDocumentHeader.FORMKEY,
      INV_CATEGORY: invoiceDocumentHeader.INV_CATEGORY,
      INV_PERIOD: invoiceDocumentHeader.INVPERIOD.replace(/-/g, ''),
      INV_PROCESS: invoiceDocumentHeader.INV_PROCESS,
      INV_TYPE: invoiceDocumentHeader.INV_TYPE,
      INVDOC_NO: invoiceDocumentNumber,
      NET_DATE: invoiceDocumentHeader.FAEDN.replace(/-/g, ''),
      POST_DATE: invoiceDocumentHeader.BUDAT.replace(/-/g, ''),
      RECONCILIATION_KEY: invoiceDocumentHeader.FIKEY,
      TOTAL_AMOUNT: invoiceDocumentHeader.TOTAL_AMT,
      TOTAL_CURRENCY: invoiceDocumentHeader.TOTAL_CURR,
      TOTAL_CURRENCY_ISO: invoiceDocumentHeader.TOTAL_CURR,
      X_INVOICED: invoiceDocumentHeader.INVOICED,
    };
    this.X_GETPDF = 'X';
  }

  getName() {
    return 'InvoiceDocumentPrint';
  }
}
