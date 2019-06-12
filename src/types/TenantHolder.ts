import Tenant from "../entity/Tenant";
import User from "../entity/User";

export default interface TenantHolder {
    tenantID: string;
    readonly id: string;
    createdBy: User;
    createdOn: number;
    lastChangedBy: User;
    lastChangedOn: number;
}