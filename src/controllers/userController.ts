import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { RequestHandler } from 'express';
import 'reflect-metadata';
import { User } from '../entity/User';
import { getRepository } from 'typeorm';

// Add extra variables to SessionData
declare module 'express-session' {
  interface SessionData {
    browser: String;
    userID: String;
  }
}

// This function is invoked to register a new user
export const registerUser: RequestHandler = async (req, res) => {
  try {
    // Get user credentials
    const { email, username, password } = req.body;

    // Validate user credentials
    if (!(email && username && password)) {
      res.status(400).send('All input is required');
    }

    // Check if user already exists in the database
    const existingEmail = await getRepository(User).findOne({ email });
    const existingUsername = await getRepository(User).findOne({ username });

    if (existingEmail || existingUsername) {
      return res.status(409).render('signup', {
        errorMessage: 'User already exists!',
        page_name: 'signup',
      });
    }

    // Encrypt user password
    const encryptedPassword = await bcrypt.hash(password, 10);

    // Create new user
    const user = getRepository(User).create({
      email,
      username,
      password: encryptedPassword,
    });

    // Save new user to database
    await getRepository(User).save(user);

    // Redirect new user to login page
    return res.status(201).render('login', {
      errorMessage: null,
      successMessage: 'You have been succesfully registered. Please login.',
      page_name: 'login',
    });
  } catch (err) {
    console.log(err);
  }
};

// This function is invoked when user tries to login
export const makeUserLogin: RequestHandler = async (req, res) => {
  try {
    // Get user input at login page
    const { username, password } = req.body;

    // Validate user input
    if (!(username && password)) {
      res.status(400).send('All input is required');
    }

    // If user exists and password matches, create token
    const user = await getRepository(User).findOne({ username });
    if (user && (await bcrypt.compare(password, user.password))) {
      const token = jwt.sign(
        { id: user.id, browser: req.headers['user-agent'] },
        process.env.TOKEN_KEY,
        {
          expiresIn: '5m',
        }
      );

      // set cookie
      res.cookie('access_token', token, {
        httpOnly: true,
      });

      // keep user's id and browser info in session
      req.session.userID = user.id.toString();
      req.session.browser = req.headers['user-agent'];

      // Route authenticated user to welcome page
      return res
        .status(200)
        .render('index', { user, token, page_name: 'index' });
    } else {
      res.status(400).render('login', {
        page_name: 'login',
        errorMessage: 'Invalid credentials!',
        successMessage: null,
      });
    }
  } catch (err) {
    console.log(err);
  }
};

// this function is invoked to list all users in the database
export const listUsers: RequestHandler = async (req, res) => {
  const allUsers = await getRepository(User).find();
  res.render('userlist', { allUsers });
};

// this function is invoked when user clicks on logout button.
export const makeUserLogout: RequestHandler = (req, res) => {
  req.session.destroy(function (err) {
    if (err) {
      console.log(err);
    } else {
      res.clearCookie('access_token');
      res.redirect('/login');
    }
  });
};