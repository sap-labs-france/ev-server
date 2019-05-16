const CentralServerService = require('../client/CentralServerService');
const Constants = require('../../../src/utils/Constants');
const Utils = require('../../../src/utils/Utils');
const Factory = require('../../factories/Factory');
const TenantFactory = require('../../factories/TenantFactory');
const UserFactory = require('../../factories/UserFactory');
const {
  TENANT_CONTEXTS,
  ORGANIZATION_CONTEXTS
} = require('./ContextConstants');
const User = require('../../../src/entity/User');
const Tenant = require('../../../src/entity/Tenant');
const config = require('../../config');
const MongoDBStorage = require('../../../src/storage/mongodb/MongoDBStorage');
const TenantContext = require('./TenantContext');
const faker = require('faker');
const OrganizationContext = require('./OrganizationContext');

const TENANT_CONTEXT_LIST = [{
    contextName: TENANT_CONTEXTS.TENANT_WITH_ALL_COMPONENTS,
    tenantName: 'ut-all',
    subdomain: 'utall',
    siteContexts: [{
        contextName: ORGANIZATION_CONTEXTS.SITE_WITH_ACL,
        siteName: 'ut-site',
        siteAreaName: 'WithACL'
      },
      {
        contextName: ORGANIZATION_CONTEXTS.SITE_WITH_AUTO_USER_ASSIGNMENT,
        siteName: 'ut-site-auto',
        siteAreaName: 'WithACL'
      },
      {
        contextName: ORGANIZATION_CONTEXTS.SITE_WITH_NO_ACL,
        siteName: 'ut-site',
        siteAreaName: 'NoACL'
      },
      {
        contextName: ORGANIZATION_CONTEXTS.SITE_WITH_OTHER_USER_STOP_AUTHPORIZATION,
        siteName: 'ut-site-stop',
        siteAreaName: 'WithACL'
      }
    ]
  },
  {
    contextName: TENANT_CONTEXTS.TENANT_WITH_NO_COMPONENTS,
    tenantName: 'ut-nothing',
    subdomain: 'utnothing',
    siteContexts: [{
      contextName: ORGANIZATION_CONTEXTS.NO_ORGANIZATION
    }]
  },
  {
    contextName: TENANT_CONTEXTS.TENANT_WITH_NO_ORGANIZATION,
    tenantName: 'ut-noorg',
    subdomain: 'utnoorg',
    siteContexts: [{
      contextName: ORGANIZATION_CONTEXTS.NO_ORGANIZATION
    }]
  },
  {
    contextName: TENANT_CONTEXTS.TENANT_WITH_NO_PRICING,
    tenantName: 'ut-nopricing',
    subdomain: 'utnoprice',
    siteContexts: [{
        contextName: ORGANIZATION_CONTEXTS.SITE_WITH_ACL,
        siteName: 'ut-site',
        siteAreaName: 'WithACL'
      },
      {
        contextName: ORGANIZATION_CONTEXTS.SITE_WITH_AUTO_USER_ASSIGNMENT,
        siteName: 'ut-site-auto',
        siteAreaName: 'WithACL'
      },
      {
        contextName: ORGANIZATION_CONTEXTS.SITE_WITH_NO_ACL,
        siteName: 'ut-site',
        siteAreaName: 'NoACL'
      },
      {
        contextName: ORGANIZATION_CONTEXTS.SITE_WITH_OTHER_USER_STOP_AUTHPORIZATION,
        siteName: 'ut-site-stop',
        siteAreaName: 'WithACL'
      }
    ]
  },
  {
    contextName: TENANT_CONTEXTS.TENANT_WITH_NO_OCPI,
    tenantName: 'ut-noocpi',
    subdomain: 'utnoocpi',
    siteContexts: [{
        contextName: ORGANIZATION_CONTEXTS.SITE_WITH_ACL,
        siteName: 'ut-site',
        siteAreaName: 'WithACL'
      },
      {
        contextName: ORGANIZATION_CONTEXTS.SITE_WITH_AUTO_USER_ASSIGNMENT,
        siteName: 'ut-site-auto',
        siteAreaName: 'WithACL'
      },
      {
        contextName: ORGANIZATION_CONTEXTS.SITE_WITH_NO_ACL,
        siteName: 'ut-site',
        siteAreaName: 'NoACL'
      },
      {
        contextName: ORGANIZATION_CONTEXTS.SITE_WITH_OTHER_USER_STOP_AUTHPORIZATION,
        siteName: 'ut-site-stop',
        siteAreaName: 'WithACL'
      }
    ]
  },
  {
    contextName: TENANT_CONTEXTS.TENANT_WITH_NO_FUNDING,
    tenantName: 'ut-norefund',
    subdomain: 'utnorefund',
    siteContexts: [{
        contextName: ORGANIZATION_CONTEXTS.SITE_WITH_ACL,
        siteName: 'ut-site',
        siteAreaName: 'WithACL'
      },
      {
        contextName: ORGANIZATION_CONTEXTS.SITE_WITH_AUTO_USER_ASSIGNMENT,
        siteName: 'ut-site-auto',
        siteAreaName: 'WithACL'
      },
      {
        contextName: ORGANIZATION_CONTEXTS.SITE_WITH_NO_ACL,
        siteName: 'ut-site',
        siteAreaName: 'NoACL'
      },
      {
        contextName: ORGANIZATION_CONTEXTS.SITE_WITH_OTHER_USER_STOP_AUTHPORIZATION,
        siteName: 'ut-site-stop',
        siteAreaName: 'WithACL'
      }
    ]
  }
];

