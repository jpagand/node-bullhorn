'use strict';

/**
 * Module dependencies
 */

var url = require('url');
var request = require('request');
var extend = require('deep-extend');
var _ = require('lodash');
var soap = require('soap');
var wsdl = 'https://api.bullhornstaffing.com/webservices-2.0/?wsdl';
var util = require('util');
var maxRetry = 3;
function Bullhorn (options) {

  this.options = extend({
    username: null,
    password: null,
    apiKey: null,
    onSuccessInit: null,
    onFailInit: null
  }, options);
  this._retry = 0;
  this._sessionKey = null;
  console.log('new Bullhorn instance');
  this.__createSession(function (err) {
    if (!err) {
      this.__refreshSession(function (err) {
        if (!err) {
          if (typeof(this.options.onSuccessInit) === 'function') {
            this.options.onSuccessInit();
          }
        }
        else {
          if (typeof(this.options.onFailInit) === 'function') {
            this.options.onFailInit(err);
          }
        }
      }.bind(this));
    }
  }.bind(this));
}
Bullhorn.prototype.__refreshSession = function (cb) {
  this.__startSession({username: this.options.username, password: this.options.password, apiKey: this.options.apiKey}, cb);
};
Bullhorn.prototype.__createSession = function (cb) {
  this._retry++;
  soap.createClient(wsdl, function (err, client) {
    if (err) {
      if (this._retry < maxRetry) {
        console.log('__createSession - error: ',  (this._retry + 1), ' attempt');
        this.__createSession(cb);
      } else {
        console.log('__createSession - ', maxRetry, ' attempts done, quit');
        cb(err);
      }
    } else {
      this._retry = 0;
      this.client = client;
      cb(null, client);
    }
  }.bind(this))
};

Bullhorn.prototype.__startSession = function (args, cb) {
  this._retry++;
  this.client.startSession(args, function (err, result) {
    if (err) {
      if (this._retry < maxRetry) {
        console.log('__startSession - error: ',  (this._retry + 1), ' attempt');
        this.__startSession(args, cb);
      } else {
        console.log('__startSession - ', maxRetry, ' attempts done, quit');
        cb(err);
      }
    } else {
      this._retry = 0;
      this._sessionKey = result.return.session;

      cb(null, result);
    }
  }.bind(this))
};

Bullhorn.prototype.__getEntityFiles = function (entityName, cb) {
  this._retry++;
  this.client.getEntityFiles({session: this._sessionKey, entityName: entityName}, function (err, result) {
    if (err) {
      if (this._retry < maxRetry) {
        console.log('__getEntityFiles - error: ',  (this._retry + 1), ' attempt');
        /* this.__startSession({username: this.options.username, password: this.options.password, apiKey: this.options.apiKey}, function (err) {
         if(!err) {
         this.__getEntityFiles(entityName, cb);
         }
         }.bind(this));*/
        cb(err);
      } else {
        console.log('__getEntityFiles - ', maxRetry, ' attempts done, quit');
        cb(err);
      }
    } else {
      this._retry = 0;
      this._sessionKey = result.return.session;
      cb(null, result);
    }
  }.bind(this))
};
Bullhorn.prototype.__query = function (query, cb) {
  this.client.query({session: this._sessionKey, query: query},
    function (err, res) {
      if (res  && res.return && res.return.session) {
        this._retry = 0;
        this._sessionKey = res.return.session;
      }
      cb(err, res);
    }.bind(this));
};
Bullhorn.prototype.__find = function (entityName, id, cb) {
  this.client.find({session: this._sessionKey, entityName: entityName, id: id},
    function (err, res) {
      if (res  && res.return && res.return.session) {
        this._retry = 0;
        this._sessionKey = res.return.session;
      }
      cb(err, res);
    }.bind(this));
};
Bullhorn.prototype.__findMultiple = function (entityName, ids, cb) {
  this.client.findMultiple({session: this._sessionKey, entityName: entityName, ids: ids},
    function (err, res) {
      if (res  && res.return && res.return.session) {
        this._retry = 0;
        this._sessionKey = res.return.session;
      }
      cb(err, res);
    }.bind(this));
};
Bullhorn.prototype.getPlacement = function (id, cb) {
  this.__find('Placement', id, function (err, result) {
    if (err) {
      console.log('last request', this.client.lastRequest);
    }
    cb(err, result);
  }.bind(this));
};
Bullhorn.prototype.getJob = function (id, cb) {
  this.__find('JobOrder', id, function (err, result) {
    if (err) {
      console.log('last request', this.client.lastRequest);
    }
    cb(err, result);
  }.bind(this));
};
Bullhorn.prototype.getPlacements = function (params, cb) {
  console.log('getPlacements');
  var placements = [];
  var query = _.pick(params, ['alias', 'maxResults', 'orderBys', 'where']);
  query = query || {};
  query.entityName = 'Placement';
  this.__query(query, function (err, result) {
    if (err) {
      console.log('last request', this.client.lastRequest);
      cb(err);
    } else {
      var ids = result.return.ids;
      ids = _.map(ids, function (id) { return parseInt(id.$value);} );
      findMultiple(ids, this, cb);
    }
  }.bind(this));


  function findMultiple(ids, that, cb) {
    var toFetch = ids.splice(0, 20);
    that.__findMultiple('Placement', toFetch, function (err, res) {
      if (err) {
        console.log('last request', that.client.lastRequest);
        return cb(err);
      }
      else {
        placements = placements.concat(res.return.dtos);
        if (ids.length) {
          findMultiple(ids, that, cb);
        }
        else {
          cb(null, placements);
        }
      }

    })
  }


};
module.exports = Bullhorn;