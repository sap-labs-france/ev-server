const Constants = require('../../../utils/Constants');
const Logging = require('../../../utils/Logging');
const Database = require('../../../utils/Database');
const Configuration = require('../../../utils/Configuration');
const Users = require('../../../utils/Users');
const Utils = require('../../../utils/Utils');
const MDBTag = require('../model/MDBTag');
const User = require('../../../model/User');
const crypto = require('crypto');
const ObjectID = require('mongodb').ObjectID;

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
				.find({'language':language})
				.sort({'version': -1})
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
						.digest('hex');
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
		// Read DB
		return _db.collection('tags')
				.find({'_id': tagID})
				.limit(1)
				.toArray()
				.then((tagsMDB) => {
			// Check
			if (tagsMDB && tagsMDB.length > 0) {
				// Ok
				return UserStorage.handleGetUser(tagsMDB[0].userID);
			}
		});
	}

	static handleGetUserByEmail(email) {
		// Read DB
		return _db.collection('users')
				.find({'email': email})
				.limit(1)
				.toArray()
				.then((usersMDB) => {
			// Check deleted
			if (usersMDB && (usersMDB.length > 0) && !usersMDB[0].deleted) {
				// Ok
				return UserStorage._createUser(usersMDB[0]);
			}
		});
	}

	static handleGetUser(id) {
		// Create Aggregation
		let aggregation = [];
		// Filters
		aggregation.push({
			$match: { '_id': ObjectID(id) }
		});
		// Add Created By / Last Changed By
		Utils.pushCreatedLastChangedInAggregation(aggregation);
		// Read DB
		return _db.collection('users')
				.aggregate(aggregation)
				.limit(1)
				.toArray()
				.then((usersMDB) => {
			// Check deleted
			if (usersMDB && (usersMDB.length > 0) && !usersMDB[0].deleted) {
				// Ok
				return UserStorage._createUser(usersMDB[0]);
			}
		});
	}

	static handleGetUserImage(id) {
		// Read DB
		return _db.collection('userimages')
				.find({'_id': ObjectID(id)})
				.limit(1)
				.toArray()
				.then((userImagesMDB) => {
			let userImage = null;
			// Check
			if (userImagesMDB && (userImagesMDB.length > 0)) {
				// Set
				userImage = {
					id: userImagesMDB[0]._id,
					image: userImagesMDB[0].image
				};
			}
			return userImage;
		});
	}

	static handleGetUserImages() {
		// Read DB
		return _db.collection('userimages')
				.find({})
				.toArray()
				.then((userImagesMDB) => {
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
			throw new Error("User has no ID and no Email and cannot be created or updated");
		}
		let userFilter = {};
		// Build Request
		if (user.id) {
			userFilter._id = new ObjectID(user.id);
		} else {
			userFilter.email = user.email;
		}
		// Check Created By
		if (user.createdBy && typeof user.createdBy == "object") {
			// This is the User Model
			user.createdBy = ObjectID(user.createdBy.id);
		}
		// Check Last Changed By
		if (user.lastChangedBy && typeof user.lastChangedBy == "object") {
			// This is the User Model
			user.lastChangedBy = ObjectID(user.lastChangedBy.id);
		}
		// Save
		let newUser;
		// Modify and return the modified document
	    return _db.collection('users').findOneAndUpdate(
				userFilter,
				{$set: user},
				{upsert: true, new: true}).then((result) => {
			newUser = new User(result.value);
			// First delete all of them
			return MDBTag.remove({ "userID" : new ObjectID(newUser.getID()) });
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
						"userID": new ObjectID(newUser.getID())
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

	static handleSaveUserImage(user) {
		// Check if ID is provided
		if (!user.id) {
			throw new Error("User has no ID and cannot be created or updated");
		}
		// Modify and return the modified document
	    return _db.collection('userimages').findOneAndUpdate(
				{'_id': new ObjectID(user.id)},
				{$set: user},
				{upsert: true, new: true}).then((result) => {
			// Notify
			_centralRestServer.notifyUserUpdated(
				{
					"id": user.id,
					"type": Constants.NOTIF_ENTITY_USER
				}
			);
		});
	}

	static handleGetUsers(searchValue, siteID, numberOfUsers) {
		let filters = {
			"$and": [
				{
					"$or": [
						{ "deleted": { $exists:false } },
						{ deleted: false },
						{ deleted: null }
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
				$match: { "siteusers.siteID": new ObjectID(siteID) }
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
		// Read DB
		return _db.collection('users')
				.aggregate(aggregation)
				.toArray()
				.then((usersMDB) => {
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
		// Read DB
		return _db.collection('users')
				.findOneAndDelete( {'_id': new ObjectID(id)} )
				.then((result) => {
			// Remove User's Image
			return _db.collection('userimages')
				.findOneAndDelete( {'_id': new ObjectID(id)} );
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
			return _db.collection('tags')
					.find({"userID": user.getID()})
					.toArray()
					.then((tagsMDB) => {
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
