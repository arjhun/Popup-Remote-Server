import { Schema } from "mongoose";
import mongoose from "mongoose";
import bcrypt from "bcrypt";

export const ROLES = { MOD: "mod", ADMIN: "admin" };
export const ROLES_VALUES = Object.values(ROLES);

const userSchema = new Schema(
  {
    firstName: {
      type: String,
      required: true,
    },
    lastName: {
      type: String,
      required: true,
    },

    email: {
      type: String,
      unique: true,
      required: true,
    },
    username: {
      type: String,
      unique: true,
      required: true,
    },
    password: {
      type: String,
      required: true,
      select: false,
    },
    role: {
      type: String,
      required: true,
      enum: ROLES_VALUES,
    },
    requireChange: { type: Boolean, default: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const User = mongoose.model("users", userSchema);

export const createUser = async (req, res) => {
  // socket.on("addUser", (user, callBack) => {
  //   if (!444as) return;
  //   let options = {
  //     new: true,
  //     upsert: true,
  //   };
  //   if (user._id == null) {
  //     user._id = new mongoose.Types.ObjectId();
  //   }
  //   User.findByIdAndUpdate(user._id, user, options).then((newUser) => {
  //     callBack(true);
  //   });
  // });
};

export const getUsers = async (req, res) => {
  await User.find({})
    .lean()
    .then((data) => {
      res.status(200).json(data);
    });
};

export const getUser = async (req, res) => {
  await User.findById(req.params.id)
    .exec()
    .then((user) => {
      if (user !== null) {
        res.status(200).json(user);
      } else {
        res.sendStatus(404);
      }
    })
    .catch((err) => {
      console.log(err);
      res.sendStatus(500);
    });
};

export const updateUser = async (req, res, next) => {
  const { id } = req.params;

  const update = (({ username, firstName, lastName, email }) => ({
    username,
    firstName,
    lastName,
    email,
  }))(req.body);

  const { password, newPassword } = req.body;

  await User.findById(id)
    .select("+password")
    .exec()
    .then((user) => {
      if (user === null) {
        res.sendStatus(400);
        next();
      }
      if (password && newPassword) {
        bcrypt.compare(oldPassword, user.password, function (err, result) {
          if (!result || err) {
            res.sendStatus(401);
            next();
          }
          bcrypt.hash(newPassword, 10, async function (err, hash) {
            if (!err) {
              update.password = hash;
              user.updateOne(update).then((user) => {
                if (user) res.sendStatus(200);
                else res.sendStatus(500);
              });
            } else {
              res.sendStatus(500);
            }
          });
        });
      } else {
        console.log(user);
        user.updateOne(update).then((user) => {
          if (user !== null) res.sendStatus(200);
          else res.sendStatus(500);
        });
      }
    });
};

export const deleteUser = async (req, res) => {};

export default User;
