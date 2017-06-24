var express = require("express");
var app = express();
var ejs = require("ejs");
var multer = require("multer");
var fs = require ("fs");
var EventPost = require("./eventPost.js");
var bodyParser = require("body-parser");
app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json());
app.set("views", __dirname + "/views");
app.set("view engine", "ejs");
app.use(express.static("public"));

var storage = multer.diskStorage({
    destination: function (request, file, cb) {
        cb(null, './uploads/');
    },
    filename: function (request, file, cb) {
        var originalname = file.originalname;
        var extension = originalname.split(".");
        filename = Date.now() + '.' + extension[extension.length-1];
        cb(null, filename);
    }
});

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

// View posters by category
app.get("/catimageview/:categoryID", function(request, response){
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
    response.render("postForm.ejs", {
        maxChars: 500 // To be manually set
    });
});

app.post("/newPost", multer({storage: storage}).single('image'), function(request, response){
    var hasImage = request.file ? true : false;
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
app.get('/post/:id/delete', function(request, response, next) {
    var id = request.params.id;
    EventPost.find({_id: id}).exec(function(error,data) {
        if (error || data.length === 0) {
            return response.send(404);
            response.render("404.ejs");
        } else if (data[0].hasImage) {
            fs.unlink("./uploads/" + data[0].image.filename, function(error) {
                if (error) throw error;
            });
        }
    });
    EventPost.findOneAndRemove({_id: id}, function(error, postToDelete) {
        if (error || !postToDelete) {
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

app.get('/deleteAll', function(request, response) {
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
