import BackendError from '../../exception/BackendError';
import Constants from '../../utils/Constants';
import { CryptoKey } from '../../types/CryptoKey';
import DatabaseUtils from './DatabaseUtils';
import { ObjectID } from 'mongodb';
import global from './../../types/GlobalType';

const MODULE_NAME = 'CryptoKeyStorage';

export default class CryptoKeyStorage {
    public static async saveCryptoKey(tenantID: string, keyToSave: string): Promise<void> {

        // Check Tenant
        await DatabaseUtils.checkTenant(tenantID);

        // Check if key is provided
        if (!keyToSave) {
            throw new BackendError({
                source: Constants.CENTRAL_SERVER,
                module: MODULE_NAME,
                method: 'saveCryptoKey',
                message: 'Crypto Key not provided'
            });
        }

        // Set
        const keyMDB: any = {
            _id: new ObjectID(),
            key: keyToSave
        };

        // Save document
        await global.database.getCollection<any>(tenantID, 'keys').insertOne(keyMDB);

    }
}
