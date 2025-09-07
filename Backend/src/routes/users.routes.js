import { Router } from "express";
import { addToHistory, getUserHistory, login, register } from "../controllers/user.controller.js";


const router = Router();

router.route("/login").post(login)
router.route("/register").post(register)
router.route("/add-to-activity").post(addToHistory)
router.route("/get-all-activity").get(getUserHistory)

export default router;