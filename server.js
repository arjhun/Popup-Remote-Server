"use strict";

import config from "./server.config.js";

//logger
import logger from "./logger.js";

//db
import mongoose from "mongoose";

//servers
import express from "express";
import { Server } from "socket.io";
import { createServer } from "http";

//auth
import jwt from "jsonwebtoken";

//middleware
import ExpressBruteFlexible from "rate-limiter-flexible/lib/ExpressBruteFlexible.js";
import { validateRequest, processRequest } from "zod-express-middleware";
import { z } from "zod";
import { userSchema, passwordSchema } from "./models/UserApiSchemas.js";
import cors from "cors";
import { expressjwt } from "express-jwt";
import * as lt from "long-timeout";

//models and controllers
import Session, {
  getSessions,
  addSession,
  getSession,
  updateSession,
  deleteSession,
  orderPopups,
} from "./models/SessionModel.js";

import User, {
  createUser,
  getUser,
  getUsers,
  updateUser,
  deleteUser,
  activateUser,
  ROLES,
  ROLES_VALUES,
  changeRole,
} from "./models/UserModel.js";

import {
  createDefaultAdmin,
  authenticate,
  refresh,
  verifyPassword,
} from "./Auth.js";

import {
  updatePasswordByToken,
  sendPasswordToken,
} from "./models/TokenModel.js";

import { pinoHttp } from "pino-http";

const reqLogger = pinoHttp({ logger: logger });

const app = express();
const server = createServer(app);

//connect to mongoose
await mongoose
  .connect(config.db.connString)
  .then(() => {
    logger.info(`Connected to mongoose @ ${config.db.connString}`);
    startServer().catch((error) => {
      logger.error(error);
    });
  })
  .catch((err) => logger.fatal(err));

async function startServer() {
  let showing, lastPopup;

  if (
    !(await User.findOne({ username: "admin" }).exec()) ||
    config.auth.resetAdmin
  ) {
    createDefaultAdmin();
  }

  //Create socket.io server
  const io = new Server(server, {
    cors: {
      origin: config.server.corsUrls,
    },
  });

  logger.info(`cors origin set to: ${config.server.corsUrls}`);

  // serve the socket server;
  server.listen(config.socket.port, () => {
    logger.info(`Socket.io listening on port ${config.socket.port}`);
  });

  var bruteforce = new ExpressBruteFlexible(
    ExpressBruteFlexible.LIMITER_TYPES.MEMORY,
    { freeRetries: 10 }
  );

  //global middleware
  app.use(reqLogger);
  app.use(express.static("public"));
  app.use(express.json());
  app.use(cors());

  app.use(
    expressjwt({
      secret: config.auth.secret,
      algorithms: ["HS256"],
    }).unless({
      path: ["/", "/authenticate", "/refresh", "/reset-password"],
    })
  );

  app.use(function (err, req, res, next) {
    const date = new Date().toLocaleString();
    if (err.name === "UnauthorizedError") {
      logger.error(
        `${date}: error: UnauthorizedError, method: ${req.method}, url: ${req.url} ,ip: ${req.ip}`
      );
      return res
        .status(401)
        .send("invalid token...Refresh token or contact your admin!");
    }
    next(err);
  });

  // custom middleware

  const onlyAdmin = (req, res, next) => {
    if (req.auth.role !== ROLES.ADMIN) return res.sendStatus(403);
    next();
  };

  const onlyAdminAndOwner = (req, res, next) => {
    if (req.auth.role !== ROLES.ADMIN) {
      if (req.params.id !== req.auth.id) return res.sendStatus(403);
    }
    next();
  };

  //routes

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
    authenticate
  );

  app.post(
    "/refresh",
    bruteforce.prevent,
    validateRequest({
      body: z.object({
        refreshToken: z.string(),
      }),
    }),
    refresh
  );

  app.post(
    "/reset-password",
    bruteforce.prevent,
    validateRequest({
      body: z.object({
        email: z.string().email(),
      }),
    }),
    sendPasswordToken
  );

  app.put(
    "/reset-password",
    bruteforce.prevent,
    validateRequest({
      body: z.object({
        token: z.string(),
        tokenId: z.string(),
        password: z.string(),
      }),
    }),
    updatePasswordByToken
  );

  app.get("/users", onlyAdmin, getUsers);

  app.post(
    "/users",
    processRequest({
      body: z.object(userSchema).partial(),
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
    processRequest({
      params: z.object({
        id: z.string(),
      }),
      body: z.object({ ...userSchema, ...passwordSchema }).partial(),
    }),
    onlyAdminAndOwner,
    verifyPassword,
    updateUser
  );

  app.put(
    "/users/:id/active",
    processRequest({
      params: z.object({
        id: z.string(),
      }),
      body: z.object({ active: z.boolean() }),
    }),
    onlyAdmin,
    activateUser
  );

  app.put(
    "/users/:id/role",
    processRequest({
      params: z.object({
        id: z.string(),
      }),
      body: z.object({ role: z.enum(ROLES_VALUES) }),
    }),
    onlyAdmin,
    changeRole
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
          config.auth.secret,
          function (err, decoded) {
            if (err) return next(new Error(err));
            socket.decoded = decoded;
            //disconnect when jwt expires
            const expiresIn = (decoded.exp - Date.now() / 1000) * 1000;
            const timeout = lt.setTimeout(
              () => socket.disconnect(true),
              expiresIn
            );
            socket.on("disconnect", () => lt.clearTimeout(timeout));
            next();
          }
        );
      } else {
        next(new Error("Authentication error"));
      }
    }
  });

  io.on("connection", async (socket) => {
    logger.info(
      `A socket with id: ${socket.id} connected of type:${socket.handshake.headers.clienttype}`
    );

    if (socket.handshake.headers.clienttype === "endpoint") {
      await socket.join("endpoint");
      if (showing) io.to("endpoint").emit("popup", lastPopup);
      haveEndpoints().then((state) => {
        socket.broadcast.emit("endpointConnected", state);
      });
    }

    if (socket.handshake.headers.clienttype === "remote") {
      logger.info(
        `Authenticated remote from user: ${socket.decoded?.username} connected`
      );
      haveEndpoints().then((state) => {
        socket.emit("endpointConnected", state);
      });
      if (showing) socket.emit("popupStarted", lastPopup);

      socket.on("sortPopups", (sessionId, reducedArray, callBack) => {
        Session.findById(sessionId).then((session) => {
          reducedArray.forEach((popup) => {
            session.popups.id(popup._id).order = popup.order;
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
      lastPopup = popup;
      showing = true;
      io.to("endpoint").emit("popup", lastPopup);
      io.emit("popupStarted", lastPopup);
    });

    socket.on("repeatPopup", () => {
      showing = true;
      io.to("endpoint").emit("popup", lastPopup);
      io.emit("popupStarted", lastPopup);
    });

    socket.on("hide", () => {
      showing = false;
      io.to("endpoint").emit("hide");
      io.emit("popupStarted", null);
    });

    socket.on("disconnect", () => {
      logger.info(
        { socketId: socket.id, type: socket.handshake.headers.clienttype },
        `A socket disconnected!`
      );
      haveEndpoints().then((state) => {
        socket.broadcast.emit("endpointConnected", state);
      });
    });
  });

  async function haveEndpoints() {
    const sockets = await io.in("endpoint").fetchSockets();
    return sockets.length > 0;
  }
}
