var express = require("express");
var session = require('express-session');
var hash = require('pbkdf2-password')()
var app = express();

var ejs = require("ejs");
var multer = require("multer");
// file system for node.js
var fs = require("fs");
var EventPost = require("./eventPost.js");
var Users = require("./users.js");

var bodyParser = require("body-parser");
var settings = require("./config/config.js");
var storage = multer.diskStorage({
    destination: function (request, file, cb) {
        cb(null, './public/uploads/');
    },
    filename: function (request, file, cb) {
        var originalname = file.originalname;
        var extension = originalname.split(".");
        filename = Date.now() + '.' + extension[extension.length - 1];
        cb(null, filename);
    }
});

// config
app.set("views", __dirname + "/views");
app.set("view engine", "ejs");

// middleware

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static("public"));
app.use(session({
    resave: false, // don't save session if unmodified
    saveUninitialized: false, // don't create session until something stored
    secret: 'shhhh, very secret'
}));

// Session-persisted message middleware
// I got clue what this is doing
app.use(function (req, res, next) {
    var err = req.session.error;
    var msg = req.session.success;
    delete req.session.error;
    delete req.session.success;
    res.locals.message = '';
    if (err) res.locals.message = '<p class="msg error">' + err + '</p>';
    if (msg) res.locals.message = '<p class="msg success">' + msg + '</p>';
    next();
});

function restrict(req, res, next) {
    if (req.session.user) {
        next();
    } else {
        req.session.error = 'Access denied!';
        res.redirect('/notAuth');
    }
}

// [EXPRESS]
// Route definition is in the following structure
// app.METHOD(PATH, HANDLER)
// Where:
// app is an instance of express
// METHOD is a HTTP request method, in lowercase.
// >> See: https://en.wikipedia.org/wiki/Hypertext_Transfer_Protocol#Request_methods
// HANDLERS IS THE FUNCTION EXECUTED WHEN THE ROUTE IS MATCHED.

// Home Page
app.get("/", function (request, response) {
    sess = request.session;
    if (sess.user) {
        response.render("userhome.ejs", {
            user: sess.user.organiser,
            categories: settings.categories, //settings is related to config.js
            capitalize: capitalize
        });
    } else {
        response.render("home.ejs", {
            user: null,
            categories: settings.categories,
            capitalize: capitalize
        })
    };
});

// Login Screen
app.get('/login', function (request, response) {
    sess = request.session;
    if (sess.user) {
        username = sess.user.organiser;
    } else {
        username = null;
    }
    response.render("login.ejs", {
        user: username,
        categories: settings.categories, //settings is like related to config.js or something.
        capitalize: capitalize
    });
});

app.post('/login', function (req, res) {
    authenticate(req.body.username, req.body.password, function (err, user) {
        if (user) {
            // Regenerate session when signing in
            // to prevent fixation
            req.session.regenerate(function () {
                // Store the user's primary key
                // in the session store to be retrieved,
                // or in this case the entire user object
                req.session.user = user;
                req.session.success = 'Authenticated as ' + user.name
                    + ' click to <a href="/logout">logout</a>. ';
                res.redirect('/');
            });
        } else {
            req.session.error = 'Authentication failed, please check your username or password'
            res.redirect('/login');
        }
    });
});

// Authenticate against database
function authenticate(inputname, pass, fn) {
    if (!module.parent) console.log('authenticating %s:%s', inputname, pass);
    //var user = users[name];
    Users.find({ name: inputname }, function (err, user) {
        if (user.length == 0) {
            return fn(new Error('cannot find user'));
        } else {
            user = user[0];
            usersalt = user.salt;
            userhash = user.hash;
        }
        // apply the same algorithm to the POSTed password, applying
        // the hash against the pass / salt, if there is a match we
        // found the user
        hash({ password: pass, salt: usersalt }, function (err, pass, salt, hash) {
            if (err) return fn(err);
            if (hash == userhash) {
                return fn(null, user);
            }
            fn(new Error('invalid password'));
        });
    });
}

// Logout
app.get('/logout', function (request, response) {
    request.session.destroy(function (err) {
        if (err) {
            console.log(err);
        } else {
            response.redirect('/');
        }
    });
});

