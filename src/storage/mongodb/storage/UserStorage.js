const Constants = require('../../../utils/Constants');
const Logging = require('../../../utils/Logging');
const Database = require('../../../utils/Database');
const Configuration = require('../../../utils/Configuration');
const Users = require('../../../utils/Users');
const Utils = require('../../../utils/Utils');
const MDBUser = require('../model/MDBUser');
const MDBTag = require('../model/MDBTag');
const MDBEula = require('../model/MDBEula');
const User = require('../../../model/User');
const crypto = require('crypto');

let _centralRestServer;

class UserStorage {
	static setCentralRestServer(centralRestServer) {
		_centralRestServer = centralRestServer;
	}

	static handleGetEndUserLicenseAgreement(language="en") {
		let languageFound = false;
		let currentEula;
		let currentEulaHash;
		let newEula;
		let supportLanguages = Configuration.getLocalesConfig().supported;

		supportLanguages.forEach(supportLanguage => {
			if (language == supportLanguage.substring(0, 2)) {
				languageFound = true;
			}
		});
		if (!languageFound) {
			language = "en";
		}
		// Get current eula
		currentEula = Users.getEndUserLicenseAgreement(language);
		// Read DB
		return MDBEula.findOne({"language":language})
				.sort({"version": -1})
				.then((eulaMDB) => {
			let eula = null;
			// Set
			if (!eulaMDB) {
				// Create Default
				eula = {};
				eula.timestamp = new Date();
				eula.language = language;
				eula.version = 1;
				eula.text = currentEula;
				eula.hash = crypto.createHash('sha256')
					.update(currentEula)
					.digest("hex");
				// Create
				newEula = new MDBEula(eula);
				// Transfer
				Database.updateEula(newEula, eula);
				// Save
				newEula.save();
			} else {
				// Check if eula has changed
				currentEulaHash = crypto.createHash('sha256')
					.update(currentEula)
					.digest("hex");
				if (currentEulaHash != eulaMDB.hash) {
					// New Version
					eula = {};
					eula.timestamp = new Date();
					eula.language = eulaMDB.language;
					eula.version = eulaMDB.version + 1;
					eula.text = currentEula;
					eula.hash = crypto.createHash('sha256')
						.update(currentEula)
						.digest("hex");
					// Create
					newEula = new MDBEula(eula);
					// Transfer
					Database.updateEula(newEula, eula);
					// Save
					newEula.save();
				} else {
					// Ok: Transfer
					eula = {};
					Database.updateEula(eulaMDB, eula);
				}
			}
			return eula;
		});
	}

	static handleGetUserByTagId(tagID) {
		// Exec request
		return MDBTag.findById(tagID)
				.populate("userID").exec().then((tagMDB) => {
			let user = null;
			// Check
			if (tagMDB && tagMDB.userID && !tagMDB.userID.deleted) {
				// Ok
				user = new User(tagMDB.userID);
			} else {
				// Return empty user
				return Promise.resolve();
			}
			// Ok
			return user;
		});
	}

	static handleGetUserByEmail(email) {
		// Exec request
		return MDBUser.findOne({"email": email}).then((userMDB) => {
			// Check deleted
			if (userMDB && userMDB.deleted) {
				// Return empty user
				return Promise.resolve();
			} else {
				// Ok
				return UserStorage._createUser(userMDB);
			}
		});
	}

	static handleGetUser(id, withPicture) {
		// Exec request
		return MDBUser.findById(id, (withPicture ? '' : '-image' ))
				.exec().then((userMDB) => {
			// Check deleted
			if (userMDB) {
				// Ok
				return UserStorage._createUser(userMDB);
			}
		});
	}

