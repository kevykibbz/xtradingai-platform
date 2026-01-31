/**
 * Deriv.com / Binary.com API for JavaScript
 * 
 * Comprehensive API wrapper matching the Python binaryapi library structure.
 * All methods return a Promise that resolves with the API response.
 * 
 * Usage:
 *   import { DerivAPI } from '@/lib/deriv-api';
 *   const api = new DerivAPI(ws, sendRequest);
 *   const response = await api.active_symbols('brief', { product_type: 'basic' });
 */

export class DerivAPI {
  constructor(ws, sendRequest) {
    this.ws = ws;
    this.sendRequest = sendRequest;
  }

  /**
   * Backward compatibility: send method for direct API calls
   * This allows existing code using api.send() to continue working
   */
  send(request) {
    return this.sendRequest(request);
  }

  /**
   * Helper to build request object
   */
  _buildRequest(method, params = {}) {
    const request = { [method]: params.value !== undefined ? params.value : true };
    
    // Add all other parameters
    Object.keys(params).forEach(key => {
      if (key !== 'value' && params[key] !== undefined && params[key] !== null) {
        request[key] = params[key];
      }
    });
    
    return request;
  }

  /**
   * 3.1 Active Symbols (active_symbols)
   * Retrieve a list of all currently active symbols
   */
  active_symbols(active_symbols = 'brief', options = {}) {
    return this.sendRequest(this._buildRequest('active_symbols', {
      value: active_symbols,
      landing_company: options.landing_company,
      product_type: options.product_type,
      passthrough: options.passthrough,
      req_id: options.req_id,
    }));
  }

  /**
   * 3.2 API Token (api_token)
   * Create an API token
   */
  api_token(api_token = 1, options = {}) {
    return this.sendRequest(this._buildRequest('api_token', {
      value: api_token,
      new_token: options.new_token,
      new_token_scopes: options.new_token_scopes,
      passthrough: options.passthrough,
      req_id: options.req_id,
    }));
  }

  /**
   * 3.3 Application Delete (app_delete)
   * Delete an application
   */
  app_delete(app_delete = 1, options = {}) {
    return this.sendRequest(this._buildRequest('app_delete', {
      value: app_delete,
      app_delete: options.app_delete,
      passthrough: options.passthrough,
      req_id: options.req_id,
    }));
  }

  /**
   * 3.4 Application Get (app_get)
   * Get application details
   */
  app_get(app_get = 1, options = {}) {
    return this.sendRequest(this._buildRequest('app_get', {
      value: app_get,
      passthrough: options.passthrough,
      req_id: options.req_id,
    }));
  }

  /**
   * 3.5 Application List (app_list)
   * List all applications
   */
  app_list(app_list = 1, options = {}) {
    return this.sendRequest(this._buildRequest('app_list', {
      value: app_list,
      passthrough: options.passthrough,
      req_id: options.req_id,
    }));
  }

  /**
   * 3.6 Application Markup Details (app_markup_details)
   * Get application markup details
   */
  app_markup_details(app_markup_details = 1, options = {}) {
    return this.sendRequest(this._buildRequest('app_markup_details', {
      value: app_markup_details,
      description: options.description,
      passthrough: options.passthrough,
      req_id: options.req_id,
    }));
  }

  /**
   * 3.7 Application Register (app_register)
   * Register a new application
   */
  app_register(app_register = 1, options = {}) {
    return this.sendRequest(this._buildRequest('app_register', {
      value: app_register,
      app_register: options.app_register,
      app_markup: options.app_markup,
      appstore: options.appstore,
      github: options.github,
      googleplay: options.googleplay,
      homepage: options.homepage,
      name: options.name,
      redirect_uri: options.redirect_uri,
      scopes: options.scopes,
      verification_uri: options.verification_uri,
      passthrough: options.passthrough,
      req_id: options.req_id,
    }));
  }

  /**
   * 3.8 Application Update (app_update)
   * Update an application
   */
  app_update(app_update = 1, options = {}) {
    return this.sendRequest(this._buildRequest('app_update', {
      value: app_update,
      app_update: options.app_update,
      app_markup: options.app_markup,
      appstore: options.appstore,
      github: options.github,
      googleplay: options.googleplay,
      homepage: options.homepage,
      name: options.name,
      redirect_uri: options.redirect_uri,
      scopes: options.scopes,
      verification_uri: options.verification_uri,
      passthrough: options.passthrough,
      req_id: options.req_id,
    }));
  }

  /**
   * 3.9 Asset Index (asset_index)
   * Get asset index
   */
  asset_index(asset_index = 1, options = {}) {
    return this.sendRequest(this._buildRequest('asset_index', {
      value: asset_index,
      landing_company: options.landing_company,
      passthrough: options.passthrough,
      req_id: options.req_id,
    }));
  }

  /**
   * 3.10 Authorize (authorize)
   * Authorize the session
   */
  authorize(token, options = {}) {
    return this.sendRequest(this._buildRequest('authorize', {
      authorize: token,
      add_to_login_history: options.add_to_login_history,
      passthrough: options.passthrough,
      req_id: options.req_id,
    }));
  }

