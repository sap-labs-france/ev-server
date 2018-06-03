const Constants = require('../../../utils/Constants');
const Logging = require('../../../utils/Logging');
const Database = require('../../../utils/Database');
const Configuration = require('../../../utils/Configuration');
const Users = require('../../../utils/Users');
const Utils = require('../../../utils/Utils');
const User = require('../../../model/User');
const crypto = require('crypto');
const ObjectID = require('mongodb').ObjectID;

let _db;

class UserStorage {
	static setDatabase(db) {
		_db = db;
	}

	static async handleGetEndUserLicenseAgreement(language="en") {
		let languageFound = false;
		let currentEula;
		let currentEulaHash;
		let newEula;
		let eula = null;
		let supportLanguages = Configuration.getLocalesConfig().supported;

		// Search for language
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
		let eulasMDB = await _db.collection('eulas')
			.find({'language':language})
			.sort({'version': -1})
			.limit(1)
			.toArray();
		// Found?
		if (eulasMDB && eulasMDB.length > 0) {
			// Get
			let eulaMDB = eulasMDB[0];
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
				eula.hash = currentEulaHash;
				// Create
				let result = await _db.collection('eulas')
					.insertOne(eula);
				// Update object
				eula = {};
				Database.updateEula(result.ops[0], eula);
				// Return
				return eula;
			} else {
				// Ok: Transfer
				eula = {};
				Database.updateEula(eulaMDB, eula);
				return eula;
			}
		} else {
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
			let result = _db.collection('eulas')
				.insertOne(eula);
			// Update object
			eula = {};
			Database.updateEula(result.ops[0], eula);
			// Return
			return eula;
		}
	}

	static async handleGetUserByTagId(tagID) {
		// Read DB
		let tagsMDB = await _db.collection('tags')
			.find({'_id': tagID})
			.limit(1)
			.toArray();
		// Check
		if (tagsMDB && tagsMDB.length > 0) {
			// Ok
			return UserStorage.handleGetUser(tagsMDB[0].userID);
		}
	}

	static async handleGetUserByEmail(email) {
		// Read DB
		let usersMDB = await _db.collection('users')
			.find({'email': email})
			.limit(1)
			.toArray();
		// Check deleted
		if (usersMDB && usersMDB.length > 0) {
			// Ok
			return UserStorage._createUser(usersMDB[0]);
		}
	}

	static async handleGetUser(id) {
		// Create Aggregation
		let aggregation = [];
		// Filters
		aggregation.push({
			$match: { '_id': Utils.checkIdIsObjectID(id) }
		});
		// Add Created By / Last Changed By
		Utils.pushCreatedLastChangedInAggregation(aggregation);
		// Read DB
		let usersMDB = await _db.collection('users')
			.aggregate(aggregation)
			.limit(1)
			.toArray();
		// Check deleted
		if (usersMDB && usersMDB.length > 0) {
			// Ok
			return UserStorage._createUser(usersMDB[0]);
		}
	}

	static async handleGetUserImage(id) {
		// Read DB
		let userImagesMDB = await _db.collection('userimages')
			.find({'_id': Utils.checkIdIsObjectID(id)})
			.limit(1)
			.toArray();
		let userImage = null;
		// Check
		if (userImagesMDB && userImagesMDB.length > 0) {
			// Set
			userImage = {
				id: userImagesMDB[0]._id,
				image: userImagesMDB[0].image
			};
		}
		return userImage;
	}

	static async handleGetUserImages() {
		// Read DB
		let userImagesMDB = await _db.collection('userimages')
			.find({})
			.toArray();
		let userImages = [];
		// Add
		userImagesMDB.forEach((userImageMDB) => {
			userImages.push({
				id: userImageMDB._id,
				image: userImageMDB.image
			});
		});
		return userImages;
	}

	static async handleSaveUser(userToSave) {
		// Check if ID or email is provided
		if (!userToSave.id && !userToSave.email) {
			// ID must be provided!
			throw new AppError(
				Constants.CENTRAL_SERVER,
				`User has no ID and no Email`,
				550, "UserStorage", "handleSaveUser");
		}
		// Transfer
		let user = {};
		Database.updateUser(userToSave, user, false);
		// Build Request
		let userFilter = {};
		if (user.id) {
			userFilter._id = Utils.checkIdIsObjectID(user.id);
		} else {
			userFilter.email = user.email;
		}
		// Check Created By
		if (user.createdBy && typeof user.createdBy == "object") {
			// This is the User Model
			user.createdBy = Utils.checkIdIsObjectID(user.createdBy.id);
		}
		// Check Last Changed By
		if (user.lastChangedBy && typeof user.lastChangedBy == "object") {
			// This is the User Model
			user.lastChangedBy = Utils.checkIdIsObjectID(user.lastChangedBy.id);
		}
		// Save
		let newUser;
		// Modify and return the modified document
	    let result = await _db.collection('users').findOneAndUpdate(
			userFilter,
			{$set: user},
			{upsert: true, new: true, returnOriginal: false});
		// Create
		newUser = new User(result.value);
		// Delete Tag IDs
		result = await _db.collection('tags')
			.findOneAndDelete( {'userID': Utils.checkIdIsObjectID(newUser.getID())} );
		// Add tags
		user.tagIDs.forEach(async (tag) => {
			// Create
			await _db.collection('tags').findOneAndUpdate(
				{"_id": tag},
				{
					$set: {
						"_id": tag,
						"userID": Utils.checkIdIsObjectID(newUser.getID())
					}
				},
				{upsert: true, new: true, returnOriginal: false}
			);
		});
		return newUser;
	}

	static async handleSaveUserImage(userToSave) {
		// Check if ID is provided
		if (!userToSave.id) {
			throw new Error("User has no ID and cannot be created or updated");
		}
		// Set Image
		let user = {
			id: userToSave.id,
			image: userToSave.image
		};
		// Modify and return the modified document
	    await _db.collection('userimages').findOneAndUpdate(
			{'_id': Utils.checkIdIsObjectID(user.id)},
			{$set: user},
			{upsert: true, new: true});
	}

	static async handleGetUsers(searchValue, siteID, numberOfUsers) {
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
				$match: { "siteusers.siteID": Utils.checkIdIsObjectID(siteID) }
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
		let usersMDB = await _db.collection('users')
			.aggregate(aggregation)
			.toArray();
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
	}

	static async handleDeleteUser(id) {
		// Delete User
		await _db.collection('users')
				.findOneAndDelete( {'_id': Utils.checkIdIsObjectID(id)} );
		// Delete Image
		await _db.collection('userimages')
			.findOneAndDelete( {'_id': Utils.checkIdIsObjectID(id)} );
		// Delete Tags
		await _db.collection('tags')
			.findOneAndDelete( {'userID': Utils.checkIdIsObjectID(id)} );
	}

	static async _createUser(userMDB) {
		let user = null;
		// Check
		if (userMDB) {
			// Create
			user = new User(userMDB);
			// Get the Tags
			let tagsMDB = await _db.collection('tags')
				.find({"userID": Utils.checkIdIsObjectID(user.getID())})
				.toArray();
			// Check
			if (tagsMDB) {
				// Get the Tags
				let tags = tagsMDB.map((tagMDB) => { return tagMDB._id; });
				// Get IDs`
				user.setTagIDs(tags);
			}
		}
		return user;
	}
}

module.exports = UserStorage;
