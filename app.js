var express = require("express");
var app = express();
var ejs = require("ejs");
var EventPost = require("./eventPost.js");
var bodyParser = require("body-parser");
app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());
app.set("views", __dirname + "/views");
app.set("view engine", "ejs");
app.use(express.static("public"));

// Home Page
app.get("/", function(request, response){
    response.render("home.ejs");
});

// View by category
app.get("/category/:categoryID", function(request, response){
    var category = request.params.categoryID
    EventPost.find(category != "all" ? {category: category} : {}).sort({date: -1}).exec(function(error, data){
        response.render("index.ejs", {
            posts: data,
            category: category,
            capitalizeFirstLetter: capitalizeFirstLetter
        });
    });
});

// View individual post
app.get("/post/:id", function(request, response){
    var id = request.params.id;
    EventPost.find({_id: id}).exec(function(error,data) {
        if (error || data.length === 0) {
            response.status(404);
            response.render("404.ejs");
        } else {
            response.render("eventPost.ejs", {
                posts:data[0]
            })
        }
    });
});

// New post form
app.get("/newPost", function(request, response){
    response.render("postForm.ejs");
});

app.post("/newPost", function(request, response){
    EventPost.create({
        title: request.body.title,
        content: request.body.content,
        category: request.body.category,
        externalLink: request.body.externalLink,
    }, function(error, data) {
        response.redirect("/");
    })
});

// Deleting a post
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

// Post deleted
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

function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

app.listen("3000");
