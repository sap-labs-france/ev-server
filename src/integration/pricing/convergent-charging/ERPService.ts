import { soap } from 'strong-soap';
import ConnectionStorage from "../../../storage/mongodb/ConnectionStorage";
import AbstractSoapClient from './AbstractSoapClient';
import InternalError from '../../../exception/InternalError';
import TSGlobal from '../../../types/GlobalType';
declare const global: TSGlobal;

export default class ERPService extends AbstractSoapClient {
  public execute: any;

  constructor(serverUrl, user, password) {
    super(
      `${serverUrl}/ARTIX/erpservices`,
      `${global.appRoot}/assets/convergent-charging/wsdl/erpservices_1.wsdl`,
      'ERP',
      'ERPPort',
      user,
      password,
      new soap.ClientSSLSecurity(
        `${global.appRoot}/assets/convergent-charging/ssl/hybris-access.key`,
        `${global.appRoot}/assets/convergent-charging/ssl/hybris-access.crt`,
        { rejectUnauthorized: false, strictSSL: false }
      )
    );

  }

  /**
   *
   * @param user {User}
   * @returns {Promise<void>}
   */
  async createInvoice(tenantId, user) {
    const connection = await ConnectionStorage.getConnectionByUserId(tenantId, 'convergent-invoicing', user.getID());
    if (!connection) {
      throw new InternalError(`Convergent Invoicing connection is missing for user ${user.getID()}`);
    }
    const invoiceCreateRequest = new InvoiceCreateRequest(connection.getData().gpart, connection.getData().vkont, 1, 'SDBC', 'YN');
    const result = await this.execute(invoiceCreateRequest);
    if (!result.data.InvoiceDocumentNumber) {
      if (result.data.status === "error") {
        throw new InternalError(result.data.message, result.data);
      } else if (result.data.ReturnedMessage) {
        if (result.data.ReturnedMessage.detail && result.data.ReturnedMessage.detail[2].$attributes.value === '115') {
          return null;
        }
        throw new InternalError("Unable to create invoice", result.data.ReturnedMessage);
      }
      throw new InternalError("Unable to create invoice", result.data);
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
    const hexPayload = result.data.INVDOCPDF2.map((doc) => {
      return doc.detail.$attributes.value;
    }).join('');
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