class ContextProvider {

  constructor() {
    // Create a super admin interface
    this.superAdminCentralServerService = new CentralServerService(null, true);
    this.tenantsContexts = [];
    // Create MongoDB
    global.database = new MongoDBStorage(config.get('storage'));
    this.initialized = false;
  }

  async _init() {
    if (!this.initialized) {
      // Connect to the the DB
      await global.database.start();
    }
    this.initialized = true;
  }

  async destroy() {
    return setTimeout(() => { // Delay deletion as unit tests are faster than processing
      if (this.tenantsContexts) {
        this.tenantsContexts.forEach(async (tenantContext) => {
          // console.log('DESTROY context ' + tenantContext.getTenant().id + ' ' + tenantContext.getTenant().subdomain);
          await this.superAdminCentralServerService.deleteEntity(this.superAdminCentralServerService.tenantApi, tenantContext.getTenant());
        });
      }
    }, 10000);
  }

  async prepareContexts(tenantContextNames) {
    await this._init();
    // Prepare list of tenants to create
    let tenantContexts = TENANT_CONTEXT_LIST;
    if (tenantContextNames) {
      if (!Array.isArray(tenantContextNames)) {
        tenantContextNames = [tenantContextNames];
      }
      tenantContexts = tenantContextNames.map((contextName) => {
        return TENANT_CONTEXT_LIST.find((tenantContext) => {
          tenantContext.contextName === contextName;
        });
      });
    }
    // Build each tenant context
    for (const tenantContextDef of tenantContexts) {
      // console.log(`==> Prepare tenant context ${tenantContextDef.contextName}`);
      await this._buildTenantContext(tenantContextDef);
    }
  }

  async getTenantContext(tenantContextName) {
    await this._init();
    const tenantContext = this._getTenantContext(tenantContextName);

    // Check if already loaded
    if (tenantContext) {
      return tenantContext;
    }

    // Not find build context
    // console.log(`Tenant context ${tenantContextName}/${organizationContextName} not find ===> Build it!`);
    return await this._buildTenantContext(this._getTenantContextDef(tenantContextName));
  }

