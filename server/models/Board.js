import mongoose from "mongoose";

const boardSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    collaborators: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        permission: {
          type: String,
          enum: ["editor", "viewer"],
          default: "editor",
        },
      },
    ],
    data: {
      type: Object,
      default: { shapes: [], lines: [] },
    },
  },
  { timestamps: true }
);

export default mongoose.model("Board", boardSchema);