  /**
   * 3.11 Balance (balance)
   * Get account balance
   */
  balance(options = {}) {
    return this.sendRequest(this._buildRequest('balance', {
      value: options.value !== undefined ? options.value : 1,
      account: options.account,
      subscribe: options.subscribe,
      passthrough: options.passthrough,
      req_id: options.req_id,
    }));
  }

  /**
   * 3.12 Buy (buy)
   * Buy a contract
   */
  buy(proposal_id, price, options = {}) {
    return this.sendRequest(this._buildRequest('buy', {
      value: proposal_id,
      price: price,
      passthrough: options.passthrough,
      req_id: options.req_id,
    }));
  }

  /**
   * 3.13 Buy Contract for Multiple Accounts (buy_contract_for_multiple_accounts)
   */
  buy_contract_for_multiple_accounts(buy_contract_for_multiple_accounts = 1, options = {}) {
    return this.sendRequest(this._buildRequest('buy_contract_for_multiple_accounts', {
      value: buy_contract_for_multiple_accounts,
      buy_contract_for_multiple_accounts: options.buy_contract_for_multiple_accounts,
      max_contracts: options.max_contracts,
      passthrough: options.passthrough,
      req_id: options.req_id,
    }));
  }

  /**
   * 3.14 Cancel (cancel)
   * Cancel a contract
   */
  cancel(contract_id, options = {}) {
    return this.sendRequest(this._buildRequest('cancel', {
      value: contract_id,
      passthrough: options.passthrough,
      req_id: options.req_id,
    }));
  }

  /**
   * 3.15 Cashier (cashier)
   * Get cashier information
   */
  cashier(cashier = 1, options = {}) {
    return this.sendRequest(this._buildRequest('cashier', {
      value: cashier,
      provider: options.provider,
      type: options.type,
      passthrough: options.passthrough,
      req_id: options.req_id,
    }));
  }

  /**
   * 3.16 Contracts For Symbol (contracts_for)
   * Get contracts for a symbol
   */
  contracts_for(symbol, options = {}) {
    return this.sendRequest(this._buildRequest('contracts_for', {
      value: symbol,
      landing_company: options.landing_company,
      passthrough: options.passthrough,
      req_id: options.req_id,
    }));
  }

  /**
   * 3.17 Contract Update (contract_update)
   * Update a contract
   */
  contract_update(contract_id, limit_order, options = {}) {
    return this.sendRequest(this._buildRequest('contract_update', {
      value: contract_id,
      limit_order: limit_order,
      passthrough: options.passthrough,
      req_id: options.req_id,
    }));
  }

  /**
   * 3.18 Copy Trading Start (copy_start)
   * Start copy trading
   */
  copy_start(copy_start = 1, options = {}) {
    return this.sendRequest(this._buildRequest('copy_start', {
      value: copy_start,
      copy_start: options.copy_start,
      passthrough: options.passthrough,
      req_id: options.req_id,
    }));
  }

  /**
   * 3.19 Copy Trading Stop (copy_stop)
   * Stop copy trading
   */
  copy_stop(copy_stop = 1, options = {}) {
    return this.sendRequest(this._buildRequest('copy_stop', {
      value: copy_stop,
      passthrough: options.passthrough,
      req_id: options.req_id,
    }));
  }

  /**
   * 3.20 Copy Trading List (copytrading_list)
   * List copy trading
   */
  copytrading_list(copytrading_list = 1, options = {}) {
    return this.sendRequest(this._buildRequest('copytrading_list', {
      value: copytrading_list,
      passthrough: options.passthrough,
      req_id: options.req_id,
    }));
  }

  /**
   * 3.21 Copy Trading Statistics (copytrading_statistics)
   * Get copy trading statistics
   */
  copytrading_statistics(copytrading_statistics = 1, options = {}) {
    return this.sendRequest(this._buildRequest('copytrading_statistics', {
      value: copytrading_statistics,
      trader_id: options.trader_id,
      passthrough: options.passthrough,
      req_id: options.req_id,
    }));
  }

  /**
   * 3.22 Document Upload (document_upload)
   * Upload a document
   */
  document_upload(document_upload = 1, options = {}) {
    return this.sendRequest(this._buildRequest('document_upload', {
      value: document_upload,
      document_format: options.document_format,
      document_id: options.document_id,
      document_type: options.document_type,
      expected_checksum: options.expected_checksum,
      file_size: options.file_size,
      page_type: options.page_type,
      passthrough: options.passthrough,
      req_id: options.req_id,
    }));
  }

  /**
   * 3.23 Economic Calendar (economic_calendar)
   * Get economic calendar
   */
  economic_calendar(economic_calendar = 1, options = {}) {
    return this.sendRequest(this._buildRequest('economic_calendar', {
      value: economic_calendar,
      currency: options.currency,
      end_date: options.end_date,
      start_date: options.start_date,
      passthrough: options.passthrough,
      req_id: options.req_id,
    }));
  }

