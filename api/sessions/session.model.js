import mongoose, { Schema } from "mongoose";
const POPUPS = ["default", "question", "tip"];
const popupSchema = new Schema(
  {
    content: String,
    order: Number,
    fav: Boolean,
    title: String,
    note: String,
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

export default Session;
