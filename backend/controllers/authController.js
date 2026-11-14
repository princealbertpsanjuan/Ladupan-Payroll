const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { generateEmployeeId } = require("../utils/employeeIdGenerator");
const { logAudit } = require("../utils/auditLogger");

const generateToken = (userId, role) => {
  return jwt.sign(
    { id: userId, role },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
};

const toUserResponse = (user) => ({
  id: user._id,
  employeeId: user.employeeId,
  firstName: user.firstName,
  lastName: user.lastName,
  email: user.email,
  role: user.role,
  hourlyRate: user.hourlyRate,
  requiredTimeIn: user.requiredTimeIn,
  isActive: user.isActive,
});

// REGISTER FIRST ADMIN
// Public registration is only allowed while the system has no admin yet.
// It creates the owner's admin account. After that, employee accounts are
// created by the Admin in Employee Management, and this route is closed.
exports.register = async (req, res) => {
  try {
    const adminExists = await User.exists({ role: "admin" });

    if (adminExists) {
      return res.status(403).json({
        message:
          "Registration is closed. Employee accounts are created by the Admin.",
      });
    }

    const { firstName, lastName, email, password } = req.body;

    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({
        message: "First name, last name, email, and password are required",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        message: "Password must be at least 6 characters",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await User.findOne({ email: normalizedEmail });

    if (existingUser) {
      return res.status(400).json({
        message: "Email already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const employeeId = await generateEmployeeId();

    const user = await User.create({
      employeeId,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role: "admin",
    });

    await logAudit(
      { user },
      {
        action: "ADMIN_REGISTERED",
        entityType: "Employee",
        entityId: user._id,
        description: `Admin account created for ${user.firstName} ${user.lastName}`,
      }
    );

    res.status(201).json({
      message: "Admin account registered successfully",
      user: {
        id: user._id,
        employeeId: user.employeeId,
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    res.status(500).json({
      message: "Registration failed",
      error: error.message,
    });
  }
};

// LOGIN USER
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Email and password are required",
      });
    }

    // Accept the email as typed or lowercased (older accounts may have
    // been saved with capital letters)
    const user = await User.findOne({
      email: { $in: [email.trim(), email.trim().toLowerCase()] },
    });

    if (!user) {
      return res.status(400).json({
        message: "Invalid email or password",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        message: "Account is disabled",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({
        message: "Invalid email or password",
      });
    }

    const token = generateToken(user._id, user.role);

    res.json({
      message: "Login successful",
      token,
      user: toUserResponse(user),
    });
  } catch (error) {
    res.status(500).json({
      message: "Login failed",
      error: error.message,
    });
  }
};

// GET CURRENT USER (fresh account details for My Account)
exports.getMe = async (req, res) => {
  res.json({ user: toUserResponse(req.user) });
};

// CHANGE OWN PASSWORD
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        message: "Current password and new password are required",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        message: "New password must be at least 6 characters",
      });
    }

    const user = await User.findById(req.user._id);

    const isMatch = await bcrypt.compare(currentPassword, user.password);

    if (!isMatch) {
      return res.status(400).json({
        message: "Current password is incorrect",
      });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    await logAudit(req, {
      action: "PASSWORD_CHANGED",
      entityType: "Employee",
      entityId: user._id,
      description: `${user.firstName} ${user.lastName} changed their password`,
    });

    res.json({ message: "Password changed successfully" });
  } catch (error) {
    res.status(500).json({
      message: "Failed to change password",
      error: error.message,
    });
  }
};

// CHANGE OWN EMAIL (requires the current password)
exports.changeEmail = async (req, res) => {
  try {
    const { newEmail, currentPassword } = req.body;
    const email = String(newEmail || "").trim().toLowerCase();

    if (!email || !currentPassword) {
      return res.status(400).json({
        message: "New email and current password are required",
      });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: "Please enter a valid email address" });
    }

    const user = await User.findById(req.user._id);

    const isMatch = await bcrypt.compare(currentPassword, user.password);

    if (!isMatch) {
      return res.status(400).json({ message: "Current password is incorrect" });
    }

    if (email === String(user.email).toLowerCase()) {
      return res.status(400).json({ message: "This is already your email address" });
    }

    const taken = await User.findOne({
      _id: { $ne: user._id },
      email: { $in: [String(newEmail).trim(), email] },
    });

    if (taken) {
      return res.status(400).json({ message: "Another account already uses this email" });
    }

    const oldEmail = user.email;
    user.email = email;
    await user.save();

    await logAudit(req, {
      action: "EMAIL_CHANGED",
      entityType: "Employee",
      entityId: user._id,
      description: `${user.firstName} ${user.lastName} changed their login email`,
      details: { changes: { email: { from: oldEmail, to: email } } },
    });

    res.json({ message: "Email changed successfully", user: toUserResponse(user) });
  } catch (error) {
    res.status(500).json({
      message: "Failed to change email",
      error: error.message,
    });
  }
};

// CHANGE OWN NAME (admin; employees' names are managed in Employees)
exports.changeName = async (req, res) => {
  try {
    const firstName = String(req.body.firstName || "").trim().replace(/\s+/g, " ");
    const lastName = String(req.body.lastName || "").trim().replace(/\s+/g, " ");

    if (!firstName || !lastName) {
      return res.status(400).json({ message: "First name and last name are required" });
    }

    if (firstName.length > 60 || lastName.length > 60) {
      return res.status(400).json({ message: "Names must be 60 characters or fewer" });
    }

    const user = await User.findById(req.user._id);
    const oldName = `${user.firstName} ${user.lastName}`;

    if (user.firstName === firstName && user.lastName === lastName) {
      return res.status(400).json({ message: "This is already your name" });
    }

    user.firstName = firstName;
    user.lastName = lastName;
    await user.save();

    await logAudit(req, {
      action: "NAME_CHANGED",
      entityType: "Employee",
      entityId: user._id,
      description: `${oldName} changed their name to ${firstName} ${lastName}`,
      details: { changes: { name: { from: oldName, to: `${firstName} ${lastName}` } } },
    });

    res.json({ message: "Name updated", user: toUserResponse(user) });
  } catch (error) {
    res.status(500).json({ message: "Failed to change name", error: error.message });
  }
};
