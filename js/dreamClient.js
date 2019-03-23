var dreamClient = function(url, client_id){
    // store the base url
    this.url = url;
    
    // and create an oauth instance
    this.oauth = new OAuth({
        'client_id': client_id, 
        'scopes': ['profile'], 
        'authorize_url': url+'login/o/authorize/', 
        'token_url': url+'login/o/token/'
    });
}

dreamClient.prototype.authenticate = function(callback){
    var testURL = this.url+'/api/v1/';
    this.oauth.authenticate(testURL, callback);
};

dreamClient.prototype.search = function(query, limit, skip, callback){
    var theQuery = this.parseQuery(query);
    console.log('sending query', theQuery);
    return this.oauth.get(this.url+'api/v1/users/?limit='+limit+'&skip='+skip+'&tl='+theQuery, callback.bind(this)); 
}

dreamClient.prototype.parseQuery = function(code){

  // create a minimal PreJSPy parser
  var parser = new PreJsPy();
  parser.setTertiaryOperatorEnabled(false)
  parser.setUnaryOperators([]);
  parser.setBinaryOperators({
      'equals': 2, 'is': 2, ':': 2, '=': 2, '==': 2, '===': 2,
      'contains': 2, '~': 2,
  });
  
  // turn the code into a parse tree
  var tree = this._parseTree(parser.parse(code));
  return this._toQueryString(tree);
}

dreamClient.prototype._parseTree = function(tree){
  // a compound expression corresponds to a sequence
  // this is parsed seperatly
  if(tree.type == 'Compound'){
    return this._parseCompound(tree.body);

  // a binary expression corresponds to KEY = VALUE
  // so we need to extract the field name and value
  } else if(tree.type == 'BinaryExpression'){
    var kind = 'equals';
    if (tree.operator === '~' || tree.operator === 'contains'){kind = 'contains';}

    var result = {'type': kind};

    var dict = {};
    dict[this._parseAsLit(tree.left)] = this._parseAsLit(tree.right);
    
    result[kind + 'dict'] = dict;
    return result;

  // literal or literal-like expressions
  // these will be split and parsed seperatly later on
  } else if(tree.type == 'Literal' || tree.type == 'ThisExpression' || tree.type == 'Identifier') {
    return {'type': 'literal', 'value': this._parseAsLit(tree)};
  } else {
    // console.warn('unsupported query', tree); 
    return {'type': 'nop'}; 
  }
}

dreamClient.prototype._parseAsLit = function(tree){
  if(tree.type == 'Literal'){
    return tree.value;
  } else if(tree.type == 'ThisExpression'){
    return 'this';
  } else if (tree.type == 'Identifier'){
    return tree.name;
  } else {
    return '';
  }
}

dreamClient.prototype._parseCompound = function(trees){
  var resultLit = ''; var equalsDict = {}; var containsDict = {};
  var isEmpty = true;
  
  var result;
  for(var i = 0; i < trees.length; i++){
    result = this._parseTree(trees[i]);

    // literal: append ' '+value
    if(result.type == 'literal' || result.type == 'combination'){
      if(resultLit.length == 0){
        resultLit = result.value;
      } else {
        resultLit += ' '+result.value 
      }
    }
    
    // equals: add to dict
    if(result.type == 'equals' || result.type == 'combination'){
      for (var key in result.equalsdict){
          isEmpty = false;
          equalsDict[key] = result.equalsdict[key];
      }
    }

    // contains: add to dict
    if(result.type == 'contains' || result.type == 'combination'){
      for (var key in result.containsdict){
          isEmpty = false;
          containsDict[key] = result.containsdict[key];
      }
    }
    
    // and ignore everything else. 
  }

  // empty dict
  if (isEmpty){
    return { 'type': 'literal', 'value': resultLit };
  }
  
  // else we return a combination
  return { 'type': 'combination', 'value': resultLit, 'equalsdict': equalsDict, 'containsdict': containsDict };
}

dreamClient.prototype._toQueryString = function(tree){
  switch(tree.type){
    case 'literal':
      return this._toLiteralString(tree);
      break;
    case 'equals':
      return this._toEqualString(tree);
      break;
    case 'contains':
      return this._toContainString(tree);
      break;
    case 'combination':
      var litString = this._toLiteralString(tree);
      var equalString = this._toEqualString(tree);
      var containsString = this._toContainString(tree);

      var clauses = [];
      if(litString != '()'){
        clauses.push('(' + litString + ')');
      }
      if(equalString != '()'){
        clauses.push('(' + equalString + ')');
      }
      if(containsString != '()'){
        clauses.push('(' + containsString + ')');
      }
      return clauses.join(' and ');
      break;
    }
  return '';
}

dreamClient.prototype._toEqualString = function(tree){
  var query = [];

  // $key = $value queries
  var value;
  for(var key in tree.equalsdict){
    value = tree.equalsdict[key];
    if(key == 'major'){key = 'majorShort'; } // alias major => majorShort
    query.push(JSON.stringify(key) + " equals "+JSON.stringify(value));
  }
  
  // joined with an and
  return '('+query.join(') and (')+')';
}

dreamClient.prototype._toContainString = function(tree){
  var query = [];

  // $key = $value queries
  var value;
  for(var key in tree.containsdict){
    value = tree.containsdict[key];
    if(key == 'major'){key = 'majorShort'; } // alias major => majorShort
    query.push(JSON.stringify(key) + " contains "+JSON.stringify(value));
  }
  
  // joined with an and
  return '('+query.join(') and (')+')';
}


dreamClient.prototype._toLiteralString = function(tree){
  
  // split into words
  var words = tree.value.split(/[\s-\.]+/g);
  // and do a 'contains' for first and last name 
  var components = [];  
  for(var i = 0; i < words.length; i++){

    // because Majorka complained about showing up to often
    // when people start their query with 'major', we need
    // to exclude all those cases from the full text search
    var substring = words[i].toLowerCase();
    if('major'.substring(0, substring.length) == substring) continue;
  
    // firstName or lastName  should contain the lower-case version of the search
    components.push(
      '(' +
        '"firstName" contains '+JSON.stringify(words[i].toLowerCase()) +
      ') or (' +
        '"lastName" contains '+JSON.stringify(words[i].toLowerCase()) +
      ')'
    );
  }
  
  // join all components with an 'and'
  return '('+components.join(') and (')+')';
}

dreamClient.prototype.getImageURL = function(username){
    return this.url+'api/v1/users/'+username+'/image';
}