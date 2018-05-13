const Database = require('../utils/Database');
const User = require('./User');

class Company {
	constructor(company) {
		// Init model
		this._model = {};

		// Set it
		Database.updateCompany(company, this._model);
	}

	getModel() {
		return this._model;
	}

	getID() {
		return this._model.id;
	}

	setName(name) {
		this._model.name = name;
	}

	getName() {
		return this._model.name;
	}

	setAddress(address) {
		this._model.address = address;
	}

	getAddress() {
		return this._model.address;
	}

	getLogo() {
		return this._model.logo;
	}

	setLogo(logo) {
		this._model.logo = logo;
	}

	getCreatedBy() {
		if (this._model.createdBy) {
			return new User(this._model.createdBy);
		}
		return null;
	}

	setCreatedBy(user) {
		this._model.createdBy = user.getModel();
	}

	getCreatedOn() {
		return this._model.createdOn;
	}

	setCreatedOn(createdOn) {
		this._model.createdOn = createdOn;
	}

	getLastChangedBy() {
		if (this._model.lastChangedBy) {
			return new User(this._model.lastChangedBy);
		}
		return null;
	}

	setLastChangedBy(user) {
		this._model.lastChangedBy = user.getModel();
	}

	getLastChangedOn() {
		return this._model.lastChangedOn;
	}

	setLastChangedOn(lastChangedOn) {
		this._model.lastChangedOn = lastChangedOn;
	}

	getSites() {
		if (this._model.sites) {
			return Promise.resolve(this._model.sites.map((site) => {
				return new Site(site);
			}));
		} else {
			// Get from DB
			return global.storage.getSites(null, this.getID()).then((sites) => {
				// Keep it
				this.setSites(sites);
				return sites;
			});
		}
	}

	setSites(sites) {
		this._model.sites = sites.map((site) => {
			return site.getModel();
		});
	}

	getUserIDs() {
		return (this._model.userIDs?this._model.userIDs:[]);
	}

	getUsers() {
		if (this._model.users) {
			return Promise.resolve(this._model.users.map((user) => {
				return new User(user);
			}));
		} else if (this._model.userIDs) {
			let proms = [];
			// Get Users
			this._model.userIDs.forEach((userID) => {
				// Add
				proms.push(global.storage.getUser(userID));
			});
			return Promise.all(proms).then((users) => {
				// Keep it
				this.setUsers(users);
				return users;
			});
		} else {
			return Promise.resolve([]);
		}
	}

	setUsers(users) {
		this._model.users = users.map((user) => {
			return user.getModel();
		});
		this._model.userIDs = users.map((user) => {
			return user.getID();
		});
	}

	removeUser(user) {
		if (this._model.users) {
			// Search
			for (var i = 0; i < this._model.users.length; i++) {
				if (this._model.users[i].id == user.getID()) {
					// Remove
					this._model.users.splice(i, 1);
					break;
				}
			}
		}
		if (this._model.userIDs) {
			// Search
			for (var i = 0; i < this._model.userIDs.length; i++) {
				if (this._model.userIDs[i] == user.getID()) {
					// Remove
					this._model.userIDs.splice(i, 1);
					break;
				}
			}
		}
	}

	save() {
		return global.storage.saveCompany(this.getModel());
	}

	saveLogo() {
		return global.storage.saveCompanyLogo(this.getModel());
	}

	delete() {
		return global.storage.deleteCompany(this.getID());
	}
}

module.exports = Company;
