import cfenv from 'cfenv';
import cluster from 'cluster';
import os from 'os';
import Configuration from './Configuration';
import Utils from './Utils';

export default class Database {
  public static updateID(src, dest): void {
    // Set it
    if (src.id) {
      dest.id = src.id;
    }
    if (!dest.id && src._id) {
      dest.id = src._id;
    }
    dest.id = Database.validateId(dest.id);
  }

  public static validateId(id): string {
    let changedID = id;
    // Object?
    if (changedID && (typeof changedID === 'object')) {
      // Mongo DB?
      if (changedID instanceof Buffer) {
        changedID = changedID.toString('hex');
      } else {
        changedID = changedID.toString();
      }
    }
    return changedID;
  }

  static updatePricing(src, dest, forFrontEnd = true) {
    if (forFrontEnd) {
      Database.updateID(src, dest);
    }
    dest.timestamp = Utils.convertToDate(src.timestamp);
    dest.priceKWH = Utils.convertToFloat(src.priceKWH);
    dest.priceUnit = src.priceUnit;
  }

  static updateMigration(src, dest, forFrontEnd = true) {
    if (forFrontEnd) {
      Database.updateID(src, dest);
    }
    dest.timestamp = Utils.convertToDate(src.timestamp);
    dest.name = src.name;
    dest.version = src.version;
    dest.durationSecs = Utils.convertToFloat(src.durationSecs);
  }

  static updateLock(src, dest, forFrontEnd = true) {
    if (forFrontEnd) {
      Database.updateID(src, dest);
    }
    dest.timestamp = Utils.convertToDate(src.timestamp);
    dest.type = src.type;
    dest.name = src.name;
    if (!src.hostname) {
      dest.hostname = Configuration.isCloudFoundry() ? cfenv.getAppEnv().name : os.hostname();
    } else {
      dest.hostname = src.hostname;
    }
  }

  static updateRunLock(src, dest, forFrontEnd = true) {
    if (forFrontEnd) {
      Database.updateID(src, dest);
    }
    dest.timestamp = Utils.convertToDate(src.timestamp);
    dest.type = 'runLock';
    dest.name = src.name;
    if (!src.hostname) {
      dest.hostname = Configuration.isCloudFoundry() ? cfenv.getAppEnv().name : os.hostname();
    } else {
      dest.hostname = src.hostname;
    }
  }

  static updateStatusNotification(src, dest, forFrontEnd = true) {
    if (forFrontEnd) {
      Database.updateID(src, dest);
    }
    dest.chargeBoxID = src.chargeBoxID;
    dest.connectorId = Utils.convertToInt(src.connectorId);
    dest.timestamp = Utils.convertToDate(src.timestamp);
    if (src.timezone) {
      dest.timezone = src.timezone;
    }
    dest.status = src.status;
    dest.errorCode = src.errorCode;
    dest.info = src.info;
    dest.vendorId = src.vendorId;
    dest.vendorErrorCode = src.vendorErrorCode;
  }

  static updateMeterValue(src, dest, forFrontEnd = true) {
    if (forFrontEnd) {
      Database.updateID(src, dest);
    }
    dest.chargeBoxID = src.chargeBoxID;
    dest.connectorId = Utils.convertToInt(src.connectorId);
    dest.transactionId = Utils.convertToInt(src.transactionId);
    dest.timestamp = Utils.convertToDate(src.timestamp);
    if (src.attribute.format === 'SignedData') {
      dest.value = src.value;
    } else {
      dest.value = Utils.convertToInt(src.value);
    }
    dest.attribute = src.attribute;
  }

  static updateConnection(src, dest, forFrontEnd = true) {
    dest.connectorId = src.connectorId;
    dest.createdAt = Utils.convertToDate(src.createdAt);
    dest.updatedAt = Utils.convertToDate(src.updatedAt);
    dest.validUntil = Utils.convertToDate(src.validUntil);
    if (forFrontEnd) {
      Database.updateID(src, dest);
      dest.userId = Database.validateId(src.userId);
    } else {
      dest.userId = Utils.convertToObjectID(src.userId);
    }
    dest.data = src.data;
  }

  public static updateLogging(src, dest, forFrontEnd = true): void {
    if (forFrontEnd) {
      Database.updateID(src, dest);
      dest.userID = Database.validateId(src.userID);
      dest.actionOnUserID = Database.validateId(src.actionOnUserID);
    } else {
      dest.userID = Utils.convertToObjectID(src.userID);
      dest.actionOnUserID = Utils.convertToObjectID(src.actionOnUserID);
    }
    dest.level = src.level;
    dest.source = src.source;
    if (src.hasOwnProperty('host')) {
      dest.host = src.host;
    } else {
      dest.host = Configuration.isCloudFoundry() ? cfenv.getAppEnv().name : os.hostname();
    }
    if (src.hasOwnProperty('process')) {
      dest.process = src.process;
    } else {
      dest.process = cluster.isWorker ? 'worker ' + cluster.worker.id : 'master';
    }
    dest.type = src.type;
    dest.module = src.module;
    dest.method = src.method;
    dest.timestamp = Utils.convertToDate(src.timestamp);
    dest.action = src.action;
    dest.message = src.message;
    dest.detailedMessages = src.detailedMessages;
    if (forFrontEnd && !Utils.isEmptyJSon(src.user)) {
      dest.user = {};
      src.user, dest.user;
    }
    if (forFrontEnd && !Utils.isEmptyJSon(src.actionOnUser)) {
      dest.actionOnUser = {};
      src.actionOnUser, dest.actionOnUser;
    }
  }
}
