const Logging = require('../../../utils/Logging');
const Database = require('../../../utils/Database');
const AppError = require('../../../exception/AppError');
const AppAuthError = require('../../../exception/AppAuthError');
const Companies = require('../../../utils/Companies');
const Sites = require('../../../utils/Sites');
const SiteAreas = require('../../../utils/SiteAreas');
const Constants = require('../../../utils/Constants');
const Utils = require('../../../utils/Utils');
const Users = require('../../../utils/Users');
const Company = require('../../../model/Company');
const Site = require('../../../model/Site');
const SiteArea = require('../../../model/SiteArea');
const CentralRestServerAuthorization = require('../CentralRestServerAuthorization');
const CompanySecurity = require('./security/CompanySecurity');

class CompanyService {
	static handleDeleteCompany(action, req, res, next) {
		Logging.logSecurityInfo({
			user: req.user, action: action,
			module: "CompanyService",
			method: "handleDeleteCompany",
			message: `Delete Company '${req.query.ID}'`,
			detailedMessages: req.query
		});
		// Filter
		let company;
		let filteredRequest = CompanySecurity.filterCompanyDeleteRequest(
			req.query, req.user);
		// Check Mandatory fields
		if(!filteredRequest.ID) {
			Logging.logActionExceptionMessageAndSendResponse(
				action, new Error(`The Company's ID must be provided`), req, res, next);
			return;
		}
		// Get
		global.storage.getCompany(filteredRequest.ID).then((foundCompany) => {
			company = foundCompany;
			// Found?
			if (!company) {
				// Not Found!
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`Company with ID '${filteredRequest.ID}' does not exist`,
					550, "CompanyService", "handleDeleteCompany");
			}
			// Check auth
			if (!CentralRestServerAuthorization.canDeleteCompany(req.user, company.getModel())) {
				// Not Authorized!
				throw new AppAuthError(
					CentralRestServerAuthorization.ACTION_DELETE,
					CentralRestServerAuthorization.ENTITY_COMPANY,
					company.getID(),
					560, "CompanyService", "handleDeleteCompany",
					req.user);
			}
			// Delete
			return company.delete();
		}).then(() => {
			// Log
			Logging.logSecurityInfo({
				user: req.user, module: "CompanyService", method: "handleDeleteCompany",
				message: `Company '${company.getName()}' has been deleted successfully`,
				action: action, detailedMessages: company});
			// Ok
			res.json({status: `Success`});
			next();
		}).catch((err) => {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
		});
	}

	static handleGetCompany(action, req, res, next) {
		Logging.logSecurityInfo({
			user: req.user, action: action,
			module: "CompanyService",
			method: "handleGetCompany",
			message: `Read Company '${req.query.ID}'`,
			detailedMessages: req.query
		});
		// Filter
		let filteredRequest = CompanySecurity.filterCompanyRequest(req.query, req.user);
		// Charge Box is mandatory
		if(!filteredRequest.ID) {
			Logging.logActionExceptionMessageAndSendResponse(
				action, new Error(`The Company ID is mandatory`), req, res, next);
			return;
		}
		// Get it
		global.storage.getCompany(filteredRequest.ID, filteredRequest.WithUsers).then((company) => {
			if (!company) {
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`The Company with ID '${filteredRequest.ID}' does not exist anymore`,
					550, "CompanyService", "handleGetCompanyLogo");
			}
			// Check auth
			if (!CentralRestServerAuthorization.canReadCompany(req.user, company.getModel())) {
				// Not Authorized!
				throw new AppAuthError(
					CentralRestServerAuthorization.ACTION_READ,
					CentralRestServerAuthorization.ENTITY_COMPANY,
					company.getID(),
					560, "CompanyService", "handleGetCompany",
					req.user);
			}
			// Return
			res.json(
				// Filter
				CompanySecurity.filterCompanyResponse(
					company.getModel(), req.user)
			);
			next();
		}).catch((err) => {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
		});
	}

	static handleGetCompanyLogo(action, req, res, next) {
		Logging.logSecurityInfo({
			user: req.user, action: action,
			module: "CompanyService",
			method: "handleGetCompanyLogo",
			message: `Read Company Logo '${req.query.ID}'`,
			detailedMessages: req.query
		});
		// Filter
		let filteredRequest = CompanySecurity.filterCompanyRequest(req.query, req.user);
		// Charge Box is mandatory
		if(!filteredRequest.ID) {
			Logging.logActionExceptionMessageAndSendResponse(
				action, new Error(`The Company ID is mandatory`), req, res, next);
			return;
		}
		// Get it
		let company;
		global.storage.getCompany(filteredRequest.ID).then((foundCompany) => {
			company = foundCompany;
			if (!company) {
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`The Company with ID '${filteredRequest.ID}' does not exist anymore`,
					550, "CompanyService", "handleGetCompanyLogo");
			}
			// Check auth
			if (!CentralRestServerAuthorization.canReadCompany(req.user, company.getModel())) {
				// Not Authorized!
				throw new AppAuthError(
					CentralRestServerAuthorization.ACTION_READ,
					CentralRestServerAuthorization.ENTITY_COMPANY,
					company.getID(),
					560, "CompanyService", "handleGetCompanyLogo",
					req.user);
			}
			// Get the logo
			return global.storage.getCompanyLogo(filteredRequest.ID);
		}).then((companyLogo) => {
			// Found?
			if (companyLogo) {
				Logging.logSecurityInfo({
					user: req.user,
					action: action,
					module: "CompanyService", method: "handleGetCompanyLogo",
					message: 'Read Company Logo'
				});
				// Set the user
				res.json(companyLogo);
			} else {
				res.json(null);
			}
			next();
		}).catch((err) => {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
		});
	}

	static handleGetCompanyLogos(action, req, res, next) {
		Logging.logSecurityInfo({
			user: req.user, action: action,
			module: "CompanyService", method: "handleGetCompanyLogos",
			message: `Read Company Logos`,
			detailedMessages: req.query
		});
		// Check auth
		if (!CentralRestServerAuthorization.canListCompanies(req.user)) {
			// Not Authorized!
			throw new AppAuthError(
				CentralRestServerAuthorization.ACTION_LIST,
				CentralRestServerAuthorization.ENTITY_COMPANIES,
				null,
				560, "CompanyService", "handleGetCompanyLogos",
				req.user);
		}
		// Get the company logo
		global.storage.getCompanyLogos().then((companyLogos) => {
			Logging.logSecurityInfo({
				user: req.user,
				action: action,
				module: "CompanyService", method: "handleGetCompanyLogos",
				message: 'Read Company Logos'
			});
			res.json(companyLogos);
			next();
		}).catch((err) => {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
		});
	}

	static handleGetCompanies(action, req, res, next) {
		Logging.logSecurityInfo({
			user: req.user, action: action,
			module: "CompanyService",
			method: "handleGetCompanies",
			message: `Read All Companies`,
			detailedMessages: req.query
		});
		// Check auth
		if (!CentralRestServerAuthorization.canListCompanies(req.user)) {
			// Not Authorized!
			throw new AppAuthError(
				CentralRestServerAuthorization.ACTION_LIST,
				CentralRestServerAuthorization.ENTITY_COMPANIES,
				null,
				560, "CompanyService", "handleGetCompanies",
				req.user);
			return;
		}
		// Filter
		let filteredRequest = CompanySecurity.filterCompaniesRequest(req.query, req.user);
		// Get the companies
		global.storage.getCompanies(filteredRequest.Search, null, filteredRequest.WithSites,
				Constants.NO_LIMIT).then((companies) => {
			let companiesJSon = [];
			companies.forEach((company) => {
				// Set the model
				companiesJSon.push(company.getModel());
			});
			// Return
			res.json(
				// Filter
				CompanySecurity.filterCompaniesResponse(
					companiesJSon, req.user)
			);
			next();
		}).catch((err) => {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
		});
	}

	static handleCreateCompany(action, req, res, next) {
		Logging.logSecurityInfo({
			user: req.user, action: action,
			module: "CompanyService",
			method: "handleCreateCompany",
			message: `Create Company '${req.body.name}'`,
			detailedMessages: req.body
		});
		// Check auth
		if (!CentralRestServerAuthorization.canCreateCompany(req.user)) {
			// Not Authorized!
			throw new AppAuthError(
				CentralRestServerAuthorization.ACTION_CREATE,
				CentralRestServerAuthorization.ENTITY_COMPANY,
				null,
				560, "CompanyService", "handleCreateCompany",
				req.user);
		}
		// Filter
		let filteredRequest = CompanySecurity.filterCompanyCreateRequest( req.body, req.user );
		// Check Mandatory fields
		if (Companies.checkIfCompanyValid(action, filteredRequest, req, res, next)) {
			// Get the logged user
			global.storage.getUser(req.user.id).then((loggedUser) => {
				// Create
				let newCompany = new Company(filteredRequest);
				// Update timestamp
				newCompany.setCreatedBy(loggedUser);
				newCompany.setCreatedOn(new Date());
				// Save
				return newCompany.save();
			}).then((createdCompany) => {
				Logging.logSecurityInfo({
					user: req.user, module: "CompanyService", method: "handleCreateCompany",
					message: `Company '${createdCompany.getName()}' has been created successfully`,
					action: action, detailedMessages: createdCompany});
				// Ok
				res.json({status: `Success`});
				next();
			}).catch((err) => {
				// Log
				Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
			});
		}
	}

	static handleUpdateCompany(action, req, res, next) {
		Logging.logSecurityInfo({
			user: req.user, action: action,
			module: "CompanyService",
			method: "handleUpdateCompany",
			message: `Update Company '${req.body.name}' (ID '${req.body.id}')`,
			detailedMessages: req.body
		});
		// Filter
		let filteredRequest = CompanySecurity.filterCompanyUpdateRequest( req.body, req.user );
		// Check email
		let company;
		global.storage.getCompany(filteredRequest.id).then((foundCompany) => {
			company = foundCompany;
			if (!company) {
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`The Company with ID '${filteredRequest.id}' does not exist anymore`,
					550, "CompanyService", "handleUpdateCompany");
			}
			// Check Mandatory fields
			if (!Companies.checkIfCompanyValid(action, filteredRequest, req, res, next)) {
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`The Company request is invalid`,
					500, "CompanyService", "handleUpdateCompany");
			}
			// Check auth
			if (!CentralRestServerAuthorization.canUpdateCompany(req.user, company.getModel())) {
				// Not Authorized!
				throw new AppAuthError(
					CentralRestServerAuthorization.ACTION_UPDATE,
					CentralRestServerAuthorization.ENTITY_COMPANY,
					company.getID(),
					560, "CompanyService", "handleCreateCompany",
					req.user);
			}
			// Get the logged user
			return global.storage.getUser(req.user.id);
		// Logged User
		}).then((loggedUser) => {
			// Update
			Database.updateCompany(filteredRequest, company.getModel());
			// Update timestamp
			company.setLastChangedBy(loggedUser);
			company.setLastChangedOn(new Date());
			// Update
			return company.save();
		}).then((updatedCompany) => {
			// Log
			Logging.logSecurityInfo({
				user: req.user, module: "CompanyService", method: "handleUpdateCompany",
				message: `Company '${updatedCompany.getName()}' has been updated successfully`,
				action: action, detailedMessages: updatedCompany});
			// Ok
			res.json({status: `Success`});
			next();
		}).catch((err) => {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, err, req, res, next);
		});
	}
}

module.exports = CompanyService;
