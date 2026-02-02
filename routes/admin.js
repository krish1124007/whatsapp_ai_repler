import express from "express";
import { createAdmin, loginAdmin } from "../functions/admin.js";

const router = express.Router();

router.post("/create", createAdmin);
router.post("/login", loginAdmin);

export default router;