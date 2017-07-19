var mongoose = require("mongoose");
mongoose.connect("mongodb://spaghetti:codecode@ds034807.mlab.com:34807/nus-events");

var schema = new mongoose.Schema({
    name: String,
    organiser: {
        type: String,
        default: "None"
    },
    password: String,
    salt: String,
    hash: String
});

module.exports = mongoose.model("Users", schema);