  async _buildTenantContext(tenantContextDef) {
    // Build component list
    const components = {};
    switch (tenantContextDef.contextName) {
      case TENANT_CONTEXTS.TENANT_WITH_ALL_COMPONENTS:
        for (const component in Constants.COMPONENTS) {
          components[Constants.COMPONENTS[component]] = {
            active: true
          };
        }
        break;
      case TENANT_CONTEXTS.TENANT_WITH_NO_COMPONENTS:
        // no components
        break;
      case TENANT_CONTEXTS.TENANT_WITH_NO_ORGANIZATION:
        for (const component in Constants.COMPONENTS) {
          components[Constants.COMPONENTS[component]] = {
            active: (Constants.COMPONENTS[component] !== Constants.COMPONENTS.ORGANIZATION)
          };
        }
        break;
      case TENANT_CONTEXTS.TENANT_WITH_NO_PRICING:
        for (const component in Constants.COMPONENTS) {
          components[Constants.COMPONENTS[component]] = {
            active: (Constants.COMPONENTS[component] !== Constants.COMPONENTS.PRICING)
          };
        }
        break;
      case TENANT_CONTEXTS.TENANT_WITH_NO_OCPI:
        for (const component in Constants.COMPONENTS) {
          components[Constants.COMPONENTS[component]] = {
            active: (Constants.COMPONENTS[component] !== Constants.COMPONENTS.OCPI)
          };
        }
        break;
      case TENANT_CONTEXTS.TENANT_WITH_NO_FUNDING:
        for (const component in Constants.COMPONENTS) {
          components[Constants.COMPONENTS[component]] = {
            active: (Constants.COMPONENTS[component] !== Constants.COMPONENTS.REFUND)
          };
        }
        break;
      default:
        throw 'Unknown context name ' + tenantContextDef.context;
    }
    // Check if tenant exist
    const tenantEntity = await Tenant.getTenantByName(tenantContextDef.tenantName);
    let buildTenant = {};
    if (tenantEntity) {
      buildTenant = tenantEntity.getModel();
    } else {
      // Create Tenant
      const dummyTenant = TenantFactory.buildTenantCreate();
      dummyTenant.name = tenantContextDef.tenantName;
      dummyTenant.subdomain = tenantContextDef.subdomain;
      buildTenant = await this.superAdminCentralServerService.createEntity(
        this.superAdminCentralServerService.tenantApi, dummyTenant);
      // Update components
      buildTenant.components = components;
      await this.superAdminCentralServerService.updateEntity(
        this.superAdminCentralServerService.tenantApi, buildTenant);
    }
    // Retrieve default admin user created as first user in the list of existing user
    const basicUserList = await User.getUsers(buildTenant.id).result;
    let defaultAdminUser = null;
    // Search existing admin 
    if (basicUserList && Array.isArray(basicUserList)) {
      defaultAdminUser = basicUserList.find((user) => {
        return user.getRole() === 'A';
      });
    }
    if (!defaultAdminUser) {
      // Create a user form scratch
      const tempAdminUser = Factory.user.build();
      // Generate the password hash
      const newPasswordHashed = await User.hashPasswordBcrypt(config.get('admin.password'));
      const verificationToken = Utils.generateToken(config.get('admin.username'));
      // create Admin user
      const tenantUser = new User(buildTenant.id, {
        name: tempAdminUser.name,
        firstName: tempAdminUser.firstName,
        password: newPasswordHashed,
        status: Constants.USER_STATUS_ACTIVE,
        role: Constants.ROLE_ADMIN,
        email: config.get('admin.username'),
        createdOn: new Date().toISOString(),
        verificationToken: verificationToken
      });
      defaultAdminUser = await tenantUser.save();
      // Add a Tag ID
      defaultAdminUser.setTagIDs([faker.random.alphaNumeric(8).toUpperCase()]);
      await defaultAdminUser.save();
    } else if (defaultAdminUser.getStatus() !== 'A') {
      // Activate user
      defaultAdminUser.setStatus('A');
      // Generate the password hash
      const newPasswordHashed = await User.hashPasswordBcrypt(config.get('admin.password'));
      // Update the password
      defaultAdminUser.setPassword(newPasswordHashed);
      // Update the email
      defaultAdminUser.setEMail(config.get('admin.username'));
      // Add a Tag ID
      defaultAdminUser.setTagIDs([faker.random.alphaNumeric(8).toUpperCase()]);
      await defaultAdminUser.save();
    } 
    
    // Create Central Server Service
    const localCentralServiceService = new CentralServerService(buildTenant.subdomain);
    let chargingStationList = null;
    let siteAreaList = null;
    let siteList = null;
    let companyList = null;
    let userList = null;
    if (tenantEntity) { // Not new tenant
      // Read all existing entities
      chargingStationList = (await localCentralServiceService.chargingStationApi.readAll()).data.result;
      siteAreaList = (await localCentralServiceService.siteAreaApi.readAll()).data.result;
      siteList = (await localCentralServiceService.siteApi.readAll()).data.result;
      companyList = (await localCentralServiceService.companyApi.readAll()).data.result;
      userList = (await localCentralServiceService.userApi.readAll()).data.result;
    }
    // read admin user
    const adminUser = (await localCentralServiceService.getEntityById(
      localCentralServiceService.userApi, defaultAdminUser.getModel(), false)).data;
    if (!userList) {
      userList = [adminUser];
    }
    // Perpare basic user
    let basicUser = null;
    if (!tenantEntity || (Array.isArray(userList) && userList.findIndex((user) => {
        return user.role === 'B';
      }) === -1)) {
      // Create Basic User
      basicUser = await localCentralServiceService.createEntity(
        localCentralServiceService.userApi, UserFactory.build());
      basicUser.email = 'basic-' + defaultAdminUser.getEMail();
      // Update the password
      basicUser.passwords.repeatPassword = basicUser.passwords.password = config.get('admin.password');
      basicUser.role = 'B';
      await localCentralServiceService.updateEntity(
        localCentralServiceService.userApi, basicUser);
    } else {
      basicUser = userList.find((user) => {
        return user.role === 'B';
      });
    }
    localCentralServiceService.setBasicUserAuthentication(basicUser.email, (basicUser.passwords && basicUser.passwords.password ? basicUser.passwords.password : config.get('admin.password')));
    userList.push(basicUser);
    // prepare demo user
    let demoUser = null;
    if (!tenantEntity || (Array.isArray(userList) && userList.findIndex((user) => {
        return user.role === 'D';
      }) === -1)) {
      // Create Demo User
      demoUser = await localCentralServiceService.createEntity(
        localCentralServiceService.userApi, UserFactory.build());
      demoUser.email = 'demo-' + defaultAdminUser.getEMail();
      // Update the password
      demoUser.passwords.repeatPassword = demoUser.passwords.password = config.get('admin.password');
      demoUser.role = 'D';
      await localCentralServiceService.updateEntity(
        localCentralServiceService.userApi, demoUser);
    } else {
      demoUser = userList.find((user) => {
        return user.role === 'D';
      });
    }
    localCentralServiceService.setDemoUserAuthentication(demoUser.email, (demoUser.passwords && demoUser.passwords.password ? demoUser.passwords.password : config.get('admin.password')));
    userList.push(demoUser);

    // Persist tenant context
    const newTenantContext = new TenantContext(tenantContextDef.contextName, buildTenant, localCentralServiceService);
    this.tenantsContexts.push(newTenantContext);
    // console.log('CREATED tenant context ' + newTenantContext.getTenant().id +
    //   ' ' + newTenantContext.getTenant().subdomain);
    newTenantContext.getContext().users = userList;

    if (tenantContextDef.siteContexts && Array.isArray(tenantContextDef.siteContexts) && tenantContextDef.siteContexts.length > 0) {
      let company = null;
      for (const siteContext of tenantContextDef.siteContexts) {
        let site = null;
        const organizationContext = new OrganizationContext(siteContext.contextName);
        newTenantContext.addOrganizationContext(organizationContext);

        if (siteContext.contextName !== ORGANIZATION_CONTEXTS.NO_ORGANIZATION) {
          if (companyList && Array.isArray(companyList) && companyList.length > 0) {
            company = companyList[0];
            newTenantContext.getContext().companies.push(company);
          } else {
            // Create Company
            company = await newTenantContext.createCompany();
          }
          if (siteList && Array.isArray(siteList)) {
            // Site already exist
            site = siteList.find((site) => {
              return site.name === siteContext.siteName;
            });
          } 
          if (site) {
            organizationContext.getSites().push(site);
          } else {
            // Create site
            const siteTemplate = Factory.site.build({
              companyID: company.id,
              userIDs: newTenantContext.getContext().users.map(user => user.id)
            });
            siteTemplate.name = siteContext.siteName;
            siteTemplate.allowAllUsersToStopTransactions = false;
            siteTemplate.autoUserSiteAssignment = false;
            // handle site switch
            switch (siteContext.contextName) {
              case ORGANIZATION_CONTEXTS.SITE_WITH_AUTO_USER_ASSIGNMENT:
                siteTemplate.autoUserSiteAssignment = true;
                break;
              case ORGANIZATION_CONTEXTS.SITE_WITH_OTHER_USER_STOP_AUTHPORIZATION:
                siteTemplate.allowAllUsersToStopTransactions = true;
                break;
              default:
                break;
            }
            site = await newTenantContext.createSite(company, newTenantContext.getContext().users, siteContext.contextName, siteTemplate);
          }
        }
        let chargingStation = null;
        if (chargingStationList && Array.isArray(chargingStationList)) {
          // Search if we already have a charging station in the required site area
          chargingStation = chargingStationList.find((chargingStation) => {
            if (siteContext.contextName === ORGANIZATION_CONTEXTS.NO_ORGANIZATION) {
              return chargingStation.ocppVersion === '1.6';
            } else if (siteAreaList && Array.isArray(siteAreaList)) {
              const chargingStationSiteArea = siteAreaList.find((siteArea) => {
                return siteArea.id === chargingStation.siteAreaID;
              });
              return chargingStation.ocppVersion === '1.6' && chargingStationSiteArea.name === siteContext.siteAreaName;
            } else {
              return false; // should not happen
            }
          });
        }
        if (chargingStation) {
          organizationContext.getChargingStations().push(chargingStation);
        } else {
          // create charging station
          chargingStation = await newTenantContext.createChargingStation('1.6', siteContext.contextName);
        }
        if (siteContext.contextName !== ORGANIZATION_CONTEXTS.NO_ORGANIZATION) {
          let existingSiteArea = null;
          if (siteAreaList && Array.isArray(siteAreaList)) {
            existingSiteArea = siteAreaList.find((siteArea) => {
              return siteArea.name === siteContext.siteAreaName && siteArea.siteID === site.id;
            });
          }
          if (!existingSiteArea) {
            // create site Area template
            const siteAreaTemplate = Factory.siteArea.build({
              siteID: site.id,
            });
            siteAreaTemplate.name = siteContext.siteAreaName;
            // handle access control
            siteAreaTemplate.accessControl = siteContext.contextName !== ORGANIZATION_CONTEXTS.SITE_WITH_NO_ACL;
            // create site area
            await newTenantContext.createSiteArea(site, [chargingStation], siteContext.contextName, siteAreaTemplate);
          } else {
            organizationContext.getSiteAreas().push(existingSiteArea);
          }
        }
      }
    }
    return newTenantContext;
  }

