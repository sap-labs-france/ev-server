import {expect} from 'chai';
import BaseApi from './utils/BaseApi';
import AuthenticatedBaseApi from './utils/AuthenticatedBaseApi';
import config from '../../config';
import Constants from './utils/Constants';
import chai from 'chai';
import chaiSubset from 'chai-subset';
import CompanyApi from './CompanyApi';
import SiteApi from './SiteApi';
import SiteAreaApi from './SiteAreaApi';
import UserApi from './UserApi';
import AuthenticationApi from './AuthenticationApi';
import TenantApi from './TenantApi';
import ChargingStationApi from './ChargingStationApi';
import TransactionApi from './TransactionApi';
import MailApi from './MailApi';
import SettingApi from './SettingApi';
import OCPIEndpointApi from './OCPIEndpointApi';

// Set
chai.use(chaiSubset);

export default class CentralServerService {
  
  private static _defaultInstance = new CentralServerService();

  private _tenantSubdomain: string;
  private _baseURL: string;
  private _baseApi: BaseApi;
  private _authenticatedUser: any;
  public authenticatedApi: AuthenticatedBaseApi;
  public companyApi: CompanyApi;
  public siteApi: SiteApi;
  public siteAreaApi: SiteAreaApi;
  public userApi: UserApi;
  public chargingStationApi: ChargingStationApi;
  public transactionApi: TransactionApi;
  public settingApi: SettingApi;
  public ocpiendpointApi: OCPIEndpointApi;
  public authenticatedSuperAdminApi: AuthenticatedBaseApi;
  public authenticationApi: AuthenticationApi;
  public tenantApi: TenantApi;
  public mailApi: MailApi;

  public static get DefaultInstance(): CentralServerService {
    return this._defaultInstance || (this._defaultInstance = new this());
  }

  public constructor(tenantSubdomain = null, user = null) {
    this._tenantSubdomain = tenantSubdomain;
    this._baseURL = `${config.get('server.scheme')}://${config.get('server.host')}:${config.get('server.port')}`;
    // Create the Base API
    this._baseApi = new BaseApi(this._baseURL);
    if (user) {
      this._authenticatedUser = user;
    } else {
      this._authenticatedUser = {
        email: config.get('admin.username'),
        password: config.get('admin.password')
      };
    }
    // Create the Authenticated API
    if (tenantSubdomain) {
      this.authenticatedApi = new AuthenticatedBaseApi(this._baseURL, this._authenticatedUser.email, this._authenticatedUser.password, tenantSubdomain);
    } else {
      this.authenticatedApi = new AuthenticatedBaseApi(this._baseURL, this._authenticatedUser.email, this._authenticatedUser.password, config.get('admin.tenant'));
    }
    // Create the Company
    this.companyApi = new CompanyApi(this.authenticatedApi);
    this.siteApi = new SiteApi(this.authenticatedApi);
    this.siteAreaApi = new SiteAreaApi(this.authenticatedApi);
    this.userApi = new UserApi(this.authenticatedApi);
    this.chargingStationApi = new ChargingStationApi(this.authenticatedApi, this._baseApi);
    this.transactionApi = new TransactionApi(this.authenticatedApi);
    this.settingApi = new SettingApi(this.authenticatedApi);
    this.ocpiendpointApi = new OCPIEndpointApi(this.authenticatedApi);
    this.authenticatedSuperAdminApi = new AuthenticatedBaseApi(this._baseURL, this._authenticatedUser.email, this._authenticatedUser.password, "");
    this.authenticationApi = new AuthenticationApi(this._baseApi);
    this.tenantApi = new TenantApi(this.authenticatedSuperAdminApi, this._baseApi);
    this.mailApi = new MailApi(new BaseApi(`http://${config.get('mailServer.host')}:${config.get('mailServer.port')}`));
  }

