var mongoose = require("mongoose");
mongoose.connect("mongodb://localhost:4000/myDatabase");

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
  category: String
});

module.exports = mongoose.model("BlogPost", schema);
