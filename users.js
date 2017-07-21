var mongoose = require("mongoose");
var uniqueValidator = require("mongoose-unique-validator");
mongoose.connect("mongodb://spaghetti:codecode@ds034807.mlab.com:34807/nus-events");

var schema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        uniqueCaseInsensitive: true
    },
    organiser: {
        type: String,
        default: "None"
    },
    salt: String,
    hash: String
});

schema.plugin(uniqueValidator);
module.exports = mongoose.model("Users", schema);
