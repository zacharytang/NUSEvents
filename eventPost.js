var mongoose = require("mongoose");
mongoose.connect("mongodb://spaghetti:codecode@ds034807.mlab.com:34807/nus-events");

var schema = new mongoose.Schema({
    title: String,
    content: String,
    organiser: {
        type: String,
        default: "None"
    },
    date: {
        type: Date,
        default: Date.now
    },
    category: String,
    externalLink: String,
    hasImage: Boolean,
    image: {
        fieldname: String,
        originalname: String,
        encoding: String,
        mimeptype: String,
        destination: String,
        filename: String,
        path: String,
        size: Number,
        uploaded_at: Date
    }
});

schema.index({title: "text", content: "text", "organiser.type": "text"})
module.exports = mongoose.model("EventPost", schema);
