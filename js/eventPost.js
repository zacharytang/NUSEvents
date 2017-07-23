var mongoose = require("mongoose");
mongoose.connect("mongodb://spaghetti:codecode@ds034807.mlab.com:34807/nus-events");

var schema = new mongoose.Schema({
    title: String,
    content: String,
    organiser: {
        type: String,
        default: "None"
    },
    organiserID: String,
    date: {
        type: Date,
        default: Date.now
    },
    startdate: String,
    enddate: String,
    category: String,
    externalLink: String,
    hasImage: Boolean,
    imageName: String,
    imageLink: String
});

schema.index({title: "text", content: "text", "organiser.type": "text"})
module.exports = mongoose.model("EventPost", schema);
