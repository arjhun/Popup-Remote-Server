import mongoose, { Schema } from "mongoose";
const POPUPS = ["default", "question", "tip"];
const popupSchema = new Schema(
  {
    content: String,
    order: Number,
    fav: Boolean,
    type: {
      type: String,
      enum: POPUPS,
      default: "default",
    },
  },
  { timestamps: true }
);

const sessionSchema = new Schema(
  {
    title: String,
    popups: { type: [popupSchema], default: [] },
  },
  {
    timestamps: true,
    toObject: { virtuals: true, getters: true },
    toJSON: { virtuals: true, getters: true },
  }
);

sessionSchema.virtual("popupCount", {
  count: true,
  ref: "sessions.popups",
  localField: "_id",
  foreignField: "_id",
});

const Session = mongoose.model("sessions", sessionSchema);

export const getSessions = async (req, res) => {
  await Session.aggregate()
    .unwind("_id")
    .addFields({
      popupCount: {
        $size: { $ifNull: ["$popups", []] },
      },
    })
    .project("-popups")
    .sort({ updatedAt: "desc" })
    .then((data) => {
      delete data.popups;
      res.status(200).json(data);
    });
};

export const addSession = async (req, res) => {
  await Session.create({ title: req.body.title })
    .then((session) => {
      res.status(201).json(session);
    })
    .catch((error) => {
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
      console.log(error);
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

export default Session;
