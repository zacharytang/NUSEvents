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

function requireLogin(request, response, next) {
    if (request.session.user) {
        next();
    } else {
        request.session.error = "Access denied!";
        response.redirect("/notauth");
    }
}

function requireLogout(request, response, next) {
    if (!request.session.user) {
        next();
    } else {
        request.session.error = "Access denied!";
        response.redirect("/notauth");
    }
}

function requireAdmin(request, response, next) {
    if (request.session.user.name == "Admin") {
        next();
    } else {
        request.session.error = "Access denied!";
        response.redirect("/notadmin");
    }
}

function capitalize(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
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
    response.render("home.ejs", {
        user: request.session.user ? request.session.user.organiser : null,
        categories: settings.categories,
        capitalize: capitalize
    });
});

// Login Screen
app.get('/login', requireLogout, function (request, response) {
    response.render("login.ejs", {
        user: request.session.user ? request.session.user.organiser : null,
        categories: settings.categories, //settings is like related to config.js or something.
        capitalize: capitalize
    });
});

app.post('/login', function (request, response) {
    authenticate(request.body.username, request.body.password, function (error, user) {
        if (user) {
            // Regenerate session when signing in
            // to prevent fixation
            request.session.regenerate(function () {
                // Store the user's primary key
                // in the session store to be retrieved,
                // or in this case the entire user object
                request.session.user = user;
                request.session.success = 'Authenticated as ' + user.name
                    + ' click to <a href="/logout">logout</a>. ';
                response.redirect('/');
            });
        } else {
            request.session.error = 'Authentication failed, please check your username or password'
            response.redirect('/login');
        }
    });
});

// Authenticate against database
function authenticate(inputname, pass, fn) {
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
app.get('/logout', requireLogin, function (request, response) {
    request.session.destroy(function (err) {
        if (err) {
            console.log(err);
        } else {
            response.redirect('/');
        }
    });
});

// View organisation profile
app.get("/myorg", requireLogin, function (request, response) {
    if (request.session.user.name == "Admin") {
        response.redirect('/admin');
    } else {
        EventPost.find({ organiser: request.session.user.organiser }).sort({ startdate: -1 }).exec(function (error, data) {
            response.render("organisationprofile.ejs", { //response.render is an example of a response method. Renders a view template.
                user: request.session.user ? request.session.user.organiser : null,
                posts: data,
                orgname: request.session.user ? request.session.user.organiser : null,
                categories: settings.categories,
                capitalize: capitalize
            });
        });
    }
});

// View by organiser (Poster View)
app.get("/orgs/:orgID/posters", function (request, response) {
    orgID = request.params.orgID;
    Users.findById(request.params.orgID).exec(function (error, orgname) {
        EventPost.find({ organiser: orgname.organiser }).sort({ startdate: -1 }).exec(function (error, data) {
            response.render("organisationimg.ejs", {
                user: request.session.user ? request.session.user.organiser : null,
                posts: data,
                orgname: orgname.organiser,
                orgID: orgID,
                categories: settings.categories,
                capitalize: capitalize
            });
        });
    });
});

// View by organiser
app.get("/orgs/:orgID", function (request, response) {
    orgID = request.params.orgID;
    Users.findById(request.params.orgID).exec(function (error, orgname) {
        EventPost.find({ organiser: orgname.organiser }).sort({ startdate: -1 }).exec(function (error, data) {
            response.render("organisationcon.ejs", {
                user: request.session.user ? request.session.user.organiser : null,
                posts: data,
                orgname: orgname.organiser,
                orgID: orgID,
                categories: settings.categories,
                capitalize: capitalize
            });
        });
    });
});

// View by category (Poster View)
app.get("/category/:categoryID/posters", function (request, response) {
    var category = request.params.categoryID
    EventPost.find(category != "all" ? { category: category } : {}).sort({ startdate: -1 }).exec(function (error, data) {
        response.render("indeximg.ejs", {
            user: request.session.user ? request.session.user.organiser : null,
            posts: data,
            category: category,
            categories: settings.categories,
            capitalize: capitalize
        });
    });
});

// View by category
app.get("/category/:categoryID", function (request, response) {
    // Route parameters
    // eg: if /category/All then req.params.categoryID == All
    var category = request.params.categoryID;
    // if category is not "all" then find all posts with the Category matching the CategoryID
    // .exec is also mongoose. Zzz
    EventPost.find(category != "all" ? { category: category } : {}).sort({ startdate: -1 }).exec(function (error, data) {
        response.render("indexcon.ejs", { //response.render is an example of a response method. Renders a view template.
            user: request.session.user ? request.session.user.organiser : null,
            posts: data,
            category: category,
            categories: settings.categories,
            capitalize: capitalize
        });
    });
});


// View individual post
app.get("/post/:id", function (request, response) {
    if (request.session.user) {
        var username = request.session.user.organiser;
        var organisation = request.session.user.organiser;
    } else {
        username = organisation = null;
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
                userOrg: organisation,
                user: username,
                categories: settings.categories,
                capitalize: capitalize,
                post: post
            })
        }
    });
});


// Search posts (Poster View)
app.get("/search/:query/posters", function (request, response) {
    var query = request.params.query
    EventPost.find({ $text: { $search: query } }).sort({ startdate: -1 }).exec(function (error, data) {
        response.render("searchimg.ejs", {
            user: request.session.user ? request.session.user.organiser : null,
            posts: data,
            query: query,
            categories: settings.categories,
            capitalize: capitalize
        });
    });
});

