/**
* oauth.js -- a really simple OAuth library
* depends on localStorage and jQuery
*/

/**
* The complete Triforce, or one or more components of the Triforce.
* @typedef {Object} OAuth~Settings
* @property {string|undefined} redirect_url URL that that the OAuth Server should redirect back to. Defaults to the current url, excluding all parameters. 
* @property {string} client_id The OAuth Client ID. 
* @property {Array[string]|string} scopes List of scopes to request from the server. 
* @property {string} authorize_url The URL used to retrieve an authorization code. 
* @property {string} token_url The URL used to retrieve a token from. 
*/

/**
* Represents a single OAuth object. 
* @constructor
* @param {OAuth~Settings} settings Settings to use. 
*/
var OAuth = function (settings){
  /** @type {string} the url to ask the server to redirect to, i.e. the url of this page */
  this.redirect_url = settings.redirect_url || location.protocol + '//' + location.host + location.pathname;
  
  /** @type {string} client identification */
  this.client_id = settings.client_id;
  if(!this.client_id) throw new Error('missing client_id');
  
  /** @type {string} string of comma-seperated scopes to request from the server */
  this.scopes = (typeof settings.scopes == 'string')?settings.scopes:settings.scopes.join(',');
  
  /** @type {string} client state that will later be generated dynamically */
  this.client_state = this._load('client_state') || '';
  
  /** @type {string} the url to get the authorization code from */
  this.authorize_url = settings.authorize_url;
  if(!this.authorize_url) throw new Error('missing authorize_url');
  
  /** @type {string} the url to get the token from */
  this.token_url = settings.token_url;
  if(!this.token_url) throw new Error('missing token_url');
};

// ==============================================
// UTILITIES
// ==============================================

/**
* Generates a random UUID4, using Math.random(). 
* Adapted from https://stackoverflow.com/a/2117523
* @return {string}
*/
OAuth.prototype._gen_uuid = function(){
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
* Returns a single get parameter from the URL, or null if it doesn't exist. 
* adapted from https://www.creativejuiz.fr/blog/en/javascript-en/read-url-get-parameters-with-javascript
* @param {string} param Parameter to retireve from URL
* @return {string}
*/
OAuth.prototype._get_param = function(param){
  var vars = {};
  window.location.href.replace( location.hash, '' ).replace( 
    /[?&]+([^=&]+)=?([^&]*)?/gi, // regexp
    function( m, key, value ) { // callback
      vars[key] = value !== undefined ? value : '';
    }
  );
  
  return vars[param] ? decodeURIComponent(vars[param]) : null;
}

/**
* Stores a value permanently in memory, or deletes it. 
* @param {string} name Name of value to store or delete. 
* @param {*|undefined} value Value to store for parameter. If omitted, deleted the value. 
*/
OAuth.prototype._save  = function(name, value) {
  if(typeof value == 'undefined'){
    localStorage.removeItem('oAuth_' + name);
  } else {
    localStorage.setItem('oAuth_' + name, value);
  }
}

/**
* Loads a value from memory. 
* @param {string} name Name of value to load
* @return {*}
*/
OAuth.prototype._load = function(name) {
  return localStorage.getItem('oAuth_' + name);
}

// ==============================================
// ACCESSORS + MAIN FUNCTIONS
// ==============================================

/**
* Returns the current token or false. 
* @return {string|boolean}
*/
OAuth.prototype.getToken = function(){
  return this._load('token') || false;
}

/** Retrieves the content of a URL with the given token. 
* @param {string} url - URL to retrieve
* @param {function} callback - Callback
*/
OAuth.prototype.get = function(url, callback){
  // we always give 'this' as a parameter
  var TCallback = callback.bind(this);
  
  jQuery.ajax({
    'url': url, 
    'type': 'GET', 
    'headers': {
      'Authorization': 'Bearer '+this.getToken()
    }, 
    'success': function(data){
      TCallback(true, data);
    }, 
    'error': function(){
      TCallback(false);
    }
  });
}

// ==============================================
// AUTHENTICATION: Here be dragons
// ==============================================

/** Authenticates to the server
* @param {string} url - URL to retrieve
* @param {function} callback Callback
*/
OAuth.prototype.authenticate = function(test_url, callback){
  // we always give 'this' as a parameter
  var TCallback = callback.bind(this);
  
  // start by testing if authentication works
  this._test_auth(test_url, function(success){
    // if we are already done, we can return. 
    if(success){
      TCallback(true);
      return; 
    }
    
    // check if we had a token as a parameter
    var code = this._get_param('code');
    var state = this._get_param('state');
    
    // if we have code, then verify it
    if(code){
      this._authenticate_get_token(code, state, TCallback);
    
    // else get it
    } else {
      this._authenticate_get_code();
    }
  })
}

/** Retrieves a code from the server
*/
OAuth.prototype._authenticate_get_code = function(){
  // clear all authentication info
  this.deauthenticate();
  
  // generate and store a UUID (as client state)
  this.client_state = this._gen_uuid();
  this._save("client_state", this.client_state);
  
  // and redirect the user to the authorize url
  location.href = this.authorize_url
  + '?response_type=code&client_id='
  + encodeURIComponent(this.client_id)
  + '&redirect_uri='
  + encodeURIComponent(this.redirect_url)
  + '&scope='
  + encodeURIComponent(this.scopes)
  + '&state='
  + encodeURIComponent(this.client_state);
}

/** Exchanges a code for a token
* @param {string} code Code to exchange for a token. 
* @param {string} state Client State to check. 
* @param {function} callback Callback
*/
OAuth.prototype._authenticate_get_token = function(code, state, callback){
  // if the state mismatches, something went wrong
  if(state != this.client_state){
    callback(false, 'wrong client state');
    return;
  }

  var me = this;
  
  // and make an AJAX request
  $.ajax({
    'type': 'POST',
    'url': this.token_url,
    'data': {
      'grant_type': 'authorization_code', 
      'code': code, 
      'redirect_uri': this.redirect_url, 
      'client_id': this.client_id
    },
    'success': function(data){
      me._save('token', data['access_token']);
      callback(true);
    },
    'fail': function(){
      callback(false, 'failed to get code');
    }
  });
}
/** Tests if the client is already authenticated
* @param {string} test_url URL to test on
* @param {function} callback Callback
*/
OAuth.prototype._test_auth = function(test_url, callback){
  // we always give 'this' as a parameter
  var TCallback = callback.bind(this);
  
  // if we don't have a token, we are not authenticated. 
  if(!this.getToken()){
    TCallback(false);
    return;
  }

  // if we have a token, try the test_url
  this.get(test_url, function(success, data){
    TCallback(success);
  });
}

/** Clears all authentication information stored. */
OAuth.prototype.deauthenticate = function(){
  this._save('token');
  this._save('client_state');
}