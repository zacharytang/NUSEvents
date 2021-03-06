var express = require("express");
var session = require("express-session");
var hash = require("pbkdf2-password")();
var app = express();
var bodyParser = require("body-parser");
var ejs = require("ejs");

// Schemas and file imports
var EventPost = require("./js/eventPost.js");
var Users = require("./js/users.js");
var settings = require("./config/config.js");

var multer = require("multer");
var multerS3 = require("multer-s3");
var aws = require("aws-sdk");
s3 = new aws.S3();
var storage = multer({
    storage: multerS3({
        s3: s3,
        bucket: "nusevents",
        acl: "public-read",
        contentType: multerS3.AUTO_CONTENT_TYPE,
        metadata: function(request, file, cb) {
            cb(null, {fieldname: file.fieldname});
        },
        key: function(request, file, cb) {
            var originalname = file.originalname;
            var extension = originalname.split(".");
            filename = Date.now() + "." + extension[extension.length - 1];
            cb(null, filename);
        },
    })
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
    secret: "shhhh, very secret"
}));

// Session-persisted message middleware
// I got clue what this is doing
app.use(function (req, res, next) {
    var err = req.session.error;
    var msg = req.session.success;
    delete req.session.error;
    delete req.session.success;
    res.locals.message = "";
    if (err) res.locals.message = '<p class="msg error">' + err + '</p>';
    if (msg) res.locals.message = '<p class="msg success">' + msg + '</p>';
    next();
});

function requireLogin(request, response, next) {
    if (request.session.user) {
        next();
    } else {
        request.session.error = "Access denied: You need to log in!";
        response.redirect("/error");
    }
}

function requireLogout(request, response, next) {
    if (!request.session.user) {
        next();
    } else {
        request.session.error = "You can't go there!";
        response.redirect("/error");
    }
}

function requireAdmin(request, response, next) {
    if (request.session.user && request.session.user.name === "Admin") {
        next();
    } else {
        request.session.error = "Access denied: Not admin!";
        response.redirect("/error");
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

// General error page
app.get("/error", function (request, response) {
    response.render("error.ejs", {
        user: request.session.user ? request.session.user.organiser : null,
        categories: settings.categories,
        capitalize: capitalize
    });
});

// Login Screen
app.get("/login", requireLogout, function (request, response) {
    response.render("login.ejs", {
        user: request.session.user ? request.session.user.organiser : null,
        categories: settings.categories, //settings is like related to config.js or something.
        capitalize: capitalize
    });
});

app.post("/login", function (request, response) {
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
                response.redirect("/");
            });
        } else {
            request.session.error = 'Authentication failed, please check your username or password'
            response.redirect("/login");
        }
    });
});

// Authenticate against database
function authenticate(inputname, pass, fn) {
    //var user = users[name];
    Users.findOne({ name: inputname }, function (err, user) {
        if (!user) {
            return fn(new Error("cannot find user"));
        } else {
            usersalt = user.salt;
            userhash = user.hash;
        }
        // apply the same algorithm to the POSTed password, applying
        // the hash against the pass / salt, if there is a match we
        // found the user
        hash({ password: pass, salt: usersalt }, function (err, pass, salt, hash) {
            if (err) return fn(err);
            if (hash === userhash) {
                return fn(null, user);
            }
            fn(new Error("invalid password"));
        });
    });
}

// Logout
app.get("/logout", requireLogin, function (request, response) {
    request.session.destroy(function (err) {
        if (err) {
            console.log(err);
        } else {
            response.redirect("/");
        }
    });
});

