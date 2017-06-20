var mongoose = require("mongoose");
mongoose.connect("mongodb://localhost:4000/myDatabase");

var schema = new mongoose.Schema({
  title: String,
  content: String,
  date: {
    type: Date,
    default: Date.now
  },
  category: String
});

module.exports = mongoose.model("BlogPost", schema);
