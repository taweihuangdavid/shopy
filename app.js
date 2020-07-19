const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const session = require("express-session");
const MongoDBStore = require("connect-mongodb-session")(session);
const csrf = require("csurf");
const flash = require("connect-flash");
const multer = require("multer");
const path = require("path");
const config = require("config");

const errorController = require("./controllers/error");
const User = require("./models/user");
const adminRoutes = require("./routes/admin");
const shopRoutes = require("./routes/shop");
const authRoutes = require("./routes/auth");

const db = config.get("db");
const MONGODB_URI = db;

const app = express();
const store = new MongoDBStore({
  uri: MONGODB_URI,
  collection: "sessions",
});

const fileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "images"); //should create the folder in advance
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname); //could not use "new Date().toISOString()"
  },
});

const fileFilter = (req, file, cb) => {
  if (
    file.mimetype === "image/png" ||
    file.mimetype === "image/jpg" ||
    file.mimetype === "image/jpeg"
  ) {
    cb(null, true);
  } else {
    cb(null, false);
  }
};

app.set("view engine", "ejs");
app.set("views", "views");

app.use(bodyParser.urlencoded({ extended: false })); //for parsing content-type of x-www-urlencoded
app.use(
  multer({
    storage: fileStorage,
    fileFilter: fileFilter,
  }).single("image") //"image" here is corresponding to the "name" attribute of the html file form
);
app.use(express.static(path.join(__dirname, "public"))); // serve static files -> domain/css/cart.css
app.use("/images", express.static(path.join(__dirname, "images"))); // domain/images/filename

app.use(
  session({
    secret: "my secret", // for signing and verifying the session Id cookie
    resave: false,
    saveUninitialized: false,
    store: store,
  })
);
// the package set, send and verify the session Id cookie behind the scene for us.
// when user get into any page of this website's domain
// -> will always have a session cookie in their browser and have the corresponding session in BE DB

const csrfProtection = csrf();
app.use(csrfProtection); //will validate the csrfToken if the requests mutated the states (except GET)
app.use(flash()); //store the flash messages inside the session

app.use((req, res, next) => {
  res.locals.isAuthenticated = req.session.isLoggedIn; // set local variables in views
  res.locals.csrfToken = req.csrfToken();
  //csrfSecret will be stored in the session to verify the csrf token
  //every incoming request has its own unique csrfToken
  next();
});

app.use((req, res, next) => {
  if (!req.session.user) {
    return next();
  }
  User.findById(req.session.user._id)
    .then((user) => {
      if (!user) {
        return next();
      }
      req.user = user;
      next();
    })
    .catch((err) => {
      next(new Error(err));
    });
}); // Check if the user is already logged in (has not log out), and fetch their user data to them

app.use("/admin", adminRoutes);
app.use(shopRoutes);
app.use(authRoutes);
app.get("/500", errorController.get500);
app.use(errorController.get404);
//if the entered route does not match above (the domain name entered is correct)
//-> will fall into 404 page

app.use((error, req, res, next) => {
  // res.status(error.httpStatusCode).render(...);
  res.redirect("/500");
  // res.status(500).render("500", {
  //   pageTitle: "Error!",
  //   path: "/500",
  //   isAuthenticated: req.session.isLoggedIn,
  // });
});
//express error handler -> all the express route errors that are thrown will be fallen into this handler

mongoose
  .connect(MONGODB_URI, {
    useUnifiedTopology: true,
    useNewUrlParser: true,
    useCreateIndex: true,
  })
  .then((result) => {
    app.listen(process.env.PORT || 3000);
    console.log("server starts");
  })
  .catch((err) => {
    console.log(err);
  });
