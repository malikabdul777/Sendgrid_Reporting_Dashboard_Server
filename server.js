const mongoose = require("mongoose");
const dotenv = require("dotenv");

dotenv.config({ path: "./config.env" });

const app = require("./index");

mongoose
  .connect(
    `${process.env.DATABASE.replace(
      "<PASSWORD>",
      process.env.DATABASE_PASSWORD
    )}`
  )
  .then(() => {
    console.log("Connected to DB!");
  })
  .catch(() => {
    console.log("Connection Failed!");
  });

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Server started on port ${port}!`);
});
