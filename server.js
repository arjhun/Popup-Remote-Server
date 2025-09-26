"use strict";

import config from "./server.config.js";

//logger
import logger from "./logger.js";

logger.trace(config, "Starting server with the following config:");

if (!config.auth.secret) {
  logger.fatal("Please provide a secret key for tokens");
  process.exit(1);
}

//db
import mongoose from "mongoose";

//servers
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";

//auth
import jwt from "jsonwebtoken";

//middleware
import cors from "cors";
import { expressjwt } from "express-jwt";
import * as lt from "long-timeout";

import { checkToken } from "./middlewares/auth.mw.js";

//models and controllers

import { pinoHttp } from "pino-http";
import authRouter from "./api/auth/auth.routes.js";
import { createDefaultAdmin } from "./api/auth/auth.utils.js";
import Session from "./api/sessions/session.model.js";
import sessionRouter from "./api/sessions/session.routes.js";
import User from "./api/users/users.model.js";
import userRouter from "./api/users/users.routes.js";

const reqLogger = pinoHttp({ logger: logger, useLevel: "debug" });

const app = express();
const server = createServer(app);



//connect to mongoose
await mongoose
  .connect(config.db.connString)
  .then(async () => {
    logger.info(`Connected to mongoose @ ${config.db.connString}`);
    await startServer().catch((error) => {
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
  server.listen(config.server.port, () => {
    logger.info(`Socket.io listening on port ${config.server.port}`);
  });

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
      path: [
        "/",
        "/authenticate",
        "/refresh",
        "/reset-password",
        "/verify-account",
      ],
    })
  );

  app.use(checkToken);
  app.use("/", authRouter);
  app.use("/users", userRouter);
  app.use("/sessions", sessionRouter);

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
            if (err || !decoded) return next(new Error(err.message));
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
          if (!session || !reducedArray) return;
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
          if (session == null) return;
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
