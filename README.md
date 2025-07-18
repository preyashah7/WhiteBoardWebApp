
---

# 🧑‍🎨 Collaborative Whiteboard

A real-time collaborative whiteboard application built with **React**, **Konva**, **Express**, **MongoDB**, and **Socket.IO**. Users can draw, add shapes, write sticky notes, collaborate live, and use **AI-assisted canvas features**. Complete with role-based permissions, live cursors, edit locking, and undo/redo.

> ✅ **Check the video walkthrough here:** [Watch Demo](#)
> *(Replace `#` with your actual video link)*

---

## 🚀 Features

### 🔐 Authentication

* Login via **username and password**.
* Session management with persistent access.

### 🗂️ Dashboard

* Create and delete boards.
* Invite users by **username** with role assignment (`viewer` or `editor`).
* Manage collaborators (change permission, remove access).

### 🧑‍🤝‍🧑 Real-Time Collaboration

* Built with **Socket.IO** for syncing:

  * Shapes
  * Lines
  * Live cursors
  * Chat
* Multi-user collaboration on the same board.
* Live **cursor tracking** with user names.

### ✍️ Drawing & Editing Tools

* Tools: `Select`, `Draw`, `Erase`, `Arrow`, `Sticky Note`.
* Add Shapes:

  * Rectangle
  * Circle
  * Ellipse
  * Arrow
  * Text
  * Sticky Notes
* All shapes are:

  * **Draggable**
  * **Resizable** (with Transformer)
  * **Editable**
  * **Color customizable** (fill + stroke)
  * **Snap-to-grid** support
* Freehand drawing with live syncing.

### 🧠 AI-Powered Commands

* Type prompts like `"draw a red circle"` or `"add a sticky note"` and let AI generate it.
* Powered by backend `/api/ai` route.

### 🔒 Role-Based Access

* **Editors** can draw, edit, delete.
* **Viewers** can only view canvas in real-time.
* **Edit lock system**: shape-level lock prevents others from editing simultaneously.
* 🔒 Lock icon appears on locked objects.

### 🔄 Undo / Redo System

* Track changes per user.
* Restore or redo last actions.
* Fully synced across sessions.

### 💬 Chat System

* Real-time chat between collaborators.
* History synced per board.

### 🌐 Zoom & Pan

* Mouse wheel zooming (in/out).
* Pan with mouse drag.
* Infinite background grid with scaling.

---

## 🛠️ Tech Stack

| Layer    | Technology                |
| -------- | ------------------------- |
| Frontend | React, Konva, Material UI |
| Realtime | Socket.IO                 |
| Backend  | Node.js, Express.js       |
| Database | MongoDB                   |
| Auth     | JWT-based authentication  |

---

## 📌 TODO / Future Enhancements

* 🔁 Export board as image or PDF
* 📄 Templates for quick board creation
* 💾 Auto-saving and versioning
* 🧠 Better AI response handling
* ✂️ Copy-paste and duplication of shapes
* 🎨 Color themes / dark mode

---

## 🙌 Acknowledgements

This project was made with ❤️ and a lot of code.