	static handleSaveUser(user) {
		// Check if ID or email is provided
		if (!user.id && !user.email) {
			// ID must be provided!
			return Promise.reject( new Error("Error in saving the User: User has no ID and no Email and cannot be created or updated") );
		} else {
			let userFilter = {};
			// Build Request
			if (user.id) {
				userFilter._id = user.id;
			} else {
				userFilter.email = user.email;
			}
			// Get
			return MDBUser.findOneAndUpdate(userFilter, user, {
					new: true,
					upsert: true
				}).then((userMDB) => {
					let newUser = new User(userMDB);
					// Notify Change
					if (!user.id) {
						_centralRestServer.notifyUserCreated(
							{
								"id": newUser.getID(),
								"type": Constants.NOTIF_ENTITY_USER
							}
						);
					} else {
						_centralRestServer.notifyUserUpdated(
							{
								"id": newUser.getID(),
								"type": Constants.NOTIF_ENTITY_USER
							}
						);
					}
					// Update the badges
					// First delete them
					MDBTag.remove({ "userID" : userMDB._id }).then(() => {
						// Add tags
						user.tagIDs.forEach((tag) => {
							// Update/Insert Tag
							return MDBTag.findOneAndUpdate({
									"_id": tag
								},{
									"_id": tag,
									"userID": userMDB._id
								},{
									new: true,
									upsert: true
								}).then((newTag) => {
									// Created with success
								});                // Add TagIds
						});
					});
					return newUser;
				});
		}
	}

	static handleGetUsers(searchValue, withPicture, numberOfUsers) {
		// Set the filters
		let filters = {
			"$and": [
				{
					"$or": [
						{ "deleted": { $exists:false } },
						{ deleted: false }
					]
				}
			]
		};
		// Check Limit
		numberOfUsers = Utils.checkRecordLimit(numberOfUsers);
		// Source?
		if (searchValue) {
			// Build filter
			filters.$and.push({
				"$or": [
					{ "name" : { $regex : searchValue, $options: 'i' } },
					{ "firstName" : { $regex : searchValue, $options: 'i' } },
					{ "email" : { $regex : searchValue, $options: 'i' } }
				]
			});
		}
		// Create Aggregation
		let aggregation = [];
		// Picture?
		if (!withPicture) {
			aggregation.push({
				$project: {
					image: 0
				}
			});
		}
		// Filters
		if (filters) {
			aggregation.push({
				$match: filters
			});
		}
		// Add Number of Transactions
		aggregation.push({
			$lookup: {
				from: 'transactions',
				localField: '_id',
				foreignField: 'userID',
				as: 'transactions'
			}
		});
		aggregation.push({
			$addFields: {
				"numberOfTransactions": { $size: "$transactions" }
			}
		});
		// Add TagIDs
		aggregation.push({
			$lookup: {
				from: "tags",
				localField: "_id",
				foreignField: "userID",
				as: "tags"
			}
		});
		// Sort
		aggregation.push({
			$sort: { status: -1, name: 1, firstName: 1 }
		});
		// Limit
		if (numberOfUsers > 0) {
			aggregation.push({
				$limit: numberOfUsers
			});
		}
		// Execute
		return MDBUser.aggregate(aggregation)
				.exec().then((usersMDB) => {
			let users = [];
			// Create
			usersMDB.forEach((userMDB) => {
				// Create
				let user = new User(userMDB);
				// Set
				user.setTagIDs(userMDB.tags.map((tag) => {
					return tag._id
				}));
				// Add
				users.push(user);
			});
			return users;
		});
	}

	static handleDeleteUser(id) {
		return MDBUser.findByIdAndRemove( id ).then((result) => {
			// Notify Change
			_centralRestServer.notifyUserDeleted(
				{
					"id": id,
					"type": Constants.NOTIF_ENTITY_USER
				}
			);
			// Return the result
			return result.result;
		});
	}

	static _createUser(userMDB) {
		let user = null;
		// Check
		if (userMDB) {
			// Create
			user = new User(userMDB);
			// Get the Tags
			return MDBTag.find({"userID": userMDB.id}).exec().then((tagsMDB) => {
				// Check
				if (tagsMDB) {
					// Get the Tags
					let tags = tagsMDB.map((tagMDB) => { return tagMDB.id; });
					// Get IDs`
					user.setTagIDs(tags);
				}
				return user;
			});
		} else {
			// Ok
			return user;
		}
	}
}

module.exports = UserStorage;
