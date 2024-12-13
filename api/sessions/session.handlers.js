import logger from "../../logger.js";
import Session from "./session.model.js";

export const getSessions = async (req, res) => {
  await Session.aggregate()
    .unwind("_id")
    .addFields({
      popupCount: {
        $size: { $ifNull: ["$popups", []] },
      },
    })
    .project({ popups: 0 })
    .sort({ updatedAt: "desc" })
    .exec()
    .then((sessions) => {
      res.status(200).json(sessions);
    })
    .catch((error) => {
      logger.error(error);
      res.sendStatus(500);
    });
};

export const addSession = async (req, res) => {
  await Session.create({ title: req.body.title })
    .then((session) => {
      res.status(201).json(session);
    })
    .catch((error) => {
      logger.error(error);
      res.sendStatus(500);
    });
};

export const getSession = async (req, res) => {
  await Session.findById(req.params.id)
    .then((session) => {
      if (session) res.status(200).json(session);
      else res.sendStatus(404);
    })
    .catch((error) => {
      logger.error(error);
      res.sendStatus(500);
    });
};

export const orderPopups = async (req, res) => {};

export const updateSession = async (req, res) => {
  await Session.findByIdAndUpdate(
    req.params.id,
    { ...req.body },
    { returnDocument: "after" }
  )
    .lean()
    .then((session) => {
      if (session) res.status(200).json(session);
      else res.sendStatus(404);
    })
    .catch(() => {
      res.sendStatus(500);
    });
};

export const deleteSession = async (req, res) => {
  await Session.findByIdAndDelete(req.params.id).then((session) => {
    if (session) res.status(200).json(session);
    else res.sendStatus(404);
  });
};
