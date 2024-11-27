import { Schema } from "mongoose";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import emailer from "../emailer.js";

export const ROLES = { MOD: "mod", ADMIN: "admin" };
export const ROLES_VALUES = Object.values(ROLES);

const userSchema = new Schema(
  {
    firstName: {
      type: String,
    },
    lastName: {
      type: String,
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
      required: true,
      type: String,
      select: false,
    },
    role: {
      type: String,
      required: true,
      enum: ROLES_VALUES,
      default: ROLES.MOD,
    },
    authInfo: {
      failedLogins: { type: Number, default: 0 },
      lastLoggin: Date,
      requireChange: { type: Boolean, default: true },
      isVerified: { type: Boolean, default: false },
    },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

const User = mongoose.model("users", userSchema);

export const createUser = async (req, res) => {
  User.create(req.body)
    .then((newUser) => {
      res.status(201).json(newUser);
      emailer.sendEmailVerifyMail(
        newUser.email,
        newUser.firstName || newUser.username,
        "this_is_a_link"
      );
    })
    .catch((err) => {
      console.log(err.code);
      if (err.code == 11000) return res.status(409).json(err.keyValue);
    });
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

export const updateUser = async (req, res) => {
  const id = req.params.id;

  const password = req.body.password;
  if (!password) delete req.body.password;
  else req.body.password = await bcrypt.hash(password, 10);

  await User.findByIdAndUpdate(id, req.body, { returnDocument: "after" })
    .select("+password")
    .exec()
    .then((newUser) => {
      let newUserJson = newUser.toJSON();
      delete newUserJson.password;
      res.status(200).json(newUserJson);
    })
    .catch((err) => {
      if (err.code === 11000) {
        return res.status(409).json(duplicateErrorObj(err));
      }
      console.error(err);
      return res.sendStatus(500);
    });
};

export const deleteUser = async (req, res) => {};

export const activateUser = async (req, res) => {
  User.findByIdAndUpdate(req.params.id, { active: req.body.active })
    .exec()
    .then((user) => {
      if (user) {
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

export const changeRole = async (req, res) => {
  const id = req.params.id;
  const newRole = req.body.role;
  User.findByIdAndUpdate(id, { role: newRole })
    .exec()
    .then((user) => {
      if (user) {
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

const duplicateErrorObj = (err) => {
  return {
    error: {
      code: 409,
      message: "Values already exist!",
      errors: [
        {
          locationType: "body",
          reason: "duplicate",
          location: Object.keys(err.keyValue)[0],
          message: `Value ${Object.values(err.keyValue)[0]} already exists`,
        },
      ],
    },
  };
};

export default User;
