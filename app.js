// [EXPRESS] Basic Express
var express = require("express");
var app = express();

/*
:::Example of a basic route:::

var express = require('express')
var app = express()

// respond with "hello world" when a GET request is made to the homepage
app.get('/', function (req, res) {
  res.send('hello world')
})
*/

var ejs = require("ejs");
var multer = require("multer");
// file system for node.js
var fs = require ("fs");
var EventPost = require("./eventPost.js");
var bodyParser = require("body-parser");
var settings = require("./config/config.js");
app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());
app.set("views", __dirname + "/views");
app.set("view engine", "ejs");
app.use(express.static("public"));

var storage = multer.diskStorage({
    destination: function (request, file, cb) {
        cb(null, './public/uploads/');
    },
    filename: function (request, file, cb) {
        var originalname = file.originalname;
        var extension = originalname.split(".");
        filename = Date.now() + '.' + extension[extension.length-1];
        cb(null, filename);
    }
});

// [EXPRESS]
// Route definition is in the following structure
// app.METHOD(PATH, HANDLER)
// Where:
// app is an instance of express
// METHOD is a HTTP request method, in lowercase. 
// >> See: https://en.wikipedia.org/wiki/Hypertext_Transfer_Protocol#Request_methods
// HANDLERS IS THE FUNCTION EXECUTED WHEN THE ROUTE IS MATCHED.

// Home Page
app.get("/", function(request, response){
    response.render("home.ejs", {
        categories: settings.categories, //settings is like related to config.js or something.
        capitalize: capitalize
    });
});

// View by category
app.get("/category/:categoryID", function(request, response){

    // Route parameters 
    // eg: if /category/All then req.params.categoryID == All 
    var category = request.params.categoryID
    // if category is not "all" then find all posts with the Category matching the CategoryID
    // .exec is also mongoose. Zzz
    EventPost.find(category != "all" ? {category: category} : {} ).sort({date: -1}).exec(function(error, data){
        response.render("index.ejs", { //response.render is an example of a response method. Renders a view template.
            posts: data,
            category: category,
            categories: settings.categories,
            capitalize: capitalize
        });
    });
});

// View posters by category
app.get("/catimageview/:categoryID", function(request, response){
    var category = request.params.categoryID
    EventPost.find(category != "all" ? {category: category} : {}).sort({date: -1}).exec(function(error, data){
        response.render("indeximg.ejs", {
            posts: data,
            category: category,
            categories: settings.categories,
            capitalize: capitalize
        });
    });
});

// View individual post
app.get("/post/:id", function(request, response) {
    EventPost.findById(request.params.id, function(error, post) { //is a mongoose method. fml
        if (error || !post) {
            response.status(404);
            response.render("404.ejs");
        } else {
            response.render("eventPost.ejs", {
                categories: settings.categories,
                capitalize: capitalize,
                post: post
            })
        }
    });
});

// New post form
app.get("/newPost", function(request, response){
    response.render("postForm.ejs", {
        maxChars: settings.maxChars, // To be manually set
        categories: settings.categories,
        capitalize: capitalize
    });
});

app.post("/newPost", multer({storage: storage}).single('image'), function(request, response){
    var hasImage = request.file ? true : false;
    if (hasImage) {
        var image = { //image object
            fieldname: request.file.fieldname,
            originalname: request.file.originalname,
            encoding: request.file.encoding,
            mimetype: request.file.mimetype,
            destination:request.file.destination,
            filename: request.file.filename,
            path: request.file.path,
            size: request.file.size
        };
    };
    EventPost.create({
        title: request.body.title,
        content: request.body.content,
        category: request.body.category,
        externalLink: request.body.externalLink,
        hasImage: hasImage,
        image: hasImage ? image : null,
    }, function(error, data) {
        response.redirect("/"); // redirects a request.
    });
});

// Administrator post form (For Milestone 2 Demo)
app.get("/newPostAdmin", function(request, response){
    response.render("postFormAdmin.ejs", {
        maxChars: 500 // To be manually set
    });
});

app.post("/newPostAdmin", multer({storage: storage}).single('image'), function(request, response){
    var hasImage = request.file ? true : false; //request.file is multer method
    if (hasImage) {
        var image = {
            fieldname: request.file.fieldname,
            originalname: request.file.originalname,
            encoding: request.file.encoding,
            mimetype: request.file.mimetype,
            destination:request.file.destination,
            filename: request.file.filename,
            path: request.file.path,
            size: request.file.size
        };
    };
    EventPost.create({
        title: request.body.title,
        organiser: request.body.organiser,
        content: request.body.content,
        category: request.body.category,
        externalLink: request.body.externalLink,
        hasImage: hasImage,
        image: hasImage ? image : null,
    }, function(error, data) {
        response.redirect("/");
    });
});

// Deleting a post
app.get('/post/:id/delete', function(request, response) {
    EventPost.findByIdAndRemove(request.params.id, function(error, postToDelete) {
        if (error || !postToDelete) {
            return response.send(404);
            response.render("404.ejs");
        } else {
            if (postToDelete.hasImage) {
                fs.unlink("./public/uploads/" + postToDelete.image.filename, function(error) {
                    if (error) throw error;
                });
            }
            response.redirect("/deleted");
        }
    });
});

// Post deleted
app.get("/deleted", function(request, response){
    response.render("postDeleted.ejs", {
        categories: settings.categories,
        capitalize: capitalize
    });
});

// For testing purposes
app.get('/deleteAll', function(request, response) {
    EventPost.remove({}, function(err) {
        if (err) {
            console.log(err);
        } else {
            response.redirect("/");
        }
    });
});

function capitalize(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

app.listen("3000");
