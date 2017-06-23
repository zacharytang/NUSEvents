//going to style this

var express = require("express");
var app = express();
var ejs = require("ejs");
app.set("views", __dirname + "/views");
app.set("view engine", "ejs");
app.use(express.static("public"));
var EventPost = require("./eventPost.js");

app.get("/", function(request, response){
  response.render("home.ejs");
});

app.get("/category/:categoryID", function(request, response){
  var category = request.params.categoryID
  if (category != "all") {
    EventPost.find({category: category}).sort({date: -1}).exec(function(error, data){
      response.render("index.ejs", {
        posts: data,
        category: category,
        capitalizeFirstLetter: capitalizeFirstLetter
      });
    });
  } else {
    EventPost.find().sort({date: -1}).exec(function(error, data){
      response.render("index.ejs", {
        posts: data,
        category: category,
        capitalizeFirstLetter: capitalizeFirstLetter
      });
    });
  }
});

function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

app.get("/post/:id", function(request, response){
  var id = request.params.id;
  EventPost.find({_id: id}).exec(function(error,data) {
    if (error || data.length === 0) {
      response.status(404);
      response.render("404.ejs");
    } else {
      response.render("EventPost.ejs", {
        posts:data[0]
      })
    }
  });
});

app.get("/newPost", function(request, response){
  response.render("postForm.ejs");
});

var bodyParser = require("body-parser");
app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());

app.post("/newPost", function(request, response){
  EventPost.create({
    title: request.body.title,
    content: request.body.content,
    category: request.body.category
  }, function(error, data) {
    response.redirect("/");
  })
});

app.get('/post/:id/delete', function(request, response, next) {
   EventPost.findOneAndRemove({_id: request.params.id}, function(err, postToDelete) {
       if (err) {
         return next(err);
       } else if (!postToDelete) {
         return response.send(404);
         response.render("404.ejs");
       } else {
         response.redirect("/deleted");
       }
   });
});

app.get("/deleted", function(request, response){
  response.render("postDeleted.ejs");
});

app.get('/post/deleteAll', function(request, response) {
  EventPost.remove({}, function(err) {
    if (err) {
      console.log(err);
    } else {
      response.redirect("/");
    }
  });
});

app.listen("3000");
console.log("Listening on port 3000");
