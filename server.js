import express from "express";
import { Server } from "socket.io";
import mongoose from "mongoose";
import * as dotenv from "dotenv";
import { createServer } from "http";
//auth
import jwt from "jsonwebtoken";
//middleware
import ExpressBrute from "express-brute";
import { validateRequest } from "zod-express-middleware";
import { z } from "zod";
import cors from "cors";
import { expressjwt } from "express-jwt";
//db

import Session, {
  getSessions,
  addSession,
  getSession,
  updateSession,
  deleteSession,
  orderPopups,
} from "./Session.js";

import User, {
  ROLES,
  createUser,
  getUser,
  getUsers,
  updateUser,
  deleteUser,
  ROLES_VALUES,
} from "./User.js";
import { createDefaultAdmin, authenticate } from "./Auth.js";

dotenv.config();

const app = express();
const server = createServer(app);

const mongoConnectString =
  process.env.CONN_STR || "mongodb://127.0.0.1:27017/questions";

//connect to mongoose
await mongoose
  .connect(mongoConnectString)
  .then(() => {
    console.log(`Connected to mongoose @ ${mongoConnectString}`);
    startServer().catch((error) => {
      console.log(error);
    });
  })
  .catch((err) => console.log(err));

async function startServer() {
  let showing = null;

  const corsString = process.env.CORS_STR || "http://localhost:3000";

  if (
    !(await User.findOne({ username: "admin" }).exec()) ||
    process.env.RESET_ADMIN === "TRUE"
  ) {
    createDefaultAdmin();
  }

  //Create socket.io server
  const io = new Server(server, {
    cors: {
      origin: corsString.split(" "),
    },
  });

  console.log(`cors: ${corsString}`);

  // serve the socket server;
  server.listen(process.env.SERVERPORT || 3005, () => {
    console.log("Socket.io listening on port 3005");
  });

  var store = new ExpressBrute.MemoryStore(); // stores state locally, don't use this in production
  var bruteforce = new ExpressBrute(store, {
    freeRetries: 5,
  });

  app.use(express.static("public"));
  app.use(express.json());
  app.use(cors());

  app.use(
    expressjwt({
      secret: process.env.SECRET_KEY,
      algorithms: ["HS256"],
    }).unless({ path: ["/", "/authenticate"] })
  );

  app.get("/", (req, res) => {
    res.sendFile("index.html");
  });

  app.post(
    "/authenticate",
    // bruteforce.prevent,
    validateRequest({
      body: z.object({
        username: z.string(),
        password: z.string(),
      }),
    }),
    authenticate
  );
  // user api routes

  const onlyAdmin = (req, res, next) => {
    if (req.auth.role !== ROLES.ADMIN) res.sendStatus(403);
    else next();
  };

  const onlyAdminAndOwner = (req, res, next) => {
    if (req.params.id !== req.auth.id) {
      if (req.auth.role !== ROLES.ADMIN) res.sendStatus(403);
    }
    next();
  };

  const onlyOwner = (req, res, next) => {
    if (req.params.id !== req.auth.id) res.sendStatus(403);
    else next();
  };

  const profileSchema = {
    username: z.string().min(4),
    firstName: z.string().min(2),
    lastName: z.string().min(2),
    email: z.string().email(),
    password: z.optional(z.string().or(z.literal(""))),
    newPassword: z.optional(
      z
        .string()
        .regex(/^(?=.{8,20}$)(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?!.*\s).*/)
        .or(z.literal(""))
    ),
  };

  const userSchema = {
    ...profileSchema,
    role: z.enum(ROLES_VALUES).optional(),
  };

  app.get("/users", onlyAdmin, getUsers);

  app.post(
    "/users",
    validateRequest({
      body: z.object(userSchema),
    }),
    onlyAdmin,
    createUser
  );

  app.get(
    "/users/:id",
    validateRequest({
      params: z.object({
        id: z.string(),
      }),
    }),
    onlyAdminAndOwner,
    getUser
  );

  app.put(
    "/users/:id",
    (req, res, next) => {
      console.log(req.body);
      next();
    },
    validateRequest({
      params: z.object({
        id: z.string(),
      }),
      body: z.object(profileSchema),
    }),
    onlyAdminAndOwner,
    updateUser
  );

  app.delete(
    "/users/:id",
    validateRequest({
      params: z.object({
        id: z.string(),
      }),
    }),
    onlyAdmin,
    deleteUser
  );

  //session api routes
  app.get("/sessions", getSessions);

  app.post(
    "/sessions",
    validateRequest({
      body: z.object({
        title: z.string(),
      }),
    }),
    onlyAdmin,
    addSession
  );

  app.get(
    "/sessions/:id",
    validateRequest({
      params: z.object({
        id: z.string(),
      }),
    }),
    getSession
  );

  app.put(
    "/sessions/:id",
    validateRequest({
      params: z.object({
        id: z.string(),
      }),
      body: z.object({
        title: z.string().nonempty(),
      }),
    }),
    onlyAdmin,
    updateSession
  );

  app.put(
    "/sessions/:id/order",
    validateRequest({
      params: z.object({
        id: z.string(),
      }),
      body: z.object({
        orderArray: z.object({ _id: z.string(), order: z.number() }).array(),
      }),
    }),
    orderPopups
  );

  app.delete(
    "/sessions/:id",
    validateRequest({
      params: z.object({
        id: z.string(),
      }),
    }),
    deleteSession
  );

  //begin socket.io API for remote clients

  io.use(function (socket, next) {
    if (socket.handshake.headers.clienttype === "endpoint") {
      next();
    } else {
      if (socket.handshake.auth?.token) {
        jwt.verify(
          socket.handshake.auth.token,
          process.env.SECRET_KEY,
          function (err, decoded) {
            if (err) return next(new Error(err));
            socket.decoded = decoded;
            next();
          }
        );
      } else {
        next(new Error("Authentication error"));
      }
    }
  });

  io.on("connection", async (socket) => {
    console.log(
      `A socket with id: ${socket.id} connected of type:${socket.handshake.headers.clienttype}`
    );

    if (socket.handshake.headers.clienttype === "endpoint") {
      await socket.join("endpoint");
      haveEndpoints().then((state) => {
        socket.broadcast.emit("endpointConnected", state);
      });
      if (showing != null) socket.emit("popup", showing);
    }

    if (socket.handshake.headers.clienttype === "remote") {
      console.log(
        `Authenticated remote from user: ${socket.decoded?.username} connected`
      );
      haveEndpoints().then((state) => {
        socket.emit("endpointConnected", state);
      });

      socket.on("sortPopups", (sessionId, reducedArray, callBack) => {
        Session.findById(sessionId).then((session) => {
          reducedArray.forEach((element) => {
            let popup = session.popups.id(element._id);
            popup.order = element.order;
          });
          session.save().then((session) => {
            callBack(true);
          });
        });
      });

      socket.on("addPopup", async (sessionId, data, callBack) => {
        await Session.findById(sessionId)
          .exec()
          .then((session) => {
            if (!session) return;
            let popup = session.popups.create(data);
            session.popups.push(popup);
            session.save().then((savedSession) => {
              io.emit("addPopup", savedSession._id, popup);
              callBack(true);
            });
          });
      });

      socket.on("updatePopup", async (sessionId, data, callBack) => {
        await Session.findById(sessionId)
          .exec()
          .then((session) => {
            if (!session) return;
            console.log("popup", data);
            let popup = session.popups.id(data._id);
            if (popup) {
              popup.set(data);
              session.save().then((savedSession) => {
                io.emit("updatePopup", savedSession._id, popup);
                callBack(true);
              });
            }
          });
      });

      socket.on("deletePopup", async (sessionId, popupId, callBack) => {
        await Session.findById(sessionId).then((session) => {
          session.popups.remove(session.popups.id(popupId));
          session.save().then((savedSession) => {
            socket.broadcast.emit("deletePopup", savedSession._id, popupId);
            callBack(true);
          });
        });
      });
    }

    socket.on("showPopup", (popup) => {
      showing = popup;
      io.to("endpoint").emit("popup", showing);
      io.emit("popupStarted", popup);
    });

    socket.on("hide", () => {
      showing = null;
      io.to("endpoint").emit("hide");
      io.emit("popupStarted", null);
    });

    socket.on("disconnect", () => {
      console.log(
        `A user with id: ${socket.id} of type:${socket.handshake.headers.clienttype} disconnected!`
      );
      haveEndpoints().then((state) => {
        socket.broadcast.emit("endpointConnected", state);
      });
    });
  });

  async function haveEndpoints() {
    const sockets = await io.in("endpoint").fetchSockets();
    console.log("endpoints:", sockets.length);
    return sockets.length > 0;
  }
}