// View organisation profile
app.get("/myOrg", restrict, function (request, response) {
    sess = request.session;
    if (sess.user) {
        username = sess.user.organiser;
    } else {
        username = null;
    }
    // Route parameters
    // eg: if /category/All then req.params.categoryID == All
    var organiser = sess.user.organiser;
    // if category is not "all" then find all posts with the Category matching the CategoryID
    // .exec is also mongoose. Zzz
    EventPost.find( { organiser : organiser } ).sort({ date: -1 }).exec(function (error, data) {
        response.render("organisation.ejs", { //response.render is an example of a response method. Renders a view template.
            user: username,
            posts: data,
            orgname: organiser,
            categories: settings.categories,
            capitalize: capitalize
        });
    });
});

// View by organiser
app.get("/orgs/:orgID", function(request, response) {
    var sess = request.session;
    if (sess.user) {
        username = sess.user.organiser;
    } else {
        username = null;
    }
    var orgID = request.params.orgID;
    Users.findById(orgID).exec(function(error, orgname) {
        EventPost.find({organiserID: orgID}).sort({date: -1}).exec(function(error, data){
            response.render("organisation.ejs", {
                user: username,
                posts: data,
                orgname: orgname.organiser,
                categories: settings.categories,
                capitalize: capitalize
            });
        });
    });
});

// View by category
app.get("/category/:categoryID", function (request, response) {
    sess = request.session;
    if (sess.user) {
        username = sess.user.organiser;
    } else {
        username = null;
    }
    // Route parameters
    // eg: if /category/All then req.params.categoryID == All
    var category = request.params.categoryID;
    // if category is not "all" then find all posts with the Category matching the CategoryID
    // .exec is also mongoose. Zzz
    EventPost.find(category != "all" ? { category: category } : {}).sort({ date: -1 }).exec(function (error, data) {
        response.render("index.ejs", { //response.render is an example of a response method. Renders a view template.
            user: username,
            posts: data,
            category: category,
            categories: settings.categories,
            capitalize: capitalize
        });
    });
});

// View posters by category
app.get("/catimageview/:categoryID", function (request, response) {
    sess = request.session;
    if (sess.user) {
        username = sess.user.organiser;
    } else {
        username = null;
    }
    var category = request.params.categoryID
    EventPost.find(category != "all" ? { category: category } : {}).sort({ date: -1 }).exec(function (error, data) {
        response.render("indeximg.ejs", {
            user: username,
            posts: data,
            category: category,
            categories: settings.categories,
            capitalize: capitalize
        });
    });
});

// View individual post
app.get("/post/:id", function (request, response) {
    sess = request.session;
    if (sess.user) {
        username = sess.user.organiser;
        organisation = sess.user.organiser;
    } else {
        username = null;
        organisation = null;
    }
    EventPost.findById(request.params.id, function (error, post) { //is a mongoose method. fml
        if (error || !post) {
            response.status(404);
            response.render("404.ejs", {
                user: username,
                categories: settings.categories,
                capitalize: capitalize
            });
        } else {
            response.render("eventPost.ejs", {
                organiser: organisation,
                user: username,
                categories: settings.categories,
                capitalize: capitalize,
                post: post
            })
        }
    });
});

// Search posts
app.get("/search/:query", function (request, response) {
    sess = request.session;
    if (sess.user) {
        username = sess.user.organiser;
    } else {
        username = null;
    }
    var query = request.params.query;
    EventPost.find({ $text: { $search: query } }).sort({ date: -1 }).exec(function (error, data) {
        response.render("search.ejs", {
            user: username,
            posts: data,
            query: query,
            categories: settings.categories,
            capitalize: capitalize
        });
    });
});

// Sign up form
app.get("/signup", function (request, response) {
    sess = request.session;
    if (sess.user) {
        username = sess.user.organiser;
    } else {
        username = null;
    }
    response.render("signUpForm.ejs", {
        user: username,
        categories: settings.categories,
        capitalize: capitalize
    });
});

// Post a new user to DB
app.post("/signup", multer({ storage: storage }).single('image'), function (request, response) {
    console.log(request.body.password)
    hash({ password: request.body.password }, function (err, pass, salt, hash) {
        if (err) throw err;
        // store the salt & hash in the "db"
        console.log("salt generated " + salt);
        console.log("hash generated " + hash);
        Users.create({
            name: request.body.username,
            organiser: request.body.organisation,
            salt: salt,
            hash: hash,
        }, function (error, data) {
            response.redirect("/signUpSuccess"); // redirects a request.
        });

    });
});