  public async updatePriceSetting(priceKWH, priceUnit) {
    const settings = await this.settingApi.readAll({});
    let newSetting = false;
    let setting = settings.data.result.find(s => s.identifier == 'pricing');
    if (!setting) {
      setting = {};
      setting.identifier = "pricing";
      newSetting = true;
    }
    setting.content = {
      simple: {
        price: priceKWH,
        currency: priceUnit
      }
    };
    if (newSetting) {
      return this.settingApi.create(setting);
    } else {
      return this.settingApi.update(setting);
    }
  }

  public async createEntity(entityApi, entity, performCheck = true) {
    // Create
    const response = await entityApi.create(entity);
    // Check
    if (performCheck) {
      expect(response.status).to.equal(200);
      expect(response.data.status).to.eql('Success');
      expect(response.data).to.have.property('id');
      expect(response.data.id).to.match(/^[a-f0-9]+$/);
      // Set the id
      entity.id = response.data.id;
      return entity;
    } else {
      // Let the caller to handle response
      return response;
    }
  }

  public async getEntityById(entityApi, entity, performCheck = true) {
    // Check first if created
    expect(entity).to.not.be.null;
    // Retrieve it from the backend
    const response = await entityApi.readById(entity.id);
    // Check
    if (performCheck) {
      // Check if ok
      expect(response.status).to.equal(200);
      expect(response.data.id).is.eql(entity.id);
      expect(response.data).to.deep.include(entity);
      // Return the entity
      return response.data;
    } else {
      // Let the caller to handle response
      return response;
    }
  }

  public async checkEntityInList(entityApi, entity, performCheck = true) {
    // Check
    expect(entity).to.not.be.null;
    // Retrieve from the backend
    const response = await entityApi.readAll({}, {
      limit: Constants.UNLIMITED,
      skip: 0
    });
    // Check
    if (performCheck) {
      // Check
      expect(response.status).to.equal(200);
      // Contains props
      expect(response.data).to.have.property('count');
      expect(response.data).to.have.property('result');
      // All record retrieved
      expect(response.data.count).to.eql(response.data.result.length);
      // Check created company
      delete entity.locale;
      expect(response.data.result).to.containSubset([entity]);
    } else {
      // Let the caller to handle response
      return response;
    }
  }

  public async checkEntityInListWithParams(entityApi, entity, params = {}, performCheck = true) {
    // Check
    expect(entity).to.not.be.null;
    // Retrieve from the backend
    const response = await entityApi.readAll(params, {
      limit: Constants.UNLIMITED,
      skip: 0
    });
    // Check
    if (performCheck) {
      // Check
      expect(response.status).to.equal(200);
      // Contains props
      expect(response.data).to.have.property('count');
      expect(response.data).to.have.property('result');
      // All record retrieved
      expect(response.data.count).to.eql(response.data.result.length);
      // Check created company
      expect(response.data.result).to.containSubset([entity]);
    } else {
      // Let the caller to handle response
      return response;
    }
  }

  public async deleteEntity(entityApi, entity, performCheck = true) {
    // Check
    expect(entity).to.not.be.null;
    // Delete it in the backend
    const response = await entityApi.delete(entity.id);
    // Check
    if (performCheck) {
      // Check
      expect(response.status).to.equal(200);
      expect(response.data.status).to.eql('Success');
      return response;
    } else {
      // Let the caller to handle response
      return response;
    }
  }

  public async updateEntity(entityApi, entity, performCheck = true) {
    // Check
    expect(entity).to.not.be.null;
    // Delete it in the backend
    const response = await entityApi.update(entity);
    // Check
    if (performCheck) {
      // Check
      expect(response.status).to.equal(200);
      expect(response.data.status).to.eql('Success');
      return response;
    } else {
      // Let the caller to handle response
      return response;
    }
  }

  public async checkDeletedEntityById(entityApi, entity, performCheck = true) {
    // Check
    expect(entity).to.not.be.null;
    // Create it in the backend
    const response = await entityApi.readById(entity.id);
    // Check
    if (performCheck) {
      // Check if not found
      expect(response.status).to.equal(550);
    } else {
      // Let the caller to handle response
      return response;
    }
  }
}

const DefaultCentralServerService = CentralServerService.DefaultInstance;
// module.exports = CentralServerService;