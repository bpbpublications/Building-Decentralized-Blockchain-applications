const express = require("express");
const bodyParser = require("body-parser");
const redis = require("redis");
const session = require("express-session");
const redisStore = require("connect-redis")(session);
const cookieParser = require("cookie-parser");
const app = express();
const client = redis.createClient();
const router = express.Router();
const db = require("./db");
const path = require("path");

app.use(express.static(__dirname + "/views/"));
app.use(express.static(__dirname + "/views/js"));
app.use(express.static(__dirname + "/views/css"));

// session middleware
app.use(
  session({
    secret: "4hKRFhSFBWHaZT3zwDFE",
    store: new redisStore({
      host: "localhost",
      port: 6379,
      client: client,
      ttl: 10000,
    }),
    saveUninitialized: false,
    resave: false,
  })
);

// include cookies for session
app.use(cookieParser("secretSign#143_!223"));

// add the middleware
app.use(bodyParser.json());

// routers

/**
 * Home page route
 */
app.get("/", (req, res) => {
  res.sendFile("home.html", { root: __dirname + "/views" });
});

app.get("/login", (req, res) => {
  res.sendFile("newlogin.html", { root: __dirname + "/views" });
});

app.get("/register", (req, res) => {
  res.sendFile("newregister.html", { root: __dirname + "/views" });
});

app.get("/mailbox", (req, res) => {
  res.sendFile("mailbox.html", { root: __dirname + "/views" });
});

app.get("/dashboard", (req, res) => {
  res.sendFile("dashboard.html", { root: __dirname + "/views" });
});

/**
 * Sign up, add new user
 */

router.post("/user", async (req, res) => {
  // add new user
  let data = req.body;
  //check if user already exists
  let existance = await db.checkUserEmail(data);
  if (existance.error) {
    res.json({ error: true, message: "User already exists." });
  } else {
    // verify the payload
    let response = await db.addUser(data);
    if (response.error) {
      return res.json({ error: true, message: "Error adding user." });
    }
    // set session
    req.session.key = {
      userId: response.data["_id"],
      email: response.data.email,
      publicKey: response.data.publicKey,
    };
    res.json({ error: false, message: "User added.", hash: response.hash });
  }
});

/**
 * Login to the system
 */

router.post("/login", async (req, res) => {
  let data = req.body;
  let response = await db.login(data);
  if (response.error) {
    return res.json({ error: true, message: "Invalid user" });
  }
  // add session info here
  // set session
  req.session.key = {
    userId: response.data.userId,
    email: response.data.email,
    publicKey: response.data.publicKey,
  };
  res.json({
    error: false,
    message: "User logged in.",
    email: req.session.key.email,
  });
});

/**
 * Get user contacts
 */

router.get("/user/contacts", async (req, res) => {
  // check session and based on user id and email
  // extract the contacts
  if (req.session.key) {
    let data = req.session.key; // get the id from session
    let response = await db.getUserContacts(data);
    if (response.error) {
      return res.json({ error: true, message: "failure" });
    }
    res.json({ error: false, message: "success", data: response.data });
  } else {
    return res.json({ error: true, message: "Invalid session" });
  }
});

/**
 * Create new contact
 */

router.post("/user/contacts", async (req, res) => {
  // create a contact request
  if (req.session.key) {
    let data = req.session.key;
    if (req.body.contactEmail === data.email) {
      // user trying to add himself as contact
      return res.json({
        error: true,
        message: "You can't add yourself as contact",
      });
    }
    // add contact email information
    data.contactEmail = req.body.contactEmail;
    let response = await db.addUserContact(data);
    if (response.error) {
      return res.json({ error: true, message: "failure" });
    }
    res.json({ error: false, message: "success" });
  } else {
    return res.json({ error: true, message: "Invalid session" });
  }
});

/**
 * Get user contacts requests
 */

router.get("/user/contacts/request", async (req, res) => {
  // check session and based on user id and email
  // extract the contacts
  if (req.session.key) {
    let data = req.session.key; // get the id from session
    let response = await db.getUserContactsRequest(data);
    if (response.error) {
      return res.json({ error: true, message: "failure" });
    }
    res.json({ error: false, message: "success", data: response.data });
  } else {
    return res.json({ error: true, message: "Invalid session" });
  }
});

/**
 * approve/reject the user contact request
 */

router.post("/user/contacts/action", async (req, res) => {
  // get the action such as approve or reject
  // get contact email
  // get user email from the session
  if (req.session.key) {
    let data = req.body;
    let response = await db.userContactAction(data);
    if (response.error) {
      return res.json({ error: true, message: "failure" });
    }
    res.json({ error: false, message: "success" });
  } else {
    return res.json({ error: true, message: "Invalid session" });
  }
});

/**
 * Send email
 */

router.post("/email", async (req, res) => {
  // get the user id from session
  // grab user credentials
  // check if the unlock key is correct
  // decrypt private key
  // create email instace in the database
  if (req.session.key) {
    let data = {};
    data.from = req.session.key.email;
    data.to = req.body.to;
    data.subject = req.body.subject || "(No Subject)";
    data.email = req.body.email;
    // add from address
    let response = await db.sendEmail(data);
    if (response.error) {
      return res.json({ error: true, message: response.message || "Failure" });
    }
    res.json({ error: false, message: "success" });
  } else {
    return res.json({ error: true, message: "Invalid session" });
  }
});

/**
 * Get the emails of user
 */

router.get("/email", async (req, res) => {
  // get the user id from session
  // get all emails of that user
  if (req.session.key) {
    let response = await db.getUserEmail(req.session.key);
    if (response.error) {
      return res.json({ error: true, message: "failure", data: response.data });
    }
    res.json({ error: false, message: "success", data: response.data });
  } else {
    return res.json({ error: true, message: "Invalid session" });
  }
});

/**
 * Get the emails sent by the user
 */

router.get("/email/sent", async (req, res) => {
  // get the user id from session
  // get all emails of that user
  if (req.session.key) {
    let response = await db.getUserSentEmail(req.session.key);
    if (response.error) {
      return res.json({ error: true, message: "failure", data: response.data });
    }
    res.json({ error: false, message: "success", data: response.data });
  } else {
    return res.json({ error: true, message: "Invalid session" });
  }
});

/**
 * Open specific email
 */

router.get("/email/:source/:id", async (req, res) => {
  if (req.session.key) {
    let data = {
      id: req.params.id,
      email: req.session.key.email,
      source: req.params.source || "inbox",
    };
    let response = await db.readEmail(data);
    if (response.error) {
      return res.json({ error: true, message: "failure", data: response.data });
    }
    res.json({ error: false, message: "success", data: response.data });
  } else {
    return res.json({ error: true, message: "Invalid session" });
  }
});

/**
 * Logout the user
 */

app.get("/logout", (req, res) => {
  if (req.session.key) {
    req.session.destroy();
    res.redirect("/");
  } else {
    res.redirect("/");
  }
});

app.use("/api", router);

app.listen(process.env.PORT || 3000);
console.log("Listening on " + (process.env.PORT || 3000) + " port");