// Sign up success screen
app.get("/signUpSuccess", function (request, response) {
    sess = request.session;
    if (sess.user) {
        username = sess.user.organiser;
    } else {
        username = null;
    }
    response.render("signUpSuccess.ejs", {
        user: username,
        categories: settings.categories,
        capitalize: capitalize
    });
});

// New post form
app.get("/newPost", restrict, function (request, response) {
    sess = request.session;
    if (sess.user) {
        username = sess.user.organiser;
    } else {
        username = null;
    }
    response.render("postForm.ejs", {
        user: username,
        maxChars: settings.maxChars, // To be manually set
        categories: settings.categories,
        capitalize: capitalize
    });
});

// Not Authorized
app.get("/notAuth", function (request, response) {
    sess = request.session;
    if (sess.user) {
        username = sess.user.organiser;
    } else {
        username = null;
    }
    response.render("notAuthorised.ejs", {
        user: username,
        categories: settings.categories,
        capitalize: capitalize
    });
});

// New Event Post
app.post("/newPost", multer({ storage: storage }).single('image'), function (request, response) {
    var hasImage = request.file ? true : false;
    if (hasImage) {
        var image = { //image object
            fieldname: request.file.fieldname,
            originalname: request.file.originalname,
            encoding: request.file.encoding,
            mimetype: request.file.mimetype,
            destination: request.file.destination,
            filename: request.file.filename,
            path: request.file.path,
            size: request.file.size
        };
    };
    EventPost.create({
        title: request.body.title,
        content: request.body.content,
        organiser: request.session.user.organiser, //THIS IS TIED TO USER ORGANISATION
        organiserID: request.session.user._id,
        category: request.body.category,
        externalLink: request.body.externalLink,
        hasImage: hasImage,
        image: hasImage ? image : null,
    }, function (error, data) {
        response.redirect("/"); // redirects a request.
    });
});

// Administrator post form (For Milestone 2 Demo)
app.get("/newPostAdmin", function (request, response) {
    sess = request.session;
    if (sess.user) {
        username = sess.user.organiser;
    } else {
        username = null;
    }
    response.render("postFormAdmin.ejs", {
        user: username,
        maxChars: 500, // To be manually set
        categories: settings.categories,
        capitalize: capitalize
    });
});

app.post("/newPostAdmin", multer({ storage: storage }).single('image'), function (request, response) {
    var hasImage = request.file ? true : false; //request.file is multer method
    if (hasImage) {
        var image = {
            fieldname: request.file.fieldname,
            originalname: request.file.originalname,
            encoding: request.file.encoding,
            mimetype: request.file.mimetype,
            destination: request.file.destination,
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
    }, function (error, data) {
        response.redirect("/");
    });
});

// Deleting a post
app.get('/post/:id/delete', function (request, response) {
    EventPost.findByIdAndRemove(request.params.id, function (error, postToDelete) {
        if (error || !postToDelete) {
            return response.send(404);
            response.render("404.ejs", {
                user: username,
                categories: settings.categories,
                capitalize: capitalize
            });
        } else {
            if (postToDelete.hasImage) {
                fs.unlink("./public/uploads/" + postToDelete.image.filename, function (error) {
                    if (error) throw error;
                });
            }
            response.redirect("/deleted");
        }
    });
});

// Post deleted
app.get("/deleted", function (request, response) {
    sess = request.session;
    if (sess.user) {
        username = sess.user.organiser;
    } else {
        username = null;
    }
    response.render("postDeleted.ejs", {
        user: username,
        categories: settings.categories,
        capitalize: capitalize
    });
});

// For testing purposes
app.get('/deleteAll', function (request, response) {
    EventPost.remove({}, function (err) {
        if (err) {
            console.log(err);
        } else {
            response.redirect("/");
        }
    });
});

// View by category
app.get("/users", function (request, response) {
    sess = request.session;
    if (sess.user) {
        username = sess.user.organiser;
    } else {
        username = null;
    }
    Users.find().exec(function (error, data) {
        response.render("users.ejs", { //response.render is an example of a response method. Renders a view template.
            user: username,
            users: data,
            categories: settings.categories,
            capitalize: capitalize
        });
    });
});

// For testing purposes
app.get('/deleteAllUsers', function (request, response) {
    Users.remove({}, function (err) {
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
