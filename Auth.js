//auth
import jwt from "jsonwebtoken";
//passwords
import bcrypt from "bcrypt";
import { generate } from "generate-password";
//
import User from "./User.js";

export const createDefaultAdmin = async () => {
  var password = generate({
    length: 16,
    numbers: true,
  });

  bcrypt.hash(password, 10, async function (err, hash) {
    if (err) {
      console.log(err);
      return;
    }

    console.log(
      `Admin does not exsist! Creating first user with temporary password: ${password}`
    );

    await User.updateOne(
      { username: "admin" },
      {
        name: "administrator",
        email: "admin@example.org",
        password: hash,
        role: "admin",
      },
      { upsert: true }
    )
      .then((user) => {
        console.log("Created!");
      })
      .catch((error) => {
        console.log(error);
      });
  });
};

const createToken = (payload) =>
  jwt.sign(payload, process.env.SECRET_KEY, {
    expiresIn: "1 day",
  });

export const authenticate = async (req, res) => {
  const { username, password } = req.body;
  let user = await User.findOne({ username: username })
    .select("+password")
    .exec()
    .then((user) => {
      console.log(`User trying to login as: ${username}`);
      bcrypt.compare(password, user.password, function (err, result) {
        if (!result) {
          res.sendStatus(401);
        } else {
          console.log(`Succesfully authenticated as: ${username}`);
          console.log("Sending token!");
          res.status(201).json({
            id: user._id,
            firstName: user.firstName,
            username: user.username,
            role: user.role,
            token: createToken({
              id: user.id,
              username: user.username,
              role: user.role,
            }),
          });
        }
      });
    })
    .catch((error) => {
      res.sendStatus("400");
    });
};
