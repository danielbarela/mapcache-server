var mongoose = require('mongoose');

// Creates a new Mongoose Schema object
var Schema = mongoose.Schema;

var LoginSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: 'User' }
},{
  versionKey: false
});

var transform = function(login, ret) {
  if ('function' !== typeof login.ownerDocument) {
    ret.timestamp = ret._id.getTimestamp();
    delete ret._id;
  }
};

LoginSchema.set("toJSON", {
  transform: transform
});

exports.transform = transform;

// Creates the Model for the User Schema
var Login;
if (mongoose.models.Login) {
  Login = mongoose.model('Login');
} else {
  Login = mongoose.model('Login', LoginSchema);
}

exports.getLoginsForUser = function(user, options, callback) {
  var conditions = {
    userId: user._id
  };

  var o = {
    limit: 10,
    sort: {
      _id: -1
    }
  };
  if (options.limit) o.limit = options.limit;

  Login.find(conditions, null, o, function (err, logins) {
    if (err) return callback(err);

    callback(err, logins);
  });
};

exports.createLogin = function(user, callback) {
  var create = {
    userId: user._id
  };

  Login.create(create, function(err, login) {
    if (err) return callback(err);

    callback(null, login);
  });
};

exports.removeLoginsForUser = function(user, callback) {
  Login.remove({userId: user._id}, function(err) {
    callback(err);
  });
};
