import express from "express";
import { Server } from "socket.io";
import mongoose, { Schema } from "mongoose";
import * as dotenv from "dotenv";
//middleware
import ExpressBrute from "express-brute";
import { validateRequest } from "zod-express-middleware";
import { z } from "zod";
import cors from "cors";
//auth
import jwt from "jsonwebtoken";
//passwords
import bcrypt from "bcrypt";
import { generate } from "generate-password";
import { createServer } from "http";

dotenv.config();

const app = express();
const server = createServer(app);

const questionSchema = new Schema({
  content: String,
  order: Number,
  fav: Boolean,
});

const Question = mongoose.model("questions", questionSchema);

const sessionSchema = new Schema(
  { title: String, questions: [questionSchema] },
  { timestamps: true }
);
const Session = mongoose.model("sessions", sessionSchema);

const userSchema = new Schema(
  {
    username: {
      type: String,
      unique: true,
      required: true,
    },
    password: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      required: true,
      enum: ["mod", "admin"],
      firstloggin: { type: Boolean, default: true },
    },
  },
  { timestamps: true }
);

const User = mongoose.model("users", userSchema);

main().catch((err) => console.log(err));

async function main() {
  let showing = null;
  const connectString =
    process.env.CONN_STR || "mongodb://127.0.0.1:27017/questions";
  const corsString = process.env.CORS_STR || "http://localhost:3000";
  //connect to mongoose
  await mongoose.connect(connectString);
  console.log(process.env.RESET_ADMIN);
  if (
    process.env.RESET_ADMIN === "TRUE" ||
    !(await User.findOne({ username: "admin" }).exec())
  ) {
    var password = generate({
      length: 16,
      numbers: true,
    });
    bcrypt.hash(password, 10, async function (err, hash) {
      console.log(
        `Admin does not exsist! Creating first user with temporary password: ${password}`
      );
      await User.updateOne(
        { username: "admin" },
        { password: hash, role: "admin" },
        { upsert: true }
      );
    });
  }

  console.log(`Connected to mongoose @ ${connectString}`);

  //Create socket.io server
  const io = new Server(server, {
    cors: {
      origin: corsString.split(" "),
    },
  });

  // serve the display endpoint
  console.log(`cors: ${corsString}`);

  server.listen(process.env.SERVERPORT || 3005, () => {
    console.log("listening on port 3005");
  });

  app.use(express.static("public"));
  app.use(express.json());
  app.use(cors());

  var store = new ExpressBrute.MemoryStore(); // stores state locally, don't use this in production
  var bruteforce = new ExpressBrute(store);

  app.get("/", (req, res) => {
    res.sendFile("index.html");
  });

  app.post(
    "/authenticate",
    bruteforce.prevent,
    validateRequest({
      body: z.object({
        username: z.string(),
        password: z.string(),
      }),
    }),
    async (req, res) => {
      const { username, password } = req.body;
      const user = await User.findOne({ username: username }).exec();
      if (user) {
        console.log(`User trying to login as: ${username}`);
        bcrypt.compare(password, user.password, function (err, result) {
          if (!result) {
            res.sendStatus(401);
          } else {
            console.log(`Succesfully authenticated as: ${username}`);
            console.log("Sending token!");
            var token = jwt.sign(
              { id: user._id, username: user.username },
              process.env.SECRET_KEY,
              { expiresIn: "1 day" }
            );
            res
              .status(200)
              .json({ username: user.username, role: user.role, token: token });
          }
          if (err) {
          }
        });
      } else {
        res.sendStatus("500");
      }
    }
  );

  //begin socket.io API for remote clients

  io.use(function (socket, next) {
    if (socket.handshake.headers.clienttype === "endpoint") {
      next();
    }
    if (socket.handshake.auth && socket.handshake.auth.token) {
      console.log(socket.handshake.auth.token);
      jwt.verify(
        socket.handshake.auth.token,
        process.env.SECRET_KEY,
        function (err, decoded) {
          if (err) return next(new Error("Authentication error"));
          socket.decoded = decoded;
          next();
        }
      );
    } else {
      next(new Error("Authentication error"));
    }
  });

  io.on("connection", async (socket) => {
    console.log(
      `A user with id: ${socket.id} connected of type:${socket.handshake.headers.clienttype}`
    );
    if (socket.handshake.headers.clienttype === "endpoint") {
      socket.join("endpoint");
    }
    socket.on("endpoint", () => {
      socket.join("endpoint");
      io.emit("endpointConnected", true);
    });

    socket.on("init", () => {
      haveEndpoints().then((state) => {
        socket.emit("endpointConnected", state);
      });
    });

    if (showing != null) socket.emit("question", showing);

    socket.on("getSessions", (msg, callBack) => {
      let res = Session.find({})
        .sort({ updatedAt: "desc" })
        .lean()
        .then((data) => {
          if (callBack) callBack(data);
        });
    });

    socket.on("addSession", (session, callBack) => {
      let options = {
        new: true,
        upsert: true,
      };

      if (session._id == null) {
        session._id = new mongoose.Types.ObjectId();
      }

      Session.findByIdAndUpdate(session._id, session, options).then(
        (newSession) => {
          callBack(true);
          io.emit("addSession", newSession);
        }
      );
    });

    socket.on("getSession", async (sessionId, callback) => {
      if (mongoose.isValidObjectId(sessionId)) {
        await Session.findById(sessionId)
          .lean()
          .then((session) => {
            callback(session);
            if (showing) socket.emit("questionStarted", showing);
          });
      } else {
        callback(null);
      }
    });

    socket.on("getQuestions", (sessionId, callBack) => {
      Session.findById(sessionId).then((session) => {
        let doc = session.questions;
        callBack(doc);
        io.emit();
      });
    });

    socket.on("sortQuestions", (sessionId, reducedArray, callBack) => {
      Session.findById(sessionId).then((session) => {
        reducedArray.forEach((element) => {
          let question = session.questions.id(element._id);
          question.order = element.order;
        });
        session.save().then((session) => {
          callBack(true);
        });
      });
    });

    socket.on("deleteSession", (sessionId, callBack) => {
      Session.findByIdAndDelete(sessionId).then((session) => {
        callBack(true);
        socket.broadcast.emit("sessionDeleted", session._id);
      });
    });

    socket.on("updateQuestion", (sessionId, question, callBack) => {
      Session.findById(sessionId).then((session) => {
        let doc = session.questions.id(question._id);

        if (doc) {
          doc.set(question);
          session.save().then((session) => {
            io.emit("updateQuestion", sessionId, question);
            callBack(true);
          });
        } else {
          let newQuestion = session.questions.create(question);
          session.questions.push(newQuestion);
          session.save().then((session) => {
            io.emit("addQuestion", session._id, newQuestion);
            callBack(true);
          });
        }
      });
    });

    socket.on("deleteQuestion", (sessionId, questionId, callBack) => {
      Session.findById(sessionId).then((session) => {
        session.questions.remove(session.questions.id(questionId));
        session.save().then(() => {
          socket.broadcast.emit("removeQuestion", sessionId, questionId);
          callBack(true);
        });
      });
    });

    socket.on("showQuestion", (question) => {
      showing = question;
      io.to("endpoint").emit("question", question);
      io.emit("questionStarted", question);
    });

    socket.on("hide", () => {
      showing = null;
      io.to("endpoint").emit("hide");
      io.emit("questionStarted", null);
    });

    socket.on("disconnect", () => {
      haveEndpoints().then((state) => {
        io.emit("endpointConnected", state);
      });
    });
  });

  async function haveEndpoints() {
    const sockets = await io.in("endpoint").fetchSockets();
    return sockets.length > 0;
  }
}
