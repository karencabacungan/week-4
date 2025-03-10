const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    email: { type: String, required: true, index: true, unique: true },
    password: { type: String, required: true, index: true }
});

module.exports = mongoose.model("users", userSchema);