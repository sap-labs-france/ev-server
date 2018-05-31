const mongoose = require('mongoose');
const Constants = require('../../../utils/Constants');
const Logging = require('../../../utils/Logging');
const Database = require('../../../utils/Database');
const Configuration = require('../../../utils/Configuration');
const Users = require('../../../utils/Users');
const Utils = require('../../../utils/Utils');
const MDBUser = require('../model/MDBUser');
const MDBUserImage = require('../model/MDBUserImage');
const MDBTag = require('../model/MDBTag');
const User = require('../../../model/User');
const crypto = require('crypto');
const ObjectId = mongoose.Types.ObjectId;

let _centralRestServer;
let _db;

class UserStorage {
	static setCentralRestServer(centralRestServer) {
		_centralRestServer = centralRestServer;
	}

	static setDatabase(db) {
		_db = db;
	}

	static handleGetEndUserLicenseAgreement(language="en") {
		let languageFound = false;
		let currentEula;
		let currentEulaHash;
		let newEula;
		let eula = null;
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
		return _db.collection('eulas')
				.find({"language":language})
				.sort({"version": -1})
				.limit(1)
				.toArray()
				.then((eulasMDB) => {
			let eulaMDB = eulasMDB[0];
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
			    return _db.collection('eulas')
						.insertOne(eula)
						.then((result) => {
					// Update object
					eula = {};
					Database.updateEula(result.ops[0], eula);
					// Return
					return eula;
				});
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
				    return _db.collection('eulas')
							.insertOne(eula)
							.then((result) => {
						// Update object
						eula = {};
						Database.updateEula(result.ops[0], eula);
						// Return
						return eula;
					});
				} else {
					// Ok: Transfer
					eula = {};
					Database.updateEula(eulaMDB, eula);
					return eula;
				}
			}
		});
	}

	static handleGetUserByTagId(tagID) {
		// Exec request
		return MDBTag.findById(tagID).exec().then((tagMDB) => {
			// Check
			if (tagMDB) {
				// Ok
				return UserStorage.handleGetUser(tagMDB.userID);
			} else {
				// Return empty user
				return Promise.resolve();
			}
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

	static handleGetUser(id) {
		// Create Aggregation
		let aggregation = [];
		// Filters
		aggregation.push({
			$match: { _id: ObjectId(id) }
		});
		// Add Created By / Last Changed By
		Utils.pushCreatedLastChangedInAggregation(aggregation);
		// Execute
		return MDBUser.aggregate(aggregation)
				.exec().then((userMDB) => {
			// Check deleted
			if (userMDB && userMDB.length > 0) {
				// Ok
				return UserStorage._createUser(userMDB[0]);
			}
		});
	}

	static handleGetUserImage(id) {
		// Exec request
		return MDBUserImage.findById(id)
				.exec().then((userImageMDB) => {
			let userImage = null;
			// Set
			if (userImageMDB) {
				userImage = {
					id: userImageMDB._id,
					image: userImageMDB.image
				};
			}
			return userImage;
		});
	}

	static handleGetUserImages() {
		// Exec request
		return MDBUserImage.find({})
				.exec().then((userImagesMDB) => {
			let userImages = [];
			// Add
			userImagesMDB.forEach((userImageMDB) => {
				userImages.push({
					id: userImageMDB._id,
					image: userImageMDB.image
				});
			});
			return userImages;
		});
	}

	static handleSaveUser(user) {
		// Check if ID or email is provided
		if (!user.id && !user.email) {
			// ID must be provided!
			return Promise.reject( new Error("User has no ID and no Email and cannot be created or updated") );
		} else {
			let userFilter = {};
			// Build Request
			if (user.id) {
				userFilter._id = user.id;
			} else {
				userFilter.email = user.email;
			}
			// Check Created By
			if (user.createdBy && typeof user.createdBy == "object") {
				// This is the User Model
				user.createdBy = new ObjectId(user.createdBy.id);
			}
			// Check Last Changed By
			if (user.lastChangedBy && typeof user.lastChangedBy == "object") {
				// This is the User Model
				user.lastChangedBy = new ObjectId(user.lastChangedBy.id);
			}
			// Save
			let newUser;
			return MDBUser.findOneAndUpdate(userFilter, user, {
				new: true,
				upsert: true
			}).then((userMDB) => {
				newUser = new User(userMDB);
				// First delete all of them
				return MDBTag.remove({ "userID" : new ObjectId(newUser.getID()) });
			}).then(() => {
				// Add tags
				let proms = [];
				user.tagIDs.forEach((tag) => {
					// Update/Insert Tag
					proms.push(
						MDBTag.findOneAndUpdate({
							"_id": tag
						},{
							"_id": tag,
							"userID": new ObjectId(newUser.getID())
						},{
							new: true,
							upsert: true
						})
					);
				});
				return Promise.all(proms);
			}).then(() => {
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
				return newUser;
			});
		}
	}

	static handleSaveUserImage(user) {
		// Check if ID is provided
		if (!user.id) {
			// ID must be provided!
			return Promise.reject( new Error("User has no ID and no Email and cannot be created or updated") );
		} else {
			// Save Image
			return MDBUserImage.findOneAndUpdate({
				"_id": new ObjectId(user.id)
			}, user, {
				new: true,
				upsert: true
			});
			// Notify
			_centralRestServer.notifyUserUpdated(
				{
					"id": user.id,
					"type": Constants.NOTIF_ENTITY_USER
				}
			);
		}
	}

	static handleGetUsers(searchValue, siteID, numberOfUsers) {
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
					{ "_id" : { $regex : searchValue, $options: 'i' } },
					{ "name" : { $regex : searchValue, $options: 'i' } },
					{ "firstName" : { $regex : searchValue, $options: 'i' } },
					{ "tags._id" : { $regex : searchValue, $options: 'i' } },
					{ "email" : { $regex : searchValue, $options: 'i' } }
				]
			});
		}
		// Create Aggregation
		let aggregation = [];
		// Add TagIDs
		aggregation.push({
			$lookup: {
				from: "tags",
				localField: "_id",
				foreignField: "userID",
				as: "tags"
			}
		});
		// Filters
		if (filters) {
			aggregation.push({
				$match: filters
			});
		}
		// Add Created By / Last Changed By
		Utils.pushCreatedLastChangedInAggregation(aggregation);
		// Add Site
		aggregation.push({
			$lookup: {
				from: "siteusers",
				localField: "_id",
				foreignField: "userID",
				as: "siteusers"
			}
		});
		// Site ID?
		if (siteID) {
			aggregation.push({
				$match: { "siteusers.siteID": new ObjectId(siteID) }
			});
		}
		aggregation.push({
			$addFields: {
				"numberOfSites": { $size: "$siteusers" }
			}
		});
		// Transactions
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
		// Remove User
		return MDBUser.findByIdAndRemove( id ).then((result) => {
			// Remove User's Image
			return MDBUserImage.findByIdAndRemove( id );
		}).then((result) => {
			// Notify Change
			_centralRestServer.notifyUserDeleted(
				{
					"id": id,
					"type": Constants.NOTIF_ENTITY_USER
				}
			);
			return result;
		});
	}

	static _createUser(userMDB) {
		let user = null;
		// Check
		if (userMDB) {
			// Create
			user = new User(userMDB);
			// Get the Tags
			return MDBTag.find({"userID": user.getID()}).exec().then((tagsMDB) => {
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