  async initializeContent(tenantContextNames) {
    await this._init();
    // Prepare list of tenants to initialize
    let tenantContexts = TENANT_CONTEXT_LIST;
    if (tenantContextNames) {
      if (!Array.isArray(tenantContextNames)) {
        tenantContextNames = [tenantContextNames];
      }
      tenantContexts = tenantContextNames.map((contextName) => {
        return TENANT_CONTEXT_LIST.find((tenantContext) => {
          return tenantContext.contextName === contextName;
        });
      });
    }
    // Recreate each tenant context
    for (const tenantContextDef of tenantContexts) {
      // console.log(`\t==> Initialize tenant context ${tenantContextDef.contextName}`);
      const tenantContext = this._getTenantContext(tenantContextDef.contextName);
      // Get tenant
      const tenantEntity = await Tenant.getTenantByName(tenantContext.tenant.name);
      // Delete all collections
      await tenantEntity.deleteEnvironment();
      // await global.database.deleteTenantDatabase(tenantEntity.getID());
      // Create default collections
      await tenantEntity.createEnvironment();
      // await global.database.checkAndCreateTenantDatabase(tenantEntity.id);
      // create content data
      await this._buildTenantContext(tenantContextDef);
    }
    
  }

  async initializeAllTenantContents() {
    await this._init();
    // Prepare list of tenants to create
    const tenantContextNames = TENANT_CONTEXT_LIST.map((context) => {
      return context.contextName;
    });
    await this.initializeContent(tenantContextNames);
  }

  _getTenantContextDef(tenantContextName, checkValid = true) {
    const tenantContext = TENANT_CONTEXT_LIST.find((context) => {
      return context.contextName === tenantContextName;
    });
    if (!tenantContext && checkValid) {
      throw 'Unknown context name ' + tenantContextName;
    }
    return tenantContext;
  }

  _getTenantContext(tenantContextName, checkValid = true) {
    const tenantContextDef = this._getTenantContextDef(tenantContextName, checkValid);
    return this.tenantsContexts.find((tenantContext) => {
      return (tenantContext.contextName === tenantContextName);
    });
  }

}

module.exports = new ContextProvider();