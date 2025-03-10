const { Router, query } = require("express");
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const router = Router();

const noteDAO = require('../daos/note');
const tokenDAO = require('../daos/token');
const userDAO = require('../daos/user');

//MIDDLEWARE

//isLoggedIn(req, res, next) - should check if the user has a valid
//token and if so make req.userId = the userId associated with that token.
//The token will be coming in as a bearer token in the authorization header
//(i.e. req.headers.authorization = 'Bearer 1234abcd') and you will need to
//extract just the token text.
//Any route that says "If the user is logged in" should use this
//middleware function
const isLoggedIn = async (req, res, next) => {
    const bearerHeader = req.headers.authorization;
    if (bearerHeader) {
        const bearer = bearerHeader.split(' ')[1];
        req.token = bearer;
        if (req.token) {
            const userId = await tokenDAO.getUserIdFromToken(req.token);
            if (userId) {
                req.userId = userId;
                next();
            } else {
                res.sendStatus(401);
            }
        } else {
            res.sendStatus(401);
        }
    } else {
        res.sendStatus(401);
    }
};

//LOGIN ROUTES

//Signup: POST /login/signup - should use bcrypt on the incoming password.
//Store user with their email and encrypted password, handle conflicts when
//the email is already in use.
router.post("/signup", async (req, res, next) => {
    const { email, password } = req.body;
    if (!email || !password || password === "" || email === "") {
        res.status(400).send('Email and password are required');
    } else {
        try {
            const newSignUp = await userDAO.getUser(email);
            if (newSignUp) {
                res.sendStatus(409);
            } else {
                const newUser = await userDAO.signup(email, password);
                res.json(newUser);
            }
        } catch (e) {
            next(e);
        }
    }
});

//Login: POST /login - find the user with the provided email.
//Use bcrypt to compare stored password with the incoming password.
//If they match, generate a random token with uuid and return it to the user.
router.post("/", async (req, res, next) => {
    const { email, password } = req.body;
    const user = await userDAO.getUser(email);
    if (!user) {
        res.status(401).send('User does not exist');
    } else {
        if (!password || password === "") {
            res.status(400).send('Password required');
        } else {
            const user = await userDAO.getUser(email);
            const matchPassword = await bcrypt.compare(password, user.password);
            if (!matchPassword) {
                res.status(401).send('Incorrect password');
            } else {
                try {
                    const userToken = await userDAO.assignUserToken(user._id);
                    res.json(userToken);
                } catch (e) {
                    next(e);
                }
            }
        }
    }
});

//Logout: POST /login/logout - if the user is logged in, invalidate their
//token so they can't use it again (remove it).
router.post("/logout", isLoggedIn, async (req, res, next) => {
    const userToken = req.token;
    const tokenDeleted = await tokenDAO.removeToken(userToken);
    if (tokenDeleted) {
        res.status(200).send('Token deleted');
    } else {
        res.status(401).send('User not found for token');
    }
});

//Change Password POST /login/password - if the user is logged in, store
//the incoming password using their userId.
router.post("/password", isLoggedIn, async (req, res, next) => {
    const userId = await tokenDAO.getUserIdFromToken(req.token);
    if (!userId) {
        res.status(401).send('Invalid token');
    } else {
        const { password } = req.body;
        if (!password || password === "") {
            res.status(400).send('Password required');
        } else {
            try {
                const updatedUser = await userDAO.updateUserPassword(userId, password);
                res.sendStatus(200);
            } catch (e) {
                res.sendStatus(401);
            }
        }
    }
});

//ERROR HANDLER

//router.use(error, req, res, next) - can be used to handle errors
//where the provided note id is not a valid ObjectId.
//This can be done without middleware though.
router.use(function (error, req, res, next) {
    if (error.message.includes("invalid")) {
        res.status(400).send('Invalid ID');
    } else if (error.message.includes("token")) {
        res.sendStatus(401);
    } else if (error.message.includes("duplicate")) {
        res.status(409).send('Account already exists');
    } else {
        res.sendStatus(500);
    }
});

module.exports = router;