// View organisation profile
app.get("/myorg", requireLogin, function (request, response) {
    if (request.session.user.name === "Admin") {
        response.redirect("/admin");
    } else {
        EventPost.find({ organiser: request.session.user.organiser })
        .sort({ startdate: 1 })
        .exec(function (error, data) {
            response.render("organisationprofile.ejs", {
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
    Users.findById(request.params.orgID).exec(function (error, orgname) {
        if (error || !orgname) {
            request.session.error = "Error 404: Cannot find organisation!";
            response.redirect("/error");
        } else {
            EventPost.find({ organiser: orgname.organiser })
            .sort({ startdate: 1 })
            .exec(function (error, data) {
                response.render("organisationimg.ejs", {
                    user: request.session.user ? request.session.user.organiser : null,
                    posts: data,
                    orgname: orgname.organiser,
                    orgID: request.params.orgID,
                    categories: settings.categories,
                    capitalize: capitalize
                });
            });
        }
    });
});

// View by organiser
app.get("/orgs/:orgID", function (request, response) {
    Users.findById(request.params.orgID).exec(function (error, orgname) {
        if (error || !orgname) {
            request.session.error = "Error 404: Cannot find organisation!";
            response.redirect("/error");
        } else {
            EventPost.find({ organiser: orgname.organiser })
            .sort({ startdate: 1 })
            .exec(function (error, data) {
                response.render("organisationimg.ejs", {
                    user: request.session.user ? request.session.user.organiser : null,
                    posts: data,
                    orgname: orgname.organiser,
                    orgID: request.params.orgID,
                    categories: settings.categories,
                    capitalize: capitalize
                });
            });
        }
    });
});

// View by category (Poster View)
app.get("/category/:categoryID/posters", function (request, response) {
    var category = request.params.categoryID
    EventPost.find(category != "all" ? { category: category } : {})
    .sort({ startdate: 1 })
    .exec(function (error, data) {
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
    var category = request.params.categoryID;
    EventPost.find(category != "all" ? { category: category } : {})
    .sort({ startdate: 1 })
    .exec(function (error, data) {
        response.render("indexcon.ejs", {
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
    EventPost.findById(request.params.id, function (error, post) { //is a mongoose method. fml
        if (error || !post) {
            request.session.error = "Error 404: Cannot find post!";
            response.redirect("/error");
        } else {
            response.render("eventPost.ejs", {
                userOrg:  request.session.user ? request.session.user.organiser : null,
                user:  request.session.user ? request.session.user.organiser : null,
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
    EventPost.find({ $text: { $search: query } })
    .sort({ startdate: 1 })
    .exec(function (error, data) {
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
    EventPost.find({ $text: { $search: query } })
    .sort({ startdate: 1 })
    .exec(function (error, data) {
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
app.post("/signup", storage.single("image"), function (request, response) {
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

// New Event Post
app.post("/newPost", storage.single("image"), function (request, response) {
    EventPost.create({
        title: request.body.title,
        content: request.body.content,
        organiser: request.session.user.organiser, //THIS IS TIED TO USER ORGANISATION
        organiserID: request.session.user._id,
        startdate: request.body.startdate,
        enddate: request.body.enddate,
        category: request.body.category,
        externalLink: request.body.externalLink,
        hasImage: request.file,
        imageName: request.file ? request.file.key : null,
        imageLink: request.file ? request.file.location : null
    }, function (error, data) {
        response.redirect("/category/all"); // redirects a request.
    });
});

// Deleting a post
app.get("/post/:id/delete", requireLogin, function (request, response) {
    EventPost.findById(request.params.id, function(error, postToDelete) {
        if (error || !postToDelete) {
            request.session.error = "Error 404: Cannot find post!";
            response.redirect("/error");
        } else if (request.session.user.organiser !== postToDelete.organiser) {
            request.session.error = "Access denied: You can't delete this post!";
            response.redirect("/error");
        } else {
            EventPost.findByIdAndRemove(request.params.id, function (error, postToDelete) {
                if (postToDelete.hasImage) {
                    s3.headObject({Bucket: "nusevents", Key: postToDelete.imageName}, function(error, data) {
                        if (!error) {
                            s3.deleteObject({Bucket: "nusevents", Key: postToDelete.imageName}, function(error, data) {
                                if (error) console.log(error, error.stack);
                            });
                        }
                    });
                }
                response.redirect("/deleted");
            });
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
app.get("/admin/users/:id/delete", requireAdmin, function (request, response) {
    Users.findByIdAndRemove(request.params.id, function (error, userToDelete) {
        if (error || !userToDelete) {
            request.session.error = "Error 404: Cannot find user!";
            response.redirect("/error");
        } else {
            response.redirect("/admin/users");
        }
    });
});

// View all users as Admin
app.get("/admin/users", requireAdmin, function (request, response) {
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
app.get("/admin/:id/delete", requireAdmin, function (request, response) {
    EventPost.findByIdAndRemove(request.params.id, function (error, postToDelete) {
        if (error || !postToDelete) {
            request.session.error = "Error 404: Cannot find post!";
            response.redirect("/error");
        } else {
            if (postToDelete.hasImage) {
                s3.headObject({Bucket: "nusevents", Key: postToDelete.imageName}, function(error, data) {
                    if (!error) {
                        s3.deleteObject({Bucket: "nusevents", Key: postToDelete.imageName}, function(error, data) {
                            if (error) console.log(error, error.stack);
                        });
                    }
                });
            }
            response.redirect("/deleted");
        }
    });
});

// View all posts as Admin
app.get("/admin", requireAdmin, function (request, response) {
    EventPost.find({}).sort({ startdate: 1 }).exec(function (error, data) {
        response.render("admin.ejs", {
            user: request.session.user ? request.session.user.organiser : null,
            posts: data,
            categories: settings.categories,
            capitalize: capitalize
        });
    });
});

app.listen(process.env.PORT || "3000");
