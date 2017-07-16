var mongoose = require("mongoose");
mongoose.connect("mongodb://localhost:4000/myDatabase");

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
