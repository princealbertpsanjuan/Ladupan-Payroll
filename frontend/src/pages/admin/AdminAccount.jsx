import { useEffect, useState } from "react";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";
import { useToast } from "../../context/ToastContext";
import Spinner from "../../components/Spinner";

const emptyEmailForm = { newEmail: "", currentPassword: "" };
const emptyPasswordForm = { currentPassword: "", newPassword: "", confirmPassword: "" };

// Admin: view account and change name, login email and password.
// Both changes require the current password.
const AdminAccount = () => {
  const { user, refreshUser } = useAuth();
  const toast = useToast();

  const [emailForm, setEmailForm] = useState(emptyEmailForm);
  const [emailError, setEmailError] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);

  const [passwordForm, setPasswordForm] = useState(emptyPasswordForm);
  const [passwordError, setPasswordError] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const [nameForm, setNameForm] = useState({ firstName: "", lastName: "" });
  const [nameError, setNameError] = useState("");
  const [savingName, setSavingName] = useState(false);

  useEffect(() => {
    refreshUser().catch(() => {});
  }, []);

  useEffect(() => {
    if (user) setNameForm({ firstName: user.firstName || "", lastName: user.lastName || "" });
  }, [user?.firstName, user?.lastName]);

  const changeName = async (e) => {
    e.preventDefault();
    setNameError("");

    try {
      setSavingName(true);
      const res = await api.put("/auth/change-name", nameForm);
      await refreshUser().catch(() => {});
      toast.success(`You now appear as ${res.data.user?.firstName} ${res.data.user?.lastName}.`, {
        title: "Name updated",
      });
    } catch (error) {
      setNameError(error.response?.data?.message || "Failed to change name.");
    } finally {
      setSavingName(false);
    }
  };

  const changeEmail = async (e) => {
    e.preventDefault();
    setEmailError("");

    try {
      setSavingEmail(true);
      const res = await api.put("/auth/change-email", emailForm);
      await refreshUser().catch(() => {});
      toast.success(`From now on, sign in with ${res.data.user?.email}.`, {
        title: "Email changed",
      });
      setEmailForm(emptyEmailForm);
    } catch (error) {
      setEmailError(error.response?.data?.message || "Failed to change email.");
    } finally {
      setSavingEmail(false);
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    setPasswordError("");

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError("New passwords do not match.");
      return;
    }

    try {
      setSavingPassword(true);
      const res = await api.put("/auth/change-password", {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      toast.success(res.data.message, { title: "Password updated" });
      setPasswordForm(emptyPasswordForm);
    } catch (error) {
      setPasswordError(error.response?.data?.message || "Failed to change password.");
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="lp-page">
      <div className="lp-header">
        <div>
          <h1>My Account</h1>
          <p>Your admin sign-in details.</p>
        </div>
      </div>

      <div className="lp-card">
        <div className="lp-details">
          <div>
            <span>Name</span>
            <strong>
              {user?.firstName} {user?.lastName}
            </strong>
          </div>
          <div>
            <span>Sign-in email</span>
            <strong className="wrap-anywhere">{user?.email}</strong>
          </div>
          <div>
            <span>Role</span>
            <strong>Administrator</strong>
          </div>
        </div>
      </div>

      <div className="lp-card">
        <h2>Change name</h2>
        <p className="lp-card-subtitle">
          Shown in the sidebar, audit log and notifications. Put a middle initial at the end
          of the first name, e.g. <strong>John Albert P.</strong>
        </p>

        {nameError && <div className="lp-alert error">{nameError}</div>}

        <form className="lp-form name-form" onSubmit={changeName} autoComplete="off">
          <div className="lp-field">
            <label>First name</label>
            <input
              type="text"
              autoComplete="off"
              maxLength={60}
              value={nameForm.firstName}
              onChange={(e) => setNameForm({ ...nameForm, firstName: e.target.value })}
              required
            />
          </div>

          <div className="lp-field">
            <label>Last name</label>
            <input
              type="text"
              autoComplete="off"
              maxLength={60}
              value={nameForm.lastName}
              onChange={(e) => setNameForm({ ...nameForm, lastName: e.target.value })}
              required
            />
          </div>

          <div>
            <button type="submit" className="lp-btn" disabled={savingName} aria-busy={savingName}>
              {savingName && <Spinner />}
              {savingName ? "Saving..." : "Save Name"}
            </button>
          </div>
        </form>
      </div>

      <div className="account-forms">
        <div className="lp-card">
          <h2>Change email</h2>
          <p className="lp-card-subtitle">You will use the new email to sign in.</p>

          {emailError && <div className="lp-alert error">{emailError}</div>}

          <form className="lp-form" onSubmit={changeEmail} autoComplete="off">
            <div className="lp-field">
              <label>New email</label>
              <input
                type="email"
                autoComplete="off"
                value={emailForm.newEmail}
                onChange={(e) => setEmailForm({ ...emailForm, newEmail: e.target.value })}
                required
              />
            </div>

            <div className="lp-field">
              <label>Current password</label>
              <input
                type="password"
                autoComplete="current-password"
                value={emailForm.currentPassword}
                onChange={(e) => setEmailForm({ ...emailForm, currentPassword: e.target.value })}
                required
              />
              <small>Confirms it's really you.</small>
            </div>

            <div>
              <button type="submit" className="lp-btn" disabled={savingEmail} aria-busy={savingEmail}>
                {savingEmail && <Spinner />}
                {savingEmail ? "Saving..." : "Change Email"}
              </button>
            </div>
          </form>
        </div>

        <div className="lp-card">
          <h2>Change password</h2>
          <p className="lp-card-subtitle">Use at least 6 characters.</p>

          {passwordError && <div className="lp-alert error">{passwordError}</div>}

          <form className="lp-form" onSubmit={changePassword}>
            <div className="lp-field">
              <label>Current password</label>
              <input
                type="password"
                autoComplete="current-password"
                value={passwordForm.currentPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                required
              />
            </div>

            <div className="lp-field">
              <label>New password</label>
              <input
                type="password"
                autoComplete="new-password"
                minLength={6}
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                required
              />
            </div>

            <div className="lp-field">
              <label>Confirm new password</label>
              <input
                type="password"
                autoComplete="new-password"
                minLength={6}
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                required
              />
            </div>

            <div>
              <button
                type="submit"
                className="lp-btn"
                disabled={savingPassword}
                aria-busy={savingPassword}
              >
                {savingPassword && <Spinner />}
                {savingPassword ? "Saving..." : "Change Password"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AdminAccount;
