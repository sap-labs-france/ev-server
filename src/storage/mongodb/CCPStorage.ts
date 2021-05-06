import Constants from '../../utils/Constants';
import { ContractCertificatePoolType } from '../../types/contractcertificatepool/ContractCertificatePool';
import Logging from '../../utils/Logging';
import { ObjectID } from 'mongodb';
import global from '../../types/GlobalType';

const MODULE_NAME = 'CCPStorage';

interface ccpMDB {
  _id?: ObjectID;
  ccpType: ContractCertificatePoolType;
  ccpIndex: number;
}

export default class CCPStorage {
  public static async saveDefaultCCP(ccpType: ContractCertificatePoolType, ccpIndex: number): Promise<void> {
    const uniqueTimerID = Logging.traceStart(Constants.DEFAULT_TENANT, MODULE_NAME, 'saveDefaultCCP');
    const ccpMDB: ccpMDB = {
      ccpType,
      ccpIndex
    };
    const defaultCpp = await global.database.getCollection<ccpMDB>(Constants.DEFAULT_TENANT, 'ccp').findOne({});
    await global.database.getCollection<ccpMDB>(Constants.DEFAULT_TENANT, 'ccp').findOneAndUpdate(
      { _id: defaultCpp?._id ?? new ObjectID() },
      { $set: ccpMDB },
      { upsert: true }
    );
    await Logging.traceEnd(Constants.DEFAULT_TENANT, MODULE_NAME, 'saveDefaultCCP', uniqueTimerID, ccpMDB);
  }

  public static async getDefaultCCP(): Promise<ccpMDB> {
    const uniqueTimerID = Logging.traceStart(Constants.DEFAULT_TENANT, MODULE_NAME, 'getDefaultCCP');
    const result = await global.database.getCollection<ccpMDB>(Constants.DEFAULT_TENANT, 'ccp').findOne({});
    await Logging.traceEnd(Constants.DEFAULT_TENANT, MODULE_NAME, 'getDefaultCCP', uniqueTimerID);
    return result;
  }
}
