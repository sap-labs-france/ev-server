import Address from "../Address";

export interface SiteAreaCreate {
    name: string;
    address: Address;
    image: string;
    maximumPower: number;
    accessControl: boolean;
    siteID: string;
    chargeBoxIDs: string[];
}

export interface SiteAreaUpdate {
    id: string;
    name?: string;
    address?: Address;
    image?: string;
    maximumPower?: number;
    accessControl?: boolean;
    siteID?: string;
    chargeBoxIDs?: string[];
}