  /**
   * 3.24 Exchange Rates (exchange_rates)
   * Get exchange rates
   */
  exchange_rates(base_currency, options = {}) {
    return this.sendRequest(this._buildRequest('exchange_rates', {
      value: base_currency,
      passthrough: options.passthrough,
      req_id: options.req_id,
    }));
  }

  /**
   * 3.25 Forget (forget)
   * Forget a subscription
   */
  forget(subscription_id, options = {}) {
    return this.sendRequest(this._buildRequest('forget', {
      value: subscription_id,
      passthrough: options.passthrough,
      req_id: options.req_id,
    }));
  }

  /**
   * 3.26 Forget All (forget_all)
   * Forget all subscriptions
   */
  forget_all(forget_all = 1, options = {}) {
    return this.sendRequest(this._buildRequest('forget_all', {
      value: forget_all,
      passthrough: options.passthrough,
      req_id: options.req_id,
    }));
  }

  /**
   * 3.27 Get Account Status (get_account_status)
   * Get account status
   */
  get_account_status(get_account_status = 1, options = {}) {
    return this.sendRequest(this._buildRequest('get_account_status', {
      value: get_account_status,
      passthrough: options.passthrough,
      req_id: options.req_id,
    }));
  }

  /**
   * 3.28 Get Financial Assessment (get_financial_assessment)
   * Get financial assessment
   */
  get_financial_assessment(get_financial_assessment = 1, options = {}) {
    return this.sendRequest(this._buildRequest('get_financial_assessment', {
      value: get_financial_assessment,
      passthrough: options.passthrough,
      req_id: options.req_id,
    }));
  }

  /**
   * 3.29 Get Limits (get_limits)
   * Get account limits
   */
  get_limits(get_limits = 1, options = {}) {
    return this.sendRequest(this._buildRequest('get_limits', {
      value: get_limits,
      passthrough: options.passthrough,
      req_id: options.req_id,
    }));
  }

  /**
   * 3.30 Get Self Exclusion (get_self_exclusion)
   * Get self exclusion settings
   */
  get_self_exclusion(get_self_exclusion = 1, options = {}) {
    return this.sendRequest(this._buildRequest('get_self_exclusion', {
      value: get_self_exclusion,
      passthrough: options.passthrough,
      req_id: options.req_id,
    }));
  }

  /**
   * 3.31 Get Settings (get_settings)
   * Get account settings
   */
  get_settings(get_settings = 1, options = {}) {
    return this.sendRequest(this._buildRequest('get_settings', {
      value: get_settings,
      passthrough: options.passthrough,
      req_id: options.req_id,
    }));
  }

  /**
   * 3.32 Identity Verification (identity_verification_document_add)
   * Add identity verification document
   */
  identity_verification_document_add(identity_verification_document_add = 1, options = {}) {
    return this.sendRequest(this._buildRequest('identity_verification_document_add', {
      value: identity_verification_document_add,
      document_number: options.document_number,
      document_type: options.document_type,
      issuing_country: options.issuing_country,
      passthrough: options.passthrough,
      req_id: options.req_id,
    }));
  }

  /**
   * 3.33 Landing Company (landing_company)
   * Get landing company details
   */
  landing_company(landing_company = 1, options = {}) {
    return this.sendRequest(this._buildRequest('landing_company', {
      value: landing_company,
      landing_company: options.landing_company,
      passthrough: options.passthrough,
      req_id: options.req_id,
    }));
  }

  /**
   * 3.34 Logout (logout)
   * Logout from the session
   */
  logout(logout = 1, options = {}) {
    return this.sendRequest(this._buildRequest('logout', {
      value: logout,
      passthrough: options.passthrough,
      req_id: options.req_id,
    }));
  }

  /**
   * 3.35 MT5 Deposit (mt5_deposit)
   * Deposit to MT5 account
   */
  mt5_deposit(mt5_deposit = 1, options = {}) {
    return this.sendRequest(this._buildRequest('mt5_deposit', {
      value: mt5_deposit,
      amount: options.amount,
      from_binary: options.from_binary,
      to_mt5: options.to_mt5,
      passthrough: options.passthrough,
      req_id: options.req_id,
    }));
  }

  /**
   * 3.36 MT5 Get Settings (mt5_get_settings)
   * Get MT5 settings
   */
  mt5_get_settings(mt5_get_settings = 1, options = {}) {
    return this.sendRequest(this._buildRequest('mt5_get_settings', {
      value: mt5_get_settings,
      login: options.login,
      passthrough: options.passthrough,
      req_id: options.req_id,
    }));
  }

  /**
   * 3.37 MT5 Login List (mt5_login_list)
   * List MT5 logins
   */
  mt5_login_list(mt5_login_list = 1, options = {}) {
    return this.sendRequest(this._buildRequest('mt5_login_list', {
      value: mt5_login_list,
      passthrough: options.passthrough,
      req_id: options.req_id,
    }));
  }

  /**
   * 3.38 MT5 New Account (mt5_new_account)
   * Create new MT5 account
   */
  mt5_new_account(mt5_new_account = 1, options = {}) {
    return this.sendRequest(this._buildRequest('mt5_new_account', {
      value: mt5_new_account,
      account_type: options.account_type,
      address: options.address,
      city: options.city,
      company: options.company,
      country: options.country,
      email: options.email,
      leverage: options.leverage,
      main_password: options.main_password,
      master_password: options.master_password,
      mt5_account_category: options.mt5_account_category,
      mt5_account_type: options.mt5_account_type,
      name: options.name,
      phone: options.phone,
      phone_password: options.phone_password,
      server: options.server,
      state: options.state,
      zip_code: options.zip_code,
      passthrough: options.passthrough,
      req_id: options.req_id,
    }));
  }

  /**
   * 3.39 MT5 Password Change (mt5_password_change)
   * Change MT5 password
   */
  mt5_password_change(mt5_password_change = 1, options = {}) {
    return this.sendRequest(this._buildRequest('mt5_password_change', {
      value: mt5_password_change,
      login: options.login,
      new_password: options.new_password,
      old_password: options.old_password,
      password_type: options.password_type,
      passthrough: options.passthrough,
      req_id: options.req_id,
    }));
  }

  /**
   * 3.40 MT5 Password Check (mt5_password_check)
   * Check MT5 password
   */
  mt5_password_check(mt5_password_check = 1, options = {}) {
    return this.sendRequest(this._buildRequest('mt5_password_check', {
      value: mt5_password_check,
      login: options.login,
      password: options.password,
      password_type: options.password_type,
      passthrough: options.passthrough,
      req_id: options.req_id,
    }));
  }

  /**
   * 3.41 MT5 Password Reset (mt5_password_reset)
   * Reset MT5 password
   */
  mt5_password_reset(mt5_password_reset = 1, options = {}) {
    return this.sendRequest(this._buildRequest('mt5_password_reset', {
      value: mt5_password_reset,
      login: options.login,
      new_password: options.new_password,
      password_type: options.password_type,
      verification_code: options.verification_code,
      passthrough: options.passthrough,
      req_id: options.req_id,
    }));
  }

  /**
   * 3.42 MT5 Withdrawal (mt5_withdrawal)
   * Withdraw from MT5 account
   */
  mt5_withdrawal(mt5_withdrawal = 1, options = {}) {
    return this.sendRequest(this._buildRequest('mt5_withdrawal', {
      value: mt5_withdrawal,
      amount: options.amount,
      from_mt5: options.from_mt5,
      to_binary: options.to_binary,
      passthrough: options.passthrough,
      req_id: options.req_id,
    }));
  }

  /**
   * 3.43 New Real Money Virtual Account (new_account_virtual)
   * Create new virtual account
   */
  new_account_virtual(new_account_virtual = 1, options = {}) {
    return this.sendRequest(this._buildRequest('new_account_virtual', {
      value: new_account_virtual,
      account_opening_reason: options.account_opening_reason,
      address_city: options.address_city,
      address_line_1: options.address_line_1,
      address_line_2: options.address_line_2,
      address_postcode: options.address_postcode,
      address_state: options.address_state,
      date_of_birth: options.date_of_birth,
      email_consent: options.email_consent,
      first_name: options.first_name,
      last_name: options.last_name,
      phone: options.phone,
      residence: options.residence,
      salutation: options.salutation,
      secret_answer: options.secret_answer,
      secret_question: options.secret_question,
      tax_identification_number: options.tax_identification_number,
      tax_residence: options.tax_residence,
      passthrough: options.passthrough,
      req_id: options.req_id,
    }));
  }

  /**
   * 3.44 OAuth Apps (oauth_apps)
   * Get OAuth apps
   */
  oauth_apps(oauth_apps = 1, options = {}) {
    return this.sendRequest(this._buildRequest('oauth_apps', {
      value: oauth_apps,
      passthrough: options.passthrough,
      req_id: options.req_id,
    }));
  }

  /**
   * 3.45 P2P Advert Create (p2p_advert_create)
   * Create P2P advert
   */
  p2p_advert_create(p2p_advert_create = 1, options = {}) {
    return this.sendRequest(this._buildRequest('p2p_advert_create', {
      value: p2p_advert_create,
      amount: options.amount,
      contact_info: options.contact_info,
      description: options.description,
      local_currency: options.local_currency,
      max_order_amount: options.max_order_amount,
      min_order_amount: options.min_order_amount,
      payment_method: options.payment_method,
      rate: options.rate,
      rate_type: options.rate_type,
      type: options.type,
      passthrough: options.passthrough,
      req_id: options.req_id,
    }));
  }

  /**
   * 3.46 P2P Advert Info (p2p_advert_info)
   * Get P2P advert info
   */
  p2p_advert_info(p2p_advert_info = 1, options = {}) {
    return this.sendRequest(this._buildRequest('p2p_advert_info', {
      value: p2p_advert_info,
      id: options.id,
      passthrough: options.passthrough,
      req_id: options.req_id,
    }));
  }

  /**
   * 3.47 P2P Advert List (p2p_advert_list)
   * List P2P adverts
   */
  p2p_advert_list(p2p_advert_list = 1, options = {}) {
    return this.sendRequest(this._buildRequest('p2p_advert_list', {
      value: p2p_advert_list,
      advertiser_id: options.advertiser_id,
      counterparty_type: options.counterparty_type,
      limit: options.limit,
      offset: options.offset,
      passthrough: options.passthrough,
      req_id: options.req_id,
    }));
  }

  /**
   * 3.48 P2P Advert Update (p2p_advert_update)
   * Update P2P advert
   */
  p2p_advert_update(p2p_advert_update = 1, options = {}) {
    return this.sendRequest(this._buildRequest('p2p_advert_update', {
      value: p2p_advert_update,
      id: options.id,
      is_active: options.is_active,
      passthrough: options.passthrough,
      req_id: options.req_id,
    }));
  }

  /**
   * 3.49 P2P Chat Create (p2p_chat_create)
   * Create P2P chat
   */
  p2p_chat_create(p2p_chat_create = 1, options = {}) {
    return this.sendRequest(this._buildRequest('p2p_chat_create', {
      value: p2p_chat_create,
      order_id: options.order_id,
      passthrough: options.passthrough,
      req_id: options.req_id,
    }));
  }

  /**
   * 3.50 P2P Order Cancel (p2p_order_cancel)
   * Cancel P2P order
   */
  p2p_order_cancel(p2p_order_cancel = 1, options = {}) {
    return this.sendRequest(this._buildRequest('p2p_order_cancel', {
      value: p2p_order_cancel,
      id: options.id,
      passthrough: options.passthrough,
      req_id: options.req_id,
    }));
  }

  /**
   * 3.51 P2P Order Confirm (p2p_order_confirm)
   * Confirm P2P order
   */
  p2p_order_confirm(p2p_order_confirm = 1, options = {}) {
    return this.sendRequest(this._buildRequest('p2p_order_confirm', {
      value: p2p_order_confirm,
      id: options.id,
      passthrough: options.passthrough,
      req_id: options.req_id,
    }));
  }

  /**
   * 3.52 P2P Order Create (p2p_order_create)
   * Create P2P order
   */
  p2p_order_create(p2p_order_create = 1, options = {}) {
    return this.sendRequest(this._buildRequest('p2p_order_create', {
      value: p2p_order_create,
      advert_id: options.advert_id,
      amount: options.amount,
      passthrough: options.passthrough,
      req_id: options.req_id,
    }));
  }

  /**
   * 3.53 P2P Order Dispute (p2p_order_dispute)
   * Dispute P2P order
   */
  p2p_order_dispute(p2p_order_dispute = 1, options = {}) {
    return this.sendRequest(this._buildRequest('p2p_order_dispute', {
      value: p2p_order_dispute,
      dispute_reason: options.dispute_reason,
      id: options.id,
      passthrough: options.passthrough,
      req_id: options.req_id,
    }));
  }

  /**
   * 3.54 P2P Order Info (p2p_order_info)
   * Get P2P order info
   */
  p2p_order_info(p2p_order_info = 1, options = {}) {
    return this.sendRequest(this._buildRequest('p2p_order_info', {
      value: p2p_order_info,
      id: options.id,
      passthrough: options.passthrough,
      req_id: options.req_id,
    }));
  }

  /**
   * 3.55 P2P Order List (p2p_order_list)
   * List P2P orders
   */
  p2p_order_list(p2p_order_list = 1, options = {}) {
    return this.sendRequest(this._buildRequest('p2p_order_list', {
      value: p2p_order_list,
      advert_id: options.advert_id,
      limit: options.limit,
      offset: options.offset,
      passthrough: options.passthrough,
      req_id: options.req_id,
    }));
  }

  /**
   * 3.56 P2P Order Review (p2p_order_review)
   * Review P2P order
   */
  p2p_order_review(p2p_order_review = 1, options = {}) {
    return this.sendRequest(this._buildRequest('p2p_order_review', {
      value: p2p_order_review,
      id: options.id,
      rating: options.rating,
      recommended: options.recommended,
      passthrough: options.passthrough,
      req_id: options.req_id,
    }));
  }

  /**
   * 3.57 P2P Payment Methods (p2p_payment_methods)
   * Get P2P payment methods
   */
  p2p_payment_methods(p2p_payment_methods = 1, options = {}) {
    return this.sendRequest(this._buildRequest('p2p_payment_methods', {
      value: p2p_payment_methods,
      passthrough: options.passthrough,
      req_id: options.req_id,
    }));
  }

  /**
   * 3.58 Payment Agent Create (paymentagent_create)
   * Create payment agent
   */
  paymentagent_create(paymentagent_create = 1, options = {}) {
    return this.sendRequest(this._buildRequest('paymentagent_create', {
      value: paymentagent_create,
      code_of_conduct_approval: options.code_of_conduct_approval,
      commission_deposit: options.commission_deposit,
      commission_withdrawal: options.commission_withdrawal,
      email: options.email,
      information: options.information,
      payment_agent_name: options.payment_agent_name,
      phone: options.phone,
      supported_payment_methods: options.supported_payment_methods,
      url: options.url,
      passthrough: options.passthrough,
      req_id: options.req_id,
    }));
  }

  /**
   * 3.59 Payment Agent Details (paymentagent_details)
   * Get payment agent details
   */
  paymentagent_details(paymentagent_details = 1, options = {}) {
    return this.sendRequest(this._buildRequest('paymentagent_details', {
      value: paymentagent_details,
      passthrough: options.passthrough,
      req_id: options.req_id,
    }));
  }

  /**
   * 3.60 Payment Agent List (paymentagent_list)
   * List payment agents
   */
  paymentagent_list(paymentagent_list = 1, options = {}) {
    return this.sendRequest(this._buildRequest('paymentagent_list', {
      value: paymentagent_list,
      country: options.country,
      passthrough: options.passthrough,
      req_id: options.req_id,
    }));
  }

  /**
   * 3.61 Payment Agent Transfer (paymentagent_transfer)
   * Transfer via payment agent
   */
  paymentagent_transfer(paymentagent_transfer = 1, options = {}) {
    return this.sendRequest(this._buildRequest('paymentagent_transfer', {
      value: paymentagent_transfer,
      amount: options.amount,
      currency: options.currency,
      description: options.description,
      dst_account: options.dst_account,
      transfer_to: options.transfer_to,
      passthrough: options.passthrough,
      req_id: options.req_id,
    }));
  }

  /**
   * 3.62 Payment Agent Withdraw (paymentagent_withdraw)
   * Withdraw via payment agent
   */
  paymentagent_withdraw(paymentagent_withdraw = 1, options = {}) {
    return this.sendRequest(this._buildRequest('paymentagent_withdraw', {
      value: paymentagent_withdraw,
      amount: options.amount,
      currency: options.currency,
      description: options.description,
      paymentagent_loginid: options.paymentagent_loginid,
      paymentagent_name: options.paymentagent_name,
      verification_code: options.verification_code,
      passthrough: options.passthrough,
      req_id: options.req_id,
    }));
  }

  /**
   * 3.63 Ping (ping)
   * Ping the server
   */
  ping(ping = 1, options = {}) {
    return this.sendRequest(this._buildRequest('ping', {
      value: ping,
      passthrough: options.passthrough,
      req_id: options.req_id,
    }));
  }

  /**
   * 3.64 Portfolio (portfolio)
   * Get portfolio
   */
  portfolio(options = {}) {
    return this.sendRequest(this._buildRequest('portfolio', {
      value: options.value !== undefined ? options.value : 1,
      contract_type: options.contract_type,
      passthrough: options.passthrough,
      req_id: options.req_id,
    }));
  }

  /**
   * 3.65 Price Proposal (proposal)
   * Get price proposal
   */
  proposal(contract_type, currency, symbol, options = {}) {
    return this.sendRequest(this._buildRequest('proposal', {
      value: 1,
      contract_type: contract_type,
      currency: currency,
      symbol: symbol,
      amount: options.amount,
      basis: options.basis,
      date_expiry: options.date_expiry,
      duration: options.duration,
      duration_unit: options.duration_unit,
      limit_order: options.limit_order,
      subscribe: options.subscribe,
      passthrough: options.passthrough,
      req_id: options.req_id,
    }));
  }

  /**
   * 3.66 Proposal Open Contract (proposal_open_contract)
   * Get proposal open contract
   */
  proposal_open_contract(contract_id, options = {}) {
    return this.sendRequest(this._buildRequest('proposal_open_contract', {
      value: contract_id,
      subscribe: options.subscribe,
      passthrough: options.passthrough,
      req_id: options.req_id,
    }));
  }

  /**
   * 3.67 Profit Table (profit_table)
   * Get profit table
   */
  profit_table(profit_table = 1, options = {}) {
    return this.sendRequest(this._buildRequest('profit_table', {
      value: profit_table,
      contract_type: options.contract_type,
      date_from: options.date_from,
      date_to: options.date_to,
      description: options.description,
      limit: options.limit,
      offset: options.offset,
      passthrough: options.passthrough,
      req_id: options.req_id,
    }));
  }

  /**
   * 3.68 Reality Check (reality_check)
   * Get reality check
   */
  reality_check(reality_check = 1, options = {}) {
    return this.sendRequest(this._buildRequest('reality_check', {
      value: reality_check,
      passthrough: options.passthrough,
      req_id: options.req_id,
    }));
  }

  /**
   * 3.69 Residence List (residence_list)
   * Get residence list
   */
  residence_list(residence_list = 1, options = {}) {
    return this.sendRequest(this._buildRequest('residence_list', {
      value: residence_list,
      passthrough: options.passthrough,
      req_id: options.req_id,
    }));
  }

  /**
   * 3.70 Revoke OAuth App (revoke_oauth_app)
   * Revoke OAuth app
   */
  revoke_oauth_app(revoke_oauth_app = 1, options = {}) {
    return this.sendRequest(this._buildRequest('revoke_oauth_app', {
      value: revoke_oauth_app,
      app_id: options.app_id,
      passthrough: options.passthrough,
      req_id: options.req_id,
    }));
  }

  /**
   * 3.71 Sell (sell)
   * Sell a contract
   */
  sell(contract_id, price, options = {}) {
    return this.sendRequest(this._buildRequest('sell', {
      value: contract_id,
      price: price,
      passthrough: options.passthrough,
      req_id: options.req_id,
    }));
  }

  /**
   * 3.72 Sell Contract for Multiple Accounts (sell_contract_for_multiple_accounts)
   */
  sell_contract_for_multiple_accounts(sell_contract_for_multiple_accounts = 1, options = {}) {
    return this.sendRequest(this._buildRequest('sell_contract_for_multiple_accounts', {
      value: sell_contract_for_multiple_accounts,
      price: options.price,
      sell_contract_for_multiple_accounts: options.sell_contract_for_multiple_accounts,
      passthrough: options.passthrough,
      req_id: options.req_id,
    }));
  }

  /**
   * 3.73 Sell Expired Contracts (sell_expired)
   * Sell expired contracts
   */
  sell_expired(sell_expired = 1, options = {}) {
    return this.sendRequest(this._buildRequest('sell_expired', {
      value: sell_expired,
      passthrough: options.passthrough,
      req_id: options.req_id,
    }));
  }

  /**
   * 3.74 Set Account Currency (set_account_currency)
   * Set account currency
   */
  set_account_currency(set_account_currency = 1, options = {}) {
    return this.sendRequest(this._buildRequest('set_account_currency', {
      value: set_account_currency,
      account_currency: options.account_currency,
      passthrough: options.passthrough,
      req_id: options.req_id,
    }));
  }

  /**
   * 3.75 Set Financial Assessment (set_financial_assessment)
   * Set financial assessment
   */
  set_financial_assessment(set_financial_assessment = 1, options = {}) {
    return this.sendRequest(this._buildRequest('set_financial_assessment', {
      value: set_financial_assessment,
      account_turnover: options.account_turnover,
      binary_options_trading_experience: options.binary_options_trading_experience,
      binary_options_trading_frequency: options.binary_options_trading_frequency,
      cfd_trading_experience: options.cfd_trading_experience,
      cfd_trading_frequency: options.cfd_trading_frequency,
      education_level: options.education_level,
      employment_industry: options.employment_industry,
      employment_status: options.employment_status,
      estimated_worth: options.estimated_worth,
      forex_trading_experience: options.forex_trading_experience,
      forex_trading_frequency: options.forex_trading_frequency,
      income_source: options.income_source,
      net_income: options.net_income,
      occupation: options.occupation,
      other_instruments_trading_experience: options.other_instruments_trading_experience,
      other_instruments_trading_frequency: options.other_instruments_trading_frequency,
      source_of_wealth: options.source_of_wealth,
      passthrough: options.passthrough,
      req_id: options.req_id,
    }));
  }

  /**
   * 3.76 Set Self Exclusion (set_self_exclusion)
   * Set self exclusion
   */
  set_self_exclusion(set_self_exclusion = 1, options = {}) {
    return this.sendRequest(this._buildRequest('set_self_exclusion', {
      value: set_self_exclusion,
      exclude_until: options.exclude_until,
      max_30day_deposit: options.max_30day_deposit,
      max_30day_losses: options.max_30day_losses,
      max_30day_turnover: options.max_30day_turnover,
      max_7day_deposit: options.max_7day_deposit,
      max_7day_losses: options.max_7day_losses,
      max_7day_turnover: options.max_7day_turnover,
      max_balance: options.max_balance,
      max_deposit: options.max_deposit,
      max_losses: options.max_losses,
      max_open_bets: options.max_open_bets,
      max_turnover: options.max_turnover,
      session_duration_limit: options.session_duration_limit,
      timeout_until: options.timeout_until,
      passthrough: options.passthrough,
      req_id: options.req_id,
    }));
  }

  /**
   * 3.77 Set Settings (set_settings)
   * Set account settings
   */
  set_settings(set_settings = 1, options = {}) {
    return this.sendRequest(this._buildRequest('set_settings', {
      value: set_settings,
      account_opening_reason: options.account_opening_reason,
      address_city: options.address_city,
      address_line_1: options.address_line_1,
      address_line_2: options.address_line_2,
      address_postcode: options.address_postcode,
      address_state: options.address_state,
      allow_copiers: options.allow_copiers,
      email_consent: options.email_consent,
      email: options.email,
      first_name: options.first_name,
      last_name: options.last_name,
      phone: options.phone,
      place_of_birth: options.place_of_birth,
      preferred_language: options.preferred_language,
      request_professional_status: options.request_professional_status,
      salutation: options.salutation,
      tax_identification_number: options.tax_identification_number,
      tax_residence: options.tax_residence,
      date_of_birth: options.date_of_birth,
      passthrough: options.passthrough,
      req_id: options.req_id,
    }));
  }

  /**
   * 3.78 Statement (statement)
   * Get account statement
   */
  statement(statement = 1, options = {}) {
    return this.sendRequest(this._buildRequest('statement', {
      value: statement,
      action_type: options.action_type,
      date_from: options.date_from,
      date_to: options.date_to,
      description: options.description,
      limit: options.limit,
      offset: options.offset,
      passthrough: options.passthrough,
      req_id: options.req_id,
    }));
  }

  /**
   * 3.79 States List (states_list)
   * Get states list
   */
  states_list(states_list = 1, options = {}) {
    return this.sendRequest(this._buildRequest('states_list', {
      value: states_list,
      states_list: options.states_list,
      passthrough: options.passthrough,
      req_id: options.req_id,
    }));
  }

  /**
   * 3.80 Ticks (ticks)
   * Subscribe to tick stream
   */
  ticks(symbols, options = {}) {
    return this.sendRequest(this._buildRequest('ticks', {
      value: symbols,
      subscribe: options.subscribe,
      passthrough: options.passthrough,
      req_id: options.req_id,
    }));
  }

  /**
   * 3.81 Ticks History (ticks_history)
   * Get ticks history
   */
  ticks_history(symbol, end, options = {}) {
    return this.sendRequest(this._buildRequest('ticks_history', {
      value: symbol,
      adjust_start_time: options.adjust_start_time,
      count: options.count,
      end: end,
      start: options.start,
      style: options.style,
      granularity: options.granularity,
      subscribe: options.subscribe,
      passthrough: options.passthrough,
      req_id: options.req_id,
    }));
  }

  /**
   * 3.82 Time (time)
   * Get server time
   */
  time(time = 1, options = {}) {
    return this.sendRequest(this._buildRequest('time', {
      value: time,
      passthrough: options.passthrough,
      req_id: options.req_id,
    }));
  }

  /**
   * 3.83 Trading Duration (trading_durations)
   * Get trading durations
   */
  trading_durations(trading_durations = 1, options = {}) {
    return this.sendRequest(this._buildRequest('trading_durations', {
      value: trading_durations,
      landing_company: options.landing_company,
      passthrough: options.passthrough,
      req_id: options.req_id,
    }));
  }

  /**
   * 3.84 Trading Platform Accounts (trading_platform_accounts)
   * Get trading platform accounts
   */
  trading_platform_accounts(trading_platform_accounts = 1, options = {}) {
    return this.sendRequest(this._buildRequest('trading_platform_accounts', {
      value: trading_platform_accounts,
      platform: options.platform,
      passthrough: options.passthrough,
      req_id: options.req_id,
    }));
  }

  /**
   * 3.85 Trading Platform Deposit (trading_platform_deposit)
   * Deposit to trading platform
   */
  trading_platform_deposit(trading_platform_deposit = 1, options = {}) {
    return this.sendRequest(this._buildRequest('trading_platform_deposit', {
      value: trading_platform_deposit,
      amount: options.amount,
      from_binary: options.from_binary,
      platform: options.platform,
      to_trading_platform: options.to_trading_platform,
      passthrough: options.passthrough,
      req_id: options.req_id,
    }));
  }

  /**
   * 3.86 Trading Platform Password Reset (trading_platform_password_reset)
   * Reset trading platform password
   */
  trading_platform_password_reset(trading_platform_password_reset = 1, options = {}) {
    return this.sendRequest(this._buildRequest('trading_platform_password_reset', {
      value: trading_platform_password_reset,
      account_id: options.account_id,
      new_password: options.new_password,
      platform: options.platform,
      verification_code: options.verification_code,
      passthrough: options.passthrough,
      req_id: options.req_id,
    }));
  }

  /**
   * 3.87 Trading Platform Withdrawal (trading_platform_withdrawal)
   * Withdraw from trading platform
   */
  trading_platform_withdrawal(trading_platform_withdrawal = 1, options = {}) {
    return this.sendRequest(this._buildRequest('trading_platform_withdrawal', {
      value: trading_platform_withdrawal,
      amount: options.amount,
      from_trading_platform: options.from_trading_platform,
      platform: options.platform,
      to_binary: options.to_binary,
      passthrough: options.passthrough,
      req_id: options.req_id,
    }));
  }

  /**
   * 3.88 Trading Times (trading_times)
   * Get trading times
   */
  trading_times(date, options = {}) {
    return this.sendRequest(this._buildRequest('trading_times', {
      value: date,
      passthrough: options.passthrough,
      req_id: options.req_id,
    }));
  }

  /**
   * 3.89 Transaction (transaction)
   * Get transaction
   */
  transaction(transaction = 1, options = {}) {
    return this.sendRequest(this._buildRequest('transaction', {
      value: transaction,
      transaction_id: options.transaction_id,
      subscribe: options.subscribe,
      passthrough: options.passthrough,
      req_id: options.req_id,
    }));
  }

  /**
   * 3.90 Verify Email (verify_email)
   * Verify email
   */
  verify_email(verify_email = 1, options = {}) {
    return this.sendRequest(this._buildRequest('verify_email', {
      value: verify_email,
      type: options.type,
      url_parameters: options.url_parameters,
      verify_email: options.verify_email,
      passthrough: options.passthrough,
      req_id: options.req_id,
    }));
  }

  /**
   * 3.91 Website Status (website_status)
   * Get website status
   */
  website_status(website_status = 1, options = {}) {
    return this.sendRequest(this._buildRequest('website_status', {
      value: website_status,
      passthrough: options.passthrough,
      req_id: options.req_id,
    }));
  }
}

export default DerivAPI;
