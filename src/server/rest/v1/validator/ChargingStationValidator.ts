import { HttpChargingProfilesRequest, HttpChargingStationChangeAvailabilityRequest, HttpChargingStationChangeConfigurationRequest, HttpChargingStationClearCacheRequest, HttpChargingStationCommandDataTransferRequest, HttpChargingStationCommandGetConfigurationRequest, HttpChargingStationCommandRequest, HttpChargingStationCommandUnlockConnectorRequest, HttpChargingStationConnectorRequest, HttpChargingStationGetCompositeScheduleRequest, HttpChargingStationGetDiagnosticsRequest, HttpChargingStationGetFirmwareRequest, HttpChargingStationLimitPowerRequest, HttpChargingStationOcppParametersRequest, HttpChargingStationOcppRequest, HttpChargingStationParamsUpdateRequest, HttpChargingStationRequest, HttpChargingStationReserveNowRequest, HttpChargingStationResetRequest, HttpChargingStationStartTransactionRequest, HttpChargingStationStopTransactionRequest, HttpChargingStationUpdateFirmwareRequest, HttpChargingStationsInErrorRequest, HttpChargingStationsRequest, HttpDownloadQrCodeRequest, HttpTriggerSmartChargingRequest } from '../../../../types/requests/HttpChargingStationRequest';

import { ChargingProfile } from '../../../../types/ChargingProfile';
import { ChargingStationTemplate } from '../../../../types/ChargingStation';
import HttpDatabaseRequest from '../../../../types/requests/HttpDatabaseRequest';
import Schema from '../../../../types/validator/Schema';
import SchemaValidator from './SchemaValidator';
import fs from 'fs';
import global from '../../../../types/GlobalType';

export default class ChargingStationValidator extends SchemaValidator {
  private static instance: ChargingStationValidator | null = null;
  private chargingStationsGet: Schema;
  private chargingStationGet: Schema;
  private chargingStationDelete: Schema;
  private chargingStationAction: Schema;
  private chargingStationActionAvailabilityChange: Schema;
  private chargingStationActionChangeConfiguration: Schema;
  private chargingStationActionCacheClear: Schema;
  private chargingStationActionDataTransfer: Schema;
  private chargingStationActionTransactionStart: Schema;
  private chargingStationActionTransactionStop: Schema;
  private chargingStationActionConfigurationGet: Schema;
  private chargingStationActionCompositeScheduleGet: Schema;
  private chargingStationActionConnectorUnlock: Schema;
  private chargingStationActionFirmwareUpdate: Schema;
  private chargingStationActionReserveNow: Schema;
  private chargingStationActionReset: Schema;
  private chargingStationQRCodeGenerate: Schema;
  private chargingStationQRCodeDownload: Schema;
  private chargingStationOcppParametersGet: Schema;
  private chargingStationOcppParametersRequest: Schema;
  private chargingStationParametersUpdate: Schema;
  private chargingStationPowerLimit: Schema;
  private chargingStationFirmwareDownload: Schema;
  private chargingStationDiagnosticsGet: Schema;
  private smartChargingTrigger: Schema;
  private chargingStationInErrorGet: Schema;
  private chargingProfileCreate: Schema;
  private chargingProfilesGet: Schema;
  private chargingProfileDelete: Schema;
  private chargingProfileUpdate: Schema;
  private chargingStationNotificationsGet: Schema;
  private chargingStationTemplate: Schema;

