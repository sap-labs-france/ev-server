import Address from "../Address";

export interface HttpSiteAreaCreateRequest {
    name: string;
    address: Address;
    image: string;
    maximumPower: number;
    accessControl: boolean;
    siteID: string;
    chargeBoxIDs: string[];
}

export interface HttpSiteAreaUpdateRequest extends Partial<HttpSiteAreaCreateRequest> {
    id: string;
}