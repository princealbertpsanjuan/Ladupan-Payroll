import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/axios";
import { useToast } from "../../context/ToastContext";
import Spinner from "../../components/Spinner";
import "../../styles/myaccount.css";

const emptyPasswordForm = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

const MyAccount = () => {
  const { user, refreshUser } = useAuth();
  const toast = useToast();

  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [passwordForm, setPasswordForm] = useState(emptyPasswordForm);
  const [passwordMessage, setPasswordMessage] = useState({ type: "", text: "" });
  const [saving, setSaving] = useState(false);

  // Show the latest rate and schedule set by the admin
  useEffect(() => {
    refreshUser().catch(() => {});
  }, []);

  const handlePasswordChange = (e) => {
    setPasswordForm({ ...passwordForm, [e.target.name]: e.target.value });
  };

  const changePassword = async (e) => {
    e.preventDefault();
    setPasswordMessage({ type: "", text: "" });

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordMessage({ type: "error", text: "New passwords do not match." });
      return;
    }

    try {
      setSaving(true);

      const res = await api.put("/auth/change-password", {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });

      toast.success(res.data.message, { title: "Password updated" });
      setPasswordForm(emptyPasswordForm);
      setShowPasswordForm(false);
    } catch (error) {
      setPasswordMessage({
        type: "error",
        text: error.response?.data?.message || "Failed to change password.",
      });
    } finally {
      setSaving(false);
    }
  };

  const formatMoney = (value) => {
    return `₱${Number(value || 0).toFixed(2)}`;
  };

  return (
    <div className="myaccount-page">
      <div className="myaccount-header">
        <div>
          <h1>My Account</h1>
          <p>View your employee account and payroll settings.</p>
        </div>
      </div>

      <div className="myaccount-card">
        <div className="profile-section">
          <div className="profile-avatar">
            {(user?.firstName?.[0] || "E").toUpperCase()}
          </div>

          <div>
            <h2>
              {user?.firstName || "Employee"} {user?.lastName || ""}
            </h2>
            <p>{user?.email || "No email available"}</p>
          </div>
        </div>

        <div className="account-grid">
          <div className="account-info-box">
            <span>Employee ID</span>
            <strong>{user?.employeeId || "-"}</strong>
          </div>

          <div className="account-info-box">
            <span>Full Name</span>
            <strong>
              {user?.firstName || "-"} {user?.lastName || ""}
            </strong>
          </div>

          <div className="account-info-box">
            <span>Email Address</span>
            <strong>{user?.email || "-"}</strong>
          </div>

          <div className="account-info-box">
            <span>Role</span>
            <strong>
              {user?.role === "admin" ? "Administrator" : user?.role ? "Employee" : "-"}
            </strong>
          </div>

          <div className="account-info-box">
            <span>Hourly Rate</span>
            <strong>{formatMoney(user?.hourlyRate)}</strong>
          </div>

          <div className="account-info-box">
            <span>Required Time In</span>
            <strong>{user?.requiredTimeIn || "-"}</strong>
          </div>

          <div className="account-info-box">
            <span>Account Status</span>
            <strong>{user?.isActive === false ? "Inactive" : "Active"}</strong>
          </div>
        </div>
      </div>

      <div className="myaccount-card">
        <h2 className="settings-title">Settings</h2>

        <div className="settings-list">
          <div className="setting-row">
            <div>
              <h3>Password</h3>
              <p>Change the password you use to sign in.</p>
            </div>

            <button onClick={() => setShowPasswordForm(!showPasswordForm)}>
              {showPasswordForm ? "Cancel" : "Change Password"}
            </button>
          </div>

          {passwordMessage.text && (
            <div className={`lp-alert ${passwordMessage.type}`}>
              {passwordMessage.text}
            </div>
          )}

          {showPasswordForm && (
            <form className="lp-form" onSubmit={changePassword} style={{ maxWidth: 420 }}>
              <div className="lp-field">
                <label>Current Password</label>
                <input
                  type="password"
                  name="currentPassword"
                  value={passwordForm.currentPassword}
                  onChange={handlePasswordChange}
                  required
                />
              </div>

              <div className="lp-field">
                <label>New Password</label>
                <input
                  type="password"
                  name="newPassword"
                  value={passwordForm.newPassword}
                  onChange={handlePasswordChange}
                  minLength={6}
                  required
                />
                <small>At least 6 characters.</small>
              </div>

              <div className="lp-field">
                <label>Confirm New Password</label>
                <input
                  type="password"
                  name="confirmPassword"
                  value={passwordForm.confirmPassword}
                  onChange={handlePasswordChange}
                  minLength={6}
                  required
                />
              </div>

              <div>
                <button type="submit" className="lp-btn" disabled={saving} aria-busy={saving}>
                  {saving && <Spinner />}
                  {saving ? "Saving..." : "Save New Password"}
                </button>
              </div>
            </form>
          )}

          <div className="setting-row">
            <div>
              <h3>Payroll Settings</h3>
              <p>Your hourly rate and required time-in are managed by the admin.</p>
            </div>

            <button disabled>Locked</button>
          </div>

          <div className="setting-row">
            <div>
              <h3>Account Information</h3>
              <p>Your employee profile is connected to Ladupan payroll records.</p>
            </div>

            <button disabled>View Only</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MyAccount;