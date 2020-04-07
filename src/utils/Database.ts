import cfenv from 'cfenv';
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

}
