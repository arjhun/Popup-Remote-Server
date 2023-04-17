import mongoose, { Schema } from "mongoose";

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

const Popup = mongoose.model("popups", popupSchema);

export default Popup;
