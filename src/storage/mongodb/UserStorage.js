const crypto = require('crypto');
const Constants = require('../../utils/Constants');
const Database = require('../../utils/Database');
const Configuration = require('../../utils/Configuration');
const Utils = require('../../utils/Utils');
const AppError = require('../../exception/AppError');

class UserStorage {
	static async getEndUserLicenseAgreement(language="en") {
		const User = require('../../model/User'); // Avoid fucking circular deps!!! 
		let languageFound = false;
		let currentEula;
		let currentEulaHash;
		let eula = null;
		let supportLanguages = Configuration.getLocalesConfig().supported;

		// Search for language
		for (const supportLanguage of supportLanguages) {
			if (language == supportLanguage.substring(0, 2)) {
				languageFound = true;
			}
		}
		if (!languageFound) {
			language = "en";
		}
		// Get current eula
		currentEula = User.getEndUserLicenseAgreement(language);
		// Read DB
		let eulasMDB = await global.db.collection('eulas')
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
				let result = await global.db.collection('eulas')
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
			let result = await global.db.collection('eulas').insertOne(eula);
			// Update object
			eula = {};
			Database.updateEula(result.ops[0], eula);
			// Return
			return eula;
		}
	}

	static async getUserByTagId(tagID) {
		// Read DB
		let tagsMDB = await global.db.collection('tags')
			.find({'_id': tagID})
			.limit(1)
			.toArray();
		// Check
		if (tagsMDB && tagsMDB.length > 0) {
			// Ok
			return UserStorage.getUser(tagsMDB[0].userID);
		}
	}

	static async getUserByEmail(email) {
		// Read DB
		let usersMDB = await global.db.collection('users')
			.find({'email': email})
			.limit(1)
			.toArray();
		// Check deleted
		if (usersMDB && usersMDB.length > 0) {
			// Ok
			return UserStorage._createUser(usersMDB[0]);
		}
	}

	static async getUser(id) {
		// Create Aggregation
		let aggregation = [];
		// Filters
		aggregation.push({
			$match: { '_id': Utils.convertToObjectID(id) }
		});
		// Add Created By / Last Changed By
		Utils.pushCreatedLastChangedInAggregation(aggregation);
		// Read DB
		let usersMDB = await global.db.collection('users')
			.aggregate(aggregation)
			.limit(1)
			.toArray();
		// Check deleted
		if (usersMDB && usersMDB.length > 0) {
			// Ok
			return UserStorage._createUser(usersMDB[0]);
		}
	}

	static async getUserImage(id) {
		// Read DB
		let userImagesMDB = await global.db.collection('userimages')
			.find({'_id': Utils.convertToObjectID(id)})
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

	static async getUserImages() {
		// Read DB
		let userImagesMDB = await global.db.collection('userimages')
			.find({})
			.toArray();
		let userImages = [];
		// Add
		for (const userImageMDB of userImagesMDB) {
			userImages.push({
				id: userImageMDB._id,
				image: userImageMDB.image
			});
		}
		return userImages;
	}

	static async removeSitesFromUser(userID, siteIDs) {
		// User provided?
		if (userID) {
			// At least one Site
			if (siteIDs && siteIDs.length > 0) {
				let siteUsers = [];
				// Create the list
				for (const siteID of siteIDs) {
					// Execute
					await global.db.collection('siteusers').deleteMany({
						"userID": Utils.convertToObjectID(userID),
						"siteID": Utils.convertToObjectID(siteID)
					});
				}
			}
		}
	}

	static async addSitesToUser(userID, siteIDs) {
		// User provided?
		if (userID) {
			// At least one Site
			if (siteIDs && siteIDs.length > 0) {
				let siteUsers = [];
				// Create the list
				for (const siteID of siteIDs) {
					// Add
					siteUsers.push({
						"userID": Utils.convertToObjectID(userID),
						"siteID": Utils.convertToObjectID(siteID)
					});
				}
				// Execute
				await global.db.collection('siteusers').insertMany(siteUsers);
			}
		}
	}

	static async saveUser(userToSave) {
		const User = require('../../model/User'); // Avoid fucking circular deps!!! 
		// Check if ID or email is provided
		if (!userToSave.id && !userToSave.email) {
			// ID must be provided!
			throw new AppError(
				Constants.CENTRAL_SERVER,
				`User has no ID and no Email`,
				550, "UserStorage", "saveUser");
		}
		// Build Request
		let userFilter = {};
		if (userToSave.id) {
			userFilter._id = Utils.convertToObjectID(userToSave.id);
		} else {
			userFilter.email = userToSave.email;
		}
		// Check Created/Last Changed By
		userToSave.createdBy = Utils.convertUserToObjectID(userToSave.createdBy);
		userToSave.lastChangedBy = Utils.convertUserToObjectID(userToSave.lastChangedBy);
		// Transfer
		let user = {};
		Database.updateUser(userToSave, user, false);
		// Modify and return the modified document
	    let result = await global.db.collection('users').findOneAndUpdate(
			userFilter,
			{$set: user},
			{upsert: true, new: true, returnOriginal: false});
		// Create
		let updatedUser = new User(result.value);
		// Add tags
		if (userToSave.tagIDs) {
			// Delete Tag IDs
			await global.db.collection('tags')
				.deleteMany( {'userID': Utils.convertToObjectID(updatedUser.getID())} );
			// At least one tag
			if (userToSave.tagIDs.length > 0) {
				// Create the list
				for (const tag of userToSave.tagIDs) {
					// Modify
					await global.db.collection('tags').findOneAndUpdate(
						{'_id': tag},
						{$set: {'userID': Utils.convertToObjectID(updatedUser.getID())}},
						{upsert: true, new: true, returnOriginal: false});
				}
			}
		}
		return updatedUser;
	}

	static async saveUserImage(userImageToSave) {
		// Check if ID is provided
		if (!userImageToSave.id) {
			// ID must be provided!
			throw new AppError(
				Constants.CENTRAL_SERVER,
				`User Image has no ID`,
				550, "UserStorage", "saveUserImage");
		}
		// Modify and return the modified document
	    let result = await global.db.collection('userimages').findOneAndUpdate(
			{'_id': Utils.convertToObjectID(userImageToSave.id)},
			{$set: {image: userImageToSave.image}},
			{upsert: true, new: true, returnOriginal: false});
	}

	static async getUsers(params, limit, skip, sort) {
		const User = require('../../model/User'); // Avoid fucking circular deps!!! 
		// Check Limit
		limit = Utils.checkRecordLimit(limit);
		// Check Skip
		skip = Utils.checkRecordSkip(skip);
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
		// Source?
		if (params.search) {
			// Build filter
			filters.$and.push({
				"$or": [
					{ "_id" : { $regex : params.search, $options: 'i' } },
					{ "name" : { $regex : params.search, $options: 'i' } },
					{ "firstName" : { $regex : params.search, $options: 'i' } },
					{ "tags._id" : { $regex : params.search, $options: 'i' } },
					{ "email" : { $regex : params.search, $options: 'i' } }
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
		// Site ID?
		if (params.siteID) {
			// Add Site
			aggregation.push({
				$lookup: {
					from: "siteusers",
					localField: "_id",
					foreignField: "userID",
					as: "siteusers"
				}
			});
			aggregation.push({
				$match: { "siteusers.siteID": Utils.convertToObjectID(params.siteID) }
			});
		}
		// Count Records
		let usersCountMDB = await global.db.collection('users')
			.aggregate([...aggregation, { $count: "count" }])
			.toArray();
		// Project
		aggregation.push({
			"$project": {
				"_id": 1,
				"name": 1,
				"firstName": 1,
				"email": 1,
				"status": 1,
				"role": 1,
				"createdOn": 1,
				"createdBy": 1,
				"lastChangedOn": 1,
				"lastChangedBy": 1,
				"eulaAcceptedOn": 1,
				"eulaAcceptedVersion": 1,
				"tags": 1
		 }
		});
		// Sort
		if (sort) {
			// Sort
			aggregation.push({
				$sort: sort
			});
		} else {
			// Default
			aggregation.push({
				$sort: { status: -1, name: 1, firstName: 1 }
			});
		}
		// Skip
		aggregation.push({
			$skip: skip
		});
		// Limit
		aggregation.push({
			$limit: limit
		});
		// Read DB
		let usersMDB = await global.db.collection('users')
			.aggregate(aggregation)
			.toArray();
		let users = [];
		// Create
		for (const userMDB of usersMDB) {
			// Create
			let user = new User(userMDB);
			// Set
			user.setTagIDs(userMDB.tags.map((tag) => {
				return tag._id
			}));
			// Add
			users.push(user);
		}
		// Ok
		return {
			count: (usersCountMDB.length > 0 ? usersCountMDB[0].count : 0),
			result: users
		};
	}

	static async deleteUser(id) {
		// Delete User
		await global.db.collection('users')
			.findOneAndDelete( {'_id': Utils.convertToObjectID(id)} );
		// Delete Image
		await global.db.collection('userimages')
			.findOneAndDelete( {'_id': Utils.convertToObjectID(id)} );
		// Delete Tags
		await global.db.collection('tags')
			.deleteMany( {'userID': Utils.convertToObjectID(id)} );
	}

	static async _createUser(userMDB) {
		const User = require('../../model/User'); // Avoid fucking circular deps!!! 
		let user = null;
		// Check
		if (userMDB) {
			// Create
			user = new User(userMDB);
			// Get the Tags
			let tagsMDB = await global.db.collection('tags')
				.find({"userID": Utils.convertToObjectID(user.getID())})
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
