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
const MDBEula = require('../model/MDBEula');
const User = require('../../../model/User');
const crypto = require('crypto');
const ObjectId = mongoose.Types.ObjectId;

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

	static handleGetUser(id) {
		// Exec request
		return MDBUser.findById(id)
				.exec().then((userMDB) => {
			// Check deleted
			if (userMDB) {
				// Ok
				return UserStorage._createUser(userMDB);
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
			return Promise.reject( new Error("Error in saving the User: User has no ID and no Email and cannot be created or updated") );
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
				// Save Image
				return MDBUserImage.findOneAndUpdate({
					"_id": new ObjectId(newUser.getID())
				}, user, {
					new: true,
					upsert: true
				});
			}).then(() => {
				// Update the badges
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

	static handleGetUsers(searchValue, numberOfUsers) {
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
					{ "_id" : { $regex : searchValue, $options: 'i' } },
					{ "name" : { $regex : searchValue, $options: 'i' } },
					{ "firstName" : { $regex : searchValue, $options: 'i' } },
					{ "email" : { $regex : searchValue, $options: 'i' } }
				]
			});
		}
		// Create Aggregation
		let aggregation = [];
		// Created By
		aggregation.push({
			$lookup: {
				from: "users",
				localField: "createdBy",
				foreignField: "_id",
				as: "createdBy"
			}
		});
		// Single Record
		aggregation.push({
			$unwind: { "path": "$createdBy", "preserveNullAndEmptyArrays": true }
		});
		// Last Changed By
		aggregation.push({
			$lookup: {
				from: "users",
				localField: "lastChangedBy",
				foreignField: "_id",
				as: "lastChangedBy"
			}
		});
		// Single Record
		aggregation.push({
			$unwind: { "path": "$lastChangedBy", "preserveNullAndEmptyArrays": true }
		});
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
			// Remove Image
			return MDBUserImage.findByIdAndRemove( id );
		}).then((result) => {
			// Notify Change
			_centralRestServer.notifyUserDeleted(
				{
					"id": id,
					"type": Constants.NOTIF_ENTITY_USER
				}
			);
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