  private constructor() {
    super('ChargingStationValidator');
    this.chargingStationTemplate = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/chargingstation/chargingstation-template.json`, 'utf8'));
    this.chargingStationsGet = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/chargingstation/chargingstations-get.json`, 'utf8'));
    this.chargingStationGet = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/chargingstation/chargingstation-get.json`, 'utf8'));
    this.chargingStationDelete = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/chargingstation/chargingstation-delete.json`, 'utf8'));
    this.chargingStationAction = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/chargingstation/chargingstation-action.json`, 'utf8'));
    this.chargingStationActionAvailabilityChange = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/chargingstation/chargingstation-action-availability-change.json`, 'utf8'));
    this.chargingStationActionChangeConfiguration = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/chargingstation/chargingstation-action-configuration-change.json`, 'utf8'));
    this.chargingStationActionCacheClear = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/chargingstation/chargingstation-action-cache-clear.json`, 'utf8'));
    this.chargingStationActionDataTransfer = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/chargingstation/chargingstation-action-data-transfer.json`, 'utf8'));
    this.chargingStationActionTransactionStart = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/chargingstation/chargingstation-action-transaction-start.json`, 'utf8'));
    this.chargingStationActionTransactionStop = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/chargingstation/chargingstation-action-transaction-stop.json`, 'utf8'));
    this.chargingStationActionConfigurationGet = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/chargingstation/chargingstation-action-configuration-get.json`, 'utf8'));
    this.chargingStationActionCompositeScheduleGet = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/chargingstation/chargingstation-action-composite-schedule-get.json`, 'utf8'));
    this.chargingStationActionConnectorUnlock = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/chargingstation/chargingstation-action-connector-unlock.json`, 'utf8'));
    this.chargingStationActionFirmwareUpdate = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/chargingstation/chargingstation-action-firmware-update.json`, 'utf8'));
    this.chargingStationActionReserveNow = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/chargingstation/chargingstation-action-reserve-now.json`, 'utf8'));
    this.chargingStationActionReset = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/chargingstation/chargingstation-action-reset.json`, 'utf8'));
    this.chargingStationQRCodeGenerate = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/chargingstation/chargingstation-qrcode-generate.json`, 'utf8'));
    this.chargingStationQRCodeDownload = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/chargingstation/chargingstation-qrcode-download.json`, 'utf8'));
    this.chargingStationOcppParametersGet = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/chargingstation/chargingstation-ocpp-parameters-get.json`, 'utf8'));
    this.chargingStationOcppParametersRequest = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/chargingstation/chargingstation-ocpp-parameters-request.json`, 'utf8'));
    this.chargingStationParametersUpdate = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/chargingstation/chargingstation-parameters-update.json`, 'utf8'));
    this.chargingStationPowerLimit = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/chargingstation/chargingstation-power-limit.json`, 'utf8'));
    this.chargingStationFirmwareDownload = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/chargingstation/chargingstation-firmware-download.json`, 'utf8'));
    this.chargingStationDiagnosticsGet = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/chargingstation/chargingstation-action-diagnostics-get.json`, 'utf8'));
    this.smartChargingTrigger = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/chargingstation/smartcharging-trigger.json`, 'utf8'));
    this.chargingStationInErrorGet = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/chargingstation/chargingstations-inerror-get.json`, 'utf8'));
    this.chargingProfileCreate = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/chargingstation/chargingprofile-create.json`, 'utf8'));
    this.chargingProfilesGet = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/chargingstation/chargingprofiles-get.json`, 'utf8'));
    this.chargingProfileDelete = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/chargingstation/chargingprofile-delete.json`, 'utf8'));
    this.chargingProfileUpdate = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/chargingstation/chargingprofile-update.json`, 'utf8'));
    this.chargingStationNotificationsGet = JSON.parse(fs.readFileSync(`${global.appRoot}/assets/server/rest/v1/schemas/chargingstation/chargingstation-notifications-get.json`, 'utf8'));
  }

  public static getInstance(): ChargingStationValidator {
    if (!ChargingStationValidator.instance) {
      ChargingStationValidator.instance = new ChargingStationValidator();
    }
    return ChargingStationValidator.instance;
  }

  public validateChargingStationTemplateReq(data: unknown): ChargingStationTemplate {
    return this.validate(this.chargingStationTemplate, data);
  }

  public validateChargingStationsGetReq(data: unknown): HttpChargingStationsRequest {
    return this.validate(this.chargingStationsGet, data);
  }

  public validateChargingStationGetReq(data: unknown): HttpChargingStationRequest {
    return this.validate(this.chargingStationGet, data);
  }

  public validateChargingStationDeleteReq(data: unknown): HttpChargingStationRequest {
    return this.validate(this.chargingStationDelete, data);
  }

  public validateChargingStationActionReq(data: unknown): HttpChargingStationCommandRequest {
    return this.validate(this.chargingStationAction, data);
  }

  public validateChargingStationActionAvailabilityChangeReq(data: unknown): HttpChargingStationChangeAvailabilityRequest {
    return this.validate(this.chargingStationActionAvailabilityChange, data);
  }

  public validateChargingStationActionConfigurationChangeReq(data: unknown): HttpChargingStationChangeConfigurationRequest {
    return this.validate(this.chargingStationActionChangeConfiguration, data);
  }

  public validateChargingStationActionDataTransferReq(data: unknown): HttpChargingStationCommandDataTransferRequest {
    return this.validate(this.chargingStationActionDataTransfer, data);
  }

  public validateChargingStationActionCacheClearReq(data: unknown): HttpChargingStationClearCacheRequest {
    return this.validate(this.chargingStationActionCacheClear, data);
  }

  public validateChargingStationActionTransactionStartReq(data: unknown): HttpChargingStationStartTransactionRequest {
    return this.validate(this.chargingStationActionTransactionStart, data);
  }

  public validateChargingStationActionTransactionStopReq(data: unknown): HttpChargingStationStopTransactionRequest {
    return this.validate(this.chargingStationActionTransactionStop, data);
  }

  public validateChargingStationActionConfigurationGetReq(data: unknown): HttpChargingStationCommandGetConfigurationRequest {
    return this.validate(this.chargingStationActionConfigurationGet, data);
  }

  public validateChargingStationActionCompositeScheduleGetReq(data: unknown): HttpChargingStationGetCompositeScheduleRequest {
    return this.validate(this.chargingStationActionCompositeScheduleGet, data);
  }

  public validateChargingStationActionConnectorUnlockReq(data: unknown): HttpChargingStationCommandUnlockConnectorRequest {
    return this.validate(this.chargingStationActionConnectorUnlock, data);
  }

  public validateChargingStationActionFirmwareUpdateReq(data: unknown): HttpChargingStationUpdateFirmwareRequest {
    return this.validate(this.chargingStationActionFirmwareUpdate, data);
  }

  public validateChargingStationActionReserveNowReq(data: unknown): HttpChargingStationReserveNowRequest {
    return this.validate(this.chargingStationActionReserveNow, data);
  }

  public validateChargingStationActionResetReq(data: unknown): HttpChargingStationResetRequest {
    return this.validate(this.chargingStationActionReset, data);
  }

  public validateChargingStationQRCodeGenerateReq(data: unknown): HttpChargingStationConnectorRequest {
    return this.validate(this.chargingStationQRCodeGenerate, data);
  }

  public validateChargingStationQRCodeDownloadReq(data: unknown): HttpDownloadQrCodeRequest {
    return this.validate(this.chargingStationQRCodeDownload, data);
  }

  public validateChargingStationOcppParametersGetReq(data: unknown): HttpChargingStationOcppRequest {
    return this.validate(this.chargingStationOcppParametersGet, data);
  }

  public validateChargingStationOcppParametersRequestReq(data: unknown): HttpChargingStationOcppParametersRequest {
    return this.validate(this.chargingStationOcppParametersRequest, data);
  }

  public validateChargingStationParametersUpdateReq(data: unknown): HttpChargingStationParamsUpdateRequest {
    return this.validate(this.chargingStationParametersUpdate, data);
  }

  public validateChargingStationLimitPowerReq(data: unknown): HttpChargingStationLimitPowerRequest {
    return this.validate(this.chargingStationPowerLimit, data);
  }

  public validateChargingStationFirmwareDownloadReq(data: unknown): HttpChargingStationGetFirmwareRequest {
    return this.validate(this.chargingStationFirmwareDownload, data);
  }

  public validateChargingStationDiagnosticsGetReq(data: unknown): HttpChargingStationGetDiagnosticsRequest {
    return this.validate(this.chargingStationDiagnosticsGet, data);
  }

  public validateSmartChargingTriggerReq(data: unknown): HttpTriggerSmartChargingRequest {
    return this.validate(this.smartChargingTrigger, data);
  }

  public validateChargingStationInErrorReq(data: unknown): HttpChargingStationsInErrorRequest {
    return this.validate(this.chargingStationInErrorGet, data);
  }

  public validateChargingStationNotificationsGetReq(data: unknown): HttpDatabaseRequest {
    return this.validate(this.chargingStationNotificationsGet, data);
  }

  public validateChargingProfilesGetReq(data: unknown): HttpChargingProfilesRequest {
    return this.validate(this.chargingProfilesGet, data);
  }

  public validateChargingProfileCreateReq(data: ChargingProfile): ChargingProfile {
    return this.validate(this.chargingProfileCreate, data);
  }

  public validateChargingProfileDeleteReq(data: unknown): HttpChargingStationRequest {
    return this.validate(this.chargingProfileDelete, data);
  }

  public validateChargingProfileUpdateReq(data: unknown): ChargingProfile {
    return this.validate(this.chargingProfileUpdate, data);
  }
}
