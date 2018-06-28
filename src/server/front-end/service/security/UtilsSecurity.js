const sanitize = require('mongo-sanitize');
const Authorizations = require('../../../../authorization/Authorizations');
const Utils = require('../../../../utils/Utils');

class UtilsSecurity {
	static filterBoolean(value) {
		let result = false;
		// Check boolean
		if(value) {
			// Sanitize
			value = sanitize(value);
			// Check the type
			if (typeof value == "boolean") {
				// Arealdy a boolean
				result = value;
			} else {
				// Convert
				result = (value === "true");
			}
		}
		return result;
	}

	static filterLimit(request, filteredRequest) {
		// Exist?
		if (!request.Limit) {
			// Default
			filteredRequest.Limit = 100;
		} else {
			// Parse
			filteredRequest.Limit = parseInt(sanitize(request.Limit));
			if (isNaN(filteredRequest.Limit)) {
				filteredRequest.Limit = 100;
			// Negative limit?
			} else if (filteredRequest.Limit < 0) {
				filteredRequest.Limit = 100;
			}
		}
	}

	static filterAddressRequest(address, loggedUser) {
		let filteredAddress = {};
		if (address) {
			filteredAddress.address1 = sanitize(address.address1);
			filteredAddress.address2 = sanitize(address.address2);
			filteredAddress.postalCode = sanitize(address.postalCode);
			filteredAddress.city = sanitize(address.city);
			filteredAddress.department = sanitize(address.department);
			filteredAddress.region = sanitize(address.region);
			filteredAddress.country = sanitize(address.country);
			filteredAddress.latitude = sanitize(address.latitude);
			filteredAddress.longitude = sanitize(address.longitude);
		}
		return filteredAddress;
	}

	static filterCreatedAndLastChanged(filteredEntity, entity, loggedUser) {
		if (entity.createdBy && typeof entity.createdBy == "object" &&
				Authorizations.canReadUser(loggedUser, entity.createdBy)) {
			// Build user
			filteredEntity.createdBy = Utils.buildUserFullName(entity.createdBy, false);
		}
		if (entity.lastChangedBy && typeof entity.lastChangedBy == "object" &&
				Authorizations.canReadUser(loggedUser, entity.lastChangedBy)) {
			// Build user
			filteredEntity.lastChangedBy = Utils.buildUserFullName(entity.lastChangedBy, false);
		}
		if (entity.lastChangedOn) {
			filteredEntity.lastChangedOn = entity.lastChangedOn;
		}
		if (entity.createdOn) {
			filteredEntity.createdOn = entity.createdOn;
		}
	}
}

module.exports = UtilsSecurity;
