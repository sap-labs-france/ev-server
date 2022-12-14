import { DynamicAuthorizationAssertName, DynamicAuthorizationDataSourceData, DynamicAuthorizationDataSourceName, DynamicAuthorizationFilterName } from '../types/Authorization';

import AssignedSitesCompaniesDynamicAuthorizationDataSource from './dynamic-data-source/AssignedSitesCompaniesDynamicAuthorizationDataSource';
import AssignedSitesCompaniesDynamicAuthorizationFilter from './dynamic-filters/AssignedSitesCompaniesDynamicAuthorizationFilter';
import AssignedSitesDynamicAuthorizationDataSource from './dynamic-data-source/AssignedSitesDynamicAuthorizationDataSource';
import AssignedSitesDynamicAuthorizationFilter from './dynamic-filters/AssignedSitesDynamicAuthorizationFilter';
import BasicUserDynamicAuthorizationAssert from './dynamic-assert/BasicUserDynamicAuthorizationAssert';
import DynamicAuthorizationAssert from './DynamicAuthorizationAssert';
import DynamicAuthorizationDataSource from './DynamicAuthorizationDataSource';
import DynamicAuthorizationFilter from './DynamicAuthorizationFilter';
import ExcludeActionDynamicAuthorizationDataSource from './dynamic-data-source/ExcludeActionDynamicAuthorizationDataSource';
import ExcludeActionDynamicAuthorizationFilter from './dynamic-filters/ExcludeActionDynamicAuthorizationFilter';
import LocalIssuerDynamicAuthorizationFilter from './dynamic-filters/LocalIssuerDynamicAuthorizationFilter';
import OwnUserDynamicAuthorizationAssert from './dynamic-assert/OwnUserDynamicAuthorizationAssert';
import OwnUserDynamicAuthorizationDataSource from './dynamic-data-source/OwnUserDynamicAuthorizationDataSource';
import OwnUserDynamicAuthorizationFilter from './dynamic-filters/OwnUserDynamicAuthorizationFilter';
import PoolCarDynamicAuthorizationAssert from './dynamic-assert/PoolCarDynamicAuthorizationAssert';
import SiteAreaMandatoryDynamicAuthorizationAssert from './dynamic-assert/SiteAreaMandatoryDynamicAuthorizationAssert';
import SitesAdminDynamicAuthorizationDataSource from './dynamic-data-source/SitesAdminDynamicAuthorizationDataSource';
import SitesAdminDynamicAuthorizationFilter from './dynamic-filters/SitesAdminDynamicAuthorizationFilter';
import SitesAdminOrOwnerDynamicAuthorizationDataSource from './dynamic-data-source/SitesAdminOrOwnerDynamicAuthorizationDataSource';
import SitesAdminOrOwnerDynamicAuthorizationFilter from './dynamic-filters/SitesAdminOrOwnerDynamicAuthorizationFilter';
import SitesAdminUsersDynamicAuthorizationDataSource from './dynamic-data-source/SitesAdminUsersDynamicAuthorizationDataSource';
import SitesAdminUsersDynamicAuthorizationFilter from './dynamic-filters/SitesAdminUsersDynamicAuthorizationFilter';
import SitesOwnerDynamicAuthorizationDataSource from './dynamic-data-source/SitesOwnerDynamicAuthorizationDataSource';
import SitesOwnerDynamicAuthorizationFilter from './dynamic-filters/SitesOwnerDynamicAuthorizationFilter';
import SitesOwnerUsersDynamicAuthorizationDataSource from './dynamic-data-source/SitesOwnerUsersDynamicAuthorizationDataSource';
import SitesOwnerUsersDynamicAuthorizationFilter from './dynamic-filters/SitesOwnerUsersDynamicAuthorizationFilter';
import Tenant from '../types/Tenant';
import UserMandatoryDynamicAuthorizationAssert from './dynamic-assert/UserMandatoryDynamicAuthorizationAssert';
import UserToken from '../types/UserToken';

export default class DynamicAuthorizationFactory {
  public static async getDynamicFilter(tenant: Tenant, userToken: UserToken,
      filterName: DynamicAuthorizationFilterName,
      existingDataSources?: Map<DynamicAuthorizationDataSourceName, DynamicAuthorizationDataSource<DynamicAuthorizationDataSourceData>>):
      Promise<DynamicAuthorizationFilter> {
    // Check invertion of filter
    let negateFilter = false;
    if (filterName?.startsWith('-')) {
      negateFilter = true;
      filterName = filterName.substring(1) as DynamicAuthorizationFilterName;
    }
    // Return the implementation
    let dynamicFilter: DynamicAuthorizationFilter;
    switch (filterName) {
      case DynamicAuthorizationFilterName.ASSIGNED_SITES_COMPANIES:
        dynamicFilter = new AssignedSitesCompaniesDynamicAuthorizationFilter(tenant, userToken, negateFilter);
        break;
      case DynamicAuthorizationFilterName.SITES_ADMIN:
        dynamicFilter = new SitesAdminDynamicAuthorizationFilter(tenant, userToken, negateFilter);
        break;
      case DynamicAuthorizationFilterName.SITES_ADMIN_USERS:
        dynamicFilter = new SitesAdminUsersDynamicAuthorizationFilter(tenant, userToken, negateFilter);
        break;
      case DynamicAuthorizationFilterName.SITES_OWNER:
        dynamicFilter = new SitesOwnerDynamicAuthorizationFilter(tenant, userToken, negateFilter);
        break;
      case DynamicAuthorizationFilterName.ASSIGNED_SITES:
        dynamicFilter = new AssignedSitesDynamicAuthorizationFilter(tenant, userToken, negateFilter);
        break;
      case DynamicAuthorizationFilterName.OWN_USER:
        dynamicFilter = new OwnUserDynamicAuthorizationFilter(tenant, userToken, negateFilter);
        break;
      case DynamicAuthorizationFilterName.EXCLUDE_ACTION:
        dynamicFilter = new ExcludeActionDynamicAuthorizationFilter(tenant, userToken, negateFilter);
        break;
      case DynamicAuthorizationFilterName.LOCAL_ISSUER:
        dynamicFilter = new LocalIssuerDynamicAuthorizationFilter(tenant, userToken, negateFilter);
        break;
      case DynamicAuthorizationFilterName.SITES_ADMIN_OR_OWNER:
        dynamicFilter = new SitesAdminOrOwnerDynamicAuthorizationFilter(tenant, userToken, negateFilter);
        break;
      case DynamicAuthorizationFilterName.SITES_OWNER_USERS:
        dynamicFilter = new SitesOwnerUsersDynamicAuthorizationFilter(tenant, userToken, negateFilter);
        break;
    }
    // Init Data Source
    if (dynamicFilter) {
      await DynamicAuthorizationFactory.initFilterDataSources(tenant, userToken, dynamicFilter, existingDataSources);
    }
    return dynamicFilter;
  }

  public static getDynamicAssert(tenant: Tenant, userToken: UserToken, assertName: DynamicAuthorizationAssertName): DynamicAuthorizationAssert {
    // Check invertion of filter
    let negateAssert = false;
    if (assertName?.startsWith('-')) {
      negateAssert = true;
      assertName = assertName.substring(1) as DynamicAuthorizationAssertName;
    }
    // Return the implementation
    let dynamicAssert: DynamicAuthorizationAssert;
    switch (assertName) {
      case DynamicAuthorizationAssertName.POOL_CAR:
        dynamicAssert = new PoolCarDynamicAuthorizationAssert(tenant, userToken, negateAssert);
        break;
      case DynamicAuthorizationAssertName.OWN_USER:
        dynamicAssert = new OwnUserDynamicAuthorizationAssert(tenant, userToken, negateAssert);
        break;
      case DynamicAuthorizationAssertName.BASIC_USER:
        dynamicAssert = new BasicUserDynamicAuthorizationAssert(tenant, userToken, negateAssert);
        break;
      case DynamicAuthorizationAssertName.USER_MANDATORY:
        dynamicAssert = new UserMandatoryDynamicAuthorizationAssert(tenant, userToken, negateAssert);
        break;
      case DynamicAuthorizationAssertName.SITE_AREA_MANDATORY:
        dynamicAssert = new SiteAreaMandatoryDynamicAuthorizationAssert(tenant, userToken, negateAssert);
        break;
    }
    return dynamicAssert;
  }

  public static async getDynamicDataSource(tenant: Tenant, user: UserToken,
      dataSourceName: DynamicAuthorizationDataSourceName): Promise<DynamicAuthorizationDataSource<DynamicAuthorizationDataSourceData>> {
    let dataSource: DynamicAuthorizationDataSource<DynamicAuthorizationDataSourceData>;
    switch (dataSourceName) {
      case DynamicAuthorizationDataSourceName.ASSIGNED_SITES_COMPANIES:
        dataSource = new AssignedSitesCompaniesDynamicAuthorizationDataSource(tenant, user);
        break;
      case DynamicAuthorizationDataSourceName.SITES_ADMIN:
        dataSource = new SitesAdminDynamicAuthorizationDataSource(tenant, user);
        break;
      case DynamicAuthorizationDataSourceName.SITES_ADMIN_USERS:
        dataSource = new SitesAdminUsersDynamicAuthorizationDataSource(tenant, user);
        break;
      case DynamicAuthorizationDataSourceName.SITES_OWNER:
        dataSource = new SitesOwnerDynamicAuthorizationDataSource(tenant, user);
        break;
      case DynamicAuthorizationDataSourceName.ASSIGNED_SITES:
        dataSource = new AssignedSitesDynamicAuthorizationDataSource(tenant, user);
        break;
      case DynamicAuthorizationDataSourceName.OWN_USER:
        dataSource = new OwnUserDynamicAuthorizationDataSource(tenant, user);
        break;
      case DynamicAuthorizationDataSourceName.EXCLUDE_ACTION:
        dataSource = new ExcludeActionDynamicAuthorizationDataSource(tenant, user);
        break;
      case DynamicAuthorizationDataSourceName.SITES_ADMIN_OR_OWNER:
        dataSource = new SitesAdminOrOwnerDynamicAuthorizationDataSource(tenant, user);
        break;
      case DynamicAuthorizationDataSourceName.SITES_OWNER_USERS:
        dataSource = new SitesOwnerUsersDynamicAuthorizationDataSource(tenant, user);
        break;
    }
    // Load data
    if (dataSource) {
      await dataSource.loadData();
    }
    return dataSource;
  }

  private static async initFilterDataSources(tenant: Tenant, user: UserToken, dynamicFilter: DynamicAuthorizationFilter,
      existingDataSources?: Map<DynamicAuthorizationDataSourceName, DynamicAuthorizationDataSource<DynamicAuthorizationDataSourceData>>): Promise<void> {
    // Get Data Source
    const dataSourceNames = dynamicFilter.getApplicableDataSources();
    for (const dataSourceName of dataSourceNames) {
      let dataSource = existingDataSources.get(dataSourceName);
      if (!dataSource) {
        // Create the data source
        dataSource = await DynamicAuthorizationFactory.getDynamicDataSource(tenant, user, dataSourceName);
        // Add
        existingDataSources.set(dataSourceName, dataSource);
      }
      // Set
      dynamicFilter.setDataSource(dataSourceName, dataSource);
    }
  }
}
