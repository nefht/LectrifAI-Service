const express = require("express");
const cors = require("cors");
const db = require("./config/db");
const route = require("./routes");
const errorHandler = require("./app/middleware/errorHandlingMiddleware");

const app = express();
const port = process.env.PORT || 3000;


// Connect to DB
db.connect();

// Global middlewares (Application-level)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// Routes init
route(app);

// Error handling middleware
app.use(errorHandler);

app.listen(port, function () {
  console.log("App listening on port: " + port);
});
