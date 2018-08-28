const Logging = require('../../../utils/Logging');
const Database = require('../../../utils/Database');
const AppError = require('../../../exception/AppError');
const AppAuthError = require('../../../exception/AppAuthError');
const Constants = require('../../../utils/Constants');
const Company = require('../../../model/Company');
const User = require('../../../model/User');
const Authorizations = require('../../../authorization/Authorizations');
const CompanySecurity = require('./security/CompanySecurity');
const CompanyStorage = require('../../../storage/mongodb/CompanyStorage'); 

class CompanyService {
	static async handleDeleteCompany(action, req, res, next) {
		try {
			// Filter
			let filteredRequest = CompanySecurity.filterCompanyDeleteRequest(
				req.query, req.user);
			// Check Mandatory fields
			if(!filteredRequest.ID) {
				// Not Found!
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`The Company's ID must be provided`, 500, 
					'CompanyService', 'handleDeleteCompany', req.user);
			}
			// Get
			let company = await CompanyStorage.getCompany(filteredRequest.ID);
			// Found?
			if (!company) {
				// Not Found!
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`Company with ID '${filteredRequest.ID}' does not exist`, 550, 
					'CompanyService', 'handleDeleteCompany', req.user);
			}
			// Check auth
			if (!Authorizations.canDeleteCompany(req.user, company.getModel())) {
				// Not Authorized!
				throw new AppAuthError(
					Authorizations.ACTION_DELETE,
					Constants.ENTITY_COMPANY,
					company.getID(),
					560, 'CompanyService', 'handleDeleteCompany',
					req.user);
			}
			// Delete
			await company.delete();
			// Log
			Logging.logSecurityInfo({
				user: req.user, module: 'CompanyService', method: 'handleDeleteCompany',
				message: `Company '${company.getName()}' has been deleted successfully`,
				action: action, detailedMessages: company});
			// Ok
			res.json({status: `Success`});
			next();
		} catch (error) {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
		}
	}

	static async handleGetCompany(action, req, res, next) {
		try {
			// Filter
			let filteredRequest = CompanySecurity.filterCompanyRequest(req.query, req.user);
			// Charge Box is mandatory
			if(!filteredRequest.ID) {
				// Not Found!
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`The Company's ID must be provided`, 500, 
					'CompanyService', 'handleGetCompany', req.user);
			}
			// Get it
			let company = await CompanyStorage.getCompany(filteredRequest.ID);
			if (!company) {
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`The Company with ID '${filteredRequest.ID}' does not exist anymore`, 550, 
					'CompanyService', 'handleGetCompany', req.user);
			}
			// Check auth
			if (!Authorizations.canReadCompany(req.user, company.getModel())) {
				// Not Authorized!
				throw new AppAuthError(
					Authorizations.ACTION_READ,
					Constants.ENTITY_COMPANY,
					company.getID(),
					560, 'CompanyService', 'handleGetCompany',
					req.user);
			}
			// Return
			res.json(
				// Filter
				CompanySecurity.filterCompanyResponse(
					company.getModel(), req.user)
			);
			next();
		} catch (error) {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
		}
	}

	static async handleGetCompanyLogo(action, req, res, next) {
		try {
			// Filter
			let filteredRequest = CompanySecurity.filterCompanyRequest(req.query, req.user);
			// Charge Box is mandatory
			if(!filteredRequest.ID) {
				// Not Found!
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`The Company's ID must be provided`, 500, 
					'CompanyService', 'handleGetCompanyLogo', req.user);
			}
			// Get it
			let company = await CompanyStorage.getCompany(filteredRequest.ID);
			if (!company) {
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`The Company with ID '${filteredRequest.ID}' does not exist anymore`, 550, 
					'CompanyService', 'handleGetCompanyLogo', req.user);
			}
			// Check auth
			if (!Authorizations.canReadCompany(req.user, company.getModel())) {
				// Not Authorized!
				throw new AppAuthError(
					Authorizations.ACTION_READ,
					Constants.ENTITY_COMPANY,
					company.getID(),
					560, 'CompanyService', 'handleGetCompanyLogo',
					req.user);
			}
			// Get the logo
			let companyLogo = await CompanyStorage.getCompanyLogo(filteredRequest.ID);
			// Return
			res.json(companyLogo);
			next();
		} catch (error) {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
		}
	}

	static async handleGetCompanyLogos(action, req, res, next) {
		try {
			// Check auth
			if (!Authorizations.canListCompanies(req.user)) {
				// Not Authorized!
				throw new AppAuthError(
					Authorizations.ACTION_LIST,
					Constants.ENTITY_COMPANIES,
					null,
					560, 'CompanyService', 'handleGetCompanyLogos',
					req.user);
			}
			// Get the company logo
			let companyLogos = await CompanyStorage.getCompanyLogos();
			res.json(companyLogos);
			next();
		} catch (error) {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
		}
	}

	static async handleGetCompanies(action, req, res, next) {
		try {
			// Check auth
			if (!Authorizations.canListCompanies(req.user)) {
				// Not Authorized!
				throw new AppAuthError(
					Authorizations.ACTION_LIST,
					Constants.ENTITY_COMPANIES,
					null,
					560, 'CompanyService', 'handleGetCompanies',
					req.user);
				return;
			}
			// Filter
			let filteredRequest = CompanySecurity.filterCompaniesRequest(req.query, req.user);
			// Get the companies
			let companies = await CompanyStorage.getCompanies(
				{ search: filteredRequest.Search, withSites: filteredRequest.WithSites },
				filteredRequest.Limit, filteredRequest.Skip, filteredRequest.Sort);
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
		} catch (error) {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
		}
	}

	static async handleCreateCompany(action, req, res, next) {
		try {
				// Check auth
			if (!Authorizations.canCreateCompany(req.user)) {
				// Not Authorized!
				throw new AppAuthError(
					Authorizations.ACTION_CREATE,
					Constants.ENTITY_COMPANY,
					null,
					560, 'CompanyService', 'handleCreateCompany',
					req.user);
			}
			// Filter
			let filteredRequest = CompanySecurity.filterCompanyCreateRequest( req.body, req.user );
			// Check Mandatory fields
			Company.checkIfCompanyValid(filteredRequest, req);
			// Create
			let company = new Company(filteredRequest);
			// Update timestamp
			company.setCreatedBy(new User({'id': req.user.id}));
			company.setCreatedOn(new Date());
			// Save
			let newCompany = await company.save();
			// Update Company's Logo
			newCompany.setLogo(company.getLogo());
			// Save
			await newCompany.saveLogo();
			// Log
			Logging.logSecurityInfo({
				user: req.user, module: 'CompanyService', method: 'handleCreateCompany',
				message: `Company '${newCompany.getName()}' has been created successfully`,
				action: action, detailedMessages: newCompany});
			// Ok
			res.json({status: `Success`});
			next();
		} catch (error) {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
		}
	}

	static async handleUpdateCompany(action, req, res, next) {
		try {
			// Filter
			let filteredRequest = CompanySecurity.filterCompanyUpdateRequest( req.body, req.user );
			// Check email
			let company = await CompanyStorage.getCompany(filteredRequest.id);
			if (!company) {
				throw new AppError(
					Constants.CENTRAL_SERVER,
					`The Company with ID '${filteredRequest.id}' does not exist anymore`, 550, 
					'CompanyService', 'handleUpdateCompany', req.user);
			}
			// Check Mandatory fields
			Company.checkIfCompanyValid(filteredRequest, req);
			// Check auth
			if (!Authorizations.canUpdateCompany(req.user, company.getModel())) {
				// Not Authorized!
				throw new AppAuthError(
					Authorizations.ACTION_UPDATE,
					Constants.ENTITY_COMPANY,
					company.getID(),
					560, 'CompanyService', 'handleCreateCompany',
					req.user);
			}
			// Update
			Database.updateCompany(filteredRequest, company.getModel());
			// Update timestamp
			company.setLastChangedBy(new User({'id': req.user.id}));
			company.setLastChangedOn(new Date());
			// Update Company
			let updatedCompany = await company.save();
			// Update Company's Logo
			await company.saveLogo();
			// Log
			Logging.logSecurityInfo({
				user: req.user, module: 'CompanyService', method: 'handleUpdateCompany',
				message: `Company '${updatedCompany.getName()}' has been updated successfully`,
				action: action, detailedMessages: updatedCompany});
			// Ok
			res.json({status: `Success`});
			next();
		} catch (error) {
			// Log
			Logging.logActionExceptionMessageAndSendResponse(action, error, req, res, next);
		}
	}
}

module.exports = CompanyService;