// Search posts
app.get("/search/:query", function (request, response) {
    var query = request.params.query;
    EventPost.find({ $text: { $search: query } }).sort({ startdate: -1 }).exec(function (error, data) {
        response.render("searchcon.ejs", {
            user: request.session.user ? request.session.user.organiser : null,
            posts: data,
            query: query,
            categories: settings.categories,
            capitalize: capitalize
        });
    });
});

// Sign up form
app.get("/signup", requireLogout, function (request, response) {
    response.render("signUpForm.ejs", {
        user: null,
        categories: settings.categories,
        capitalize: capitalize
    });
});

// Post a new user to DB
app.post("/signup", multer({ storage: storage }).single('image'), function (request, response) {
    hash({ password: request.body.password }, function (err, pass, salt, hash) {
        if (err) throw err;
        // store the salt & hash in the "db"
        Users.create({
            name: request.body.username,
            organiser: request.body.organisation,
            salt: salt,
            hash: hash,
        }, function (error, data) {
            if (error) {
                request.session.error = "Username is already taken!";
                response.redirect("/signup");
            } else response.redirect("/signupsuccess"); // redirects a request.
        });

    });
});

// Sign up success screen
app.get("/signupsuccess", requireLogout, function (request, response) {
    response.render("signUpSuccess.ejs", {
        user: null,
        categories: settings.categories,
        capitalize: capitalize
    });
});

// New post form
app.get("/newPost", requireLogin, function (request, response) {
    var username = request.session.user ? request.session.user.organiser : null;
    response.render("postForm.ejs", {
        user: username,
        maxChars: settings.maxChars, // To be manually set
        categories: settings.categories,
        capitalize: capitalize
    });
});

// Not Authorized
app.get("/notauth", function (request, response) {
    response.render("notAuthorised.ejs", {
        user: request.session.user ? request.session.user.organiser : null,
        categories: settings.categories,
        capitalize: capitalize
    });
});

// Not Admin
app.get("/notadmin", function (request, response) {
    response.render("notAdmin.ejs", {
        user: request.session.user ? request.session.user.organiser : null,
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
        startdate: request.body.startdate,
        enddate: request.body.enddate,
        category: request.body.category,
        externalLink: request.body.externalLink,
        hasImage: hasImage,
        image: hasImage ? image : null,
    }, function (error, data) {
        response.redirect("/"); // redirects a request.
    });
});

// Deleting a post
app.get('/post/:id/delete', function (request, response) {
    EventPost.findByIdAndRemove(request.params.id, function (error, postToDelete) {
        if (error || !postToDelete) {
            return response.send(404);
            response.render("404.ejs", {
                user: request.session.user ? request.session.user.organiser : null,
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
    var username = request.session.user ? request.session.user.organiser : null;
    response.render("postDeleted.ejs", {
        user: username,
        categories: settings.categories,
        capitalize: capitalize
    });
});

/*
    Admin Stuff
*/

// Deleting a user
app.get('/admin/users/:id/delete', requireLogin, requireAdmin, function (request, response) {
    Users.findByIdAndRemove(request.params.id, function (error, userToDelete) {
        if (error || !userToDelete) {
            return response.send(404);
            response.render("404.ejs", {
                user: request.session.user ? request.session.user.organiser : null,
                categories: settings.categories,
                capitalize: capitalize
            });
        } else {
            response.redirect("/admin/users");
        }
    });
});

// View all users as Admin
app.get("/admin/users", requireLogin, requireAdmin, function (request, response) {
    Users.find().exec(function (error, data) {
        response.render("adminusers.ejs", {
            user: request.session.user ? request.session.user.organiser : null,
            users: data,
            categories: settings.categories,
            capitalize: capitalize
        });
    });
});

// Deleting a post
app.get('/admin/:id/delete', requireLogin, requireAdmin, function (request, response) {
    EventPost.findByIdAndRemove(request.params.id, function (error, postToDelete) {
        if (error || !postToDelete) {
            return response.send(404);
            response.render("404.ejs", {
                user: request.session.user ? request.session.user.organiser : null,
                categories: settings.categories,
                capitalize: capitalize
            });
        } else {
            if (postToDelete.hasImage) {
                fs.unlink("./public/uploads/" + postToDelete.image.filename, function (error) {
                    if (error) throw error;
                });
            }
            response.redirect("/admin");
        }
    });
});

// View all posts as Admin
app.get("/admin", requireLogin, requireAdmin, function (request, response) {
    EventPost.find({}).sort({ startdate: -1 }).exec(function (error, data) {
        response.render("admin.ejs", {
            user: request.session.user ? request.session.user.organiser : null,
            posts: data,
            categories: settings.categories,
            capitalize: capitalize
        });
    });
});

// Delete all posts
app.get('/deleteAll', requireLogin, requireAdmin, function (request, response) {
    EventPost.remove({}, function (err) {
        if (err) {
            console.log(err);
        } else {
            response.redirect("/");
        }
    });
});

// Delete all users
app.get('/deleteAllUsers', requireLogin, requireAdmin, function (request, response) {
    Users.remove({}, function (err) {
        if (err) {
            console.log(err);
        } else {
            response.redirect("/");
        }
    });
});

app.listen("3000");
