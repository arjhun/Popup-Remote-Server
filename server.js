const express = require("express");
const app = express();
const http = require("http");
var path = require("path");
const storage = require("node-persist");
const server = http.createServer(app);
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const { forEach } = require("node-persist");
const { Schema } = mongoose;
//passwords
const bcrypt = require("bcrypt");
var generator = require("generate-password");

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

  if (!(await User.findOne({ username: "admin" }).exec())) {
    var password = generator.generate({
      length: 16,
      numbers: true,
    });
    bcrypt.hash(password, 10, async function (err, hash) {
      console.log(
        `Admin does not exsist! Creating first user with temporary password: ${password}`
      );
      await User.create({ username: "admin", password: hash, role: "admin" });
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

  app.use(express.static(path.join(__dirname, "public")));

  app.get("/", (req, res) => {
    res.sendFile(__dirname + "public/index.html");
  });

  //begin API for remote clients

  //TODO: authentication

  io.on("connection", (socket) => {
    console.log(
      `A user with id: ${socket.id} connected of type:${socket.handshake.headers.clienttype}`
    );

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
      io.to("endpoint").emit("question", showing);
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
