import { useEffect, useState } from "react";
import api from "../../api/axios";
import { useToast } from "../../context/ToastContext";
import Icon from "../../components/Icon";
import Spinner from "../../components/Spinner";
import { SkeletonBlock } from "../../components/Skeleton";
import { formatDateTime } from "../../utils/format";

// Admin settings: allow Time In / Time Out only from the shop's network.
const ShopNetwork = () => {
  const toast = useToast();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [currentLabel, setCurrentLabel] = useState("Shop Wi-Fi");
  const [manual, setManual] = useState({ address: "", label: "" });
  const [manualError, setManualError] = useState("");

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await api.get("/settings/network");
      setData(res.data);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to load network settings.");
    } finally {
      setLoading(false);
    }
  };

  const applyResponse = (res) => {
    setData((current) => ({ ...current, ...res.data }));
  };

  const toggleRestriction = async () => {
    const enabled = !data.restrictAttendanceNetwork;

    try {
      setBusy("toggle");
      const res = await api.put("/settings/network/restriction", { enabled });
      applyResponse(res);
      toast.success(
        enabled
          ? "Employees can now time in and out only on the shop network."
          : "Employees can time in and out from any network.",
        { title: enabled ? "Restriction turned on" : "Restriction turned off" }
      );
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update the setting.");
    } finally {
      setBusy("");
    }
  };

  const addNetwork = async (address, label, source) => {
    try {
      setBusy(source);
      setManualError("");
      const res = await api.post("/settings/network/allowed", { address, label });
      applyResponse(res);
      toast.success(`${address} was added as an allowed network.`);

      if (source === "manual") setManual({ address: "", label: "" });
    } catch (error) {
      const message = error.response?.data?.message || "Failed to add network.";
      if (source === "manual") setManualError(message);
      else toast.error(message);
    } finally {
      setBusy("");
    }
  };

  const removeNetwork = async (network) => {
    if (!window.confirm(`Remove ${network.address} (${network.label}) from the allowed networks?`)) {
      return;
    }

    try {
      setBusy(network._id);
      const res = await api.delete(`/settings/network/allowed/${network._id}`);
      applyResponse(res);
      toast.success(`${network.address} was removed.`);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to remove network.");
    } finally {
      setBusy("");
    }
  };

  const enabled = Boolean(data?.restrictAttendanceNetwork);
  const networks = data?.allowedNetworks || [];

  return (
    <div className="lp-page">
      <div className="lp-header">
        <div>
          <h1>Shop Network</h1>
          <p>
            Allow employees to Time In and Time Out only while connected to the
            shop Wi-Fi. They can still view their records from anywhere.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="lp-card">
          <SkeletonBlock lines={4} />
        </div>
      ) : (
        data && (
          <>
            <div className={`lp-card network-status-card${enabled ? " is-on" : ""}`}>
              <div className="network-status-main">
                <span className={`card-icon ${enabled ? "dark" : ""}`}>
                  <Icon name={enabled ? "wifi" : "wifiOff"} />
                </span>

                <div>
                  <h2>{enabled ? "Restriction is ON" : "Restriction is OFF"}</h2>
                  <p>
                    {enabled
                      ? `Time In / Time Out works only from ${networks.length} allowed network${networks.length !== 1 ? "s" : ""}. Attempts from anywhere else are blocked and you are notified.`
                      : "Employees can Time In / Time Out from any network."}
                  </p>
                </div>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={enabled}
                className={`lp-switch${enabled ? " is-on" : ""}`}
                onClick={toggleRestriction}
                disabled={busy === "toggle" || (!enabled && networks.length === 0)}
                title={!enabled && networks.length === 0 ? "Add the shop network first" : undefined}
              >
                <span className="lp-switch-knob">{busy === "toggle" && <Spinner />}</span>
                <span className="sr-only">Restrict Time In / Time Out to the shop network</span>
              </button>
            </div>

            <div className="lp-card">
              <h2>Your current connection</h2>
              <p className="lp-card-subtitle">
                Open this page on a device connected to the shop Wi-Fi, then add
                this network.
              </p>

              <div className="current-network">
                <div>
                  <span className="lp-muted">Connected from</span>
                  <strong className="current-ip">{data.currentIp || "Unknown"}</strong>
                  {data.currentIpAllowed ? (
                    <span className="lp-badge approved">Allowed</span>
                  ) : (
                    <span className="lp-badge pending">Not in the allowed list</span>
                  )}
                </div>

                {!data.currentIpAllowed && data.currentIp && (
                  <div className="current-network-add">
                    <input
                      type="text"
                      value={currentLabel}
                      onChange={(e) => setCurrentLabel(e.target.value)}
                      placeholder="Label, e.g. Shop Wi-Fi"
                      aria-label="Label for this network"
                    />
                    <button
                      type="button"
                      className="lp-btn"
                      onClick={() => addNetwork(data.currentIp, currentLabel, "current")}
                      disabled={busy === "current"}
                      aria-busy={busy === "current"}
                    >
                      {busy === "current" && <Spinner />}
                      Add this network
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="lp-card">
              <h2>Allowed networks</h2>

              <div className="lp-table-wrap">
                <table className="lp-table">
                  <thead>
                    <tr>
                      <th>IP address / range</th>
                      <th>Label</th>
                      <th>Added</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {networks.length > 0 ? (
                      networks.map((network) => (
                        <tr key={network._id}>
                          <td>
                            <strong>{network.address}</strong>
                            {network.address === data.currentIp && (
                              <span className="lp-muted"> · this device</span>
                            )}
                          </td>
                          <td>{network.label || "-"}</td>
                          <td className="lp-muted">{formatDateTime(network.addedAt)}</td>
                          <td>
                            <button
                              type="button"
                              className="lp-btn secondary small"
                              onClick={() => removeNetwork(network)}
                              disabled={busy === network._id}
                              aria-busy={busy === network._id}
                            >
                              {busy === network._id && <Spinner />}
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="4" className="lp-empty">
                          No networks yet. Add the shop network above.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <details className="manual-network">
                <summary>Add an IP address or range manually</summary>

                {manualError && <div className="lp-alert error">{manualError}</div>}

                <form
                  className="lp-form-grid manual-network-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    addNetwork(manual.address, manual.label, "manual");
                  }}
                >
                  <div className="lp-field">
                    <label>IP address or range</label>
                    <input
                      type="text"
                      placeholder="e.g. 203.0.113.5 or 192.168.1.0/24"
                      value={manual.address}
                      onChange={(e) => setManual({ ...manual, address: e.target.value })}
                      required
                    />
                  </div>

                  <div className="lp-field">
                    <label>Label</label>
                    <input
                      type="text"
                      placeholder="e.g. Shop Wi-Fi"
                      value={manual.label}
                      onChange={(e) => setManual({ ...manual, label: e.target.value })}
                    />
                  </div>

                  <div>
                    <button
                      type="submit"
                      className="lp-btn"
                      disabled={busy === "manual"}
                      aria-busy={busy === "manual"}
                    >
                      {busy === "manual" && <Spinner />}
                      Add network
                    </button>
                  </div>
                </form>
              </details>
            </div>

            <div className="lp-alert info">
              <strong>Good to know:</strong> most internet providers can change the
              shop's IP address, for example after the router restarts. If
              employees suddenly can't time in at the shop, open this page on the
              shop Wi-Fi and click <strong>Add this network</strong> again.
            </div>

            <div className="lp-card">
              <h2>Recent blocked attempts</h2>

              <div className="lp-table-wrap">
                <table className="lp-table">
                  <thead>
                    <tr>
                      <th>When</th>
                      <th>Employee</th>
                      <th>Attempt</th>
                      <th>IP address</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentBlocked?.length > 0 ? (
                      data.recentBlocked.map((log) => (
                        <tr key={log._id}>
                          <td className="lp-nowrap">{formatDateTime(log.createdAt)}</td>
                          <td>{log.actorName}</td>
                          <td>{log.details?.action === "time out" ? "Time Out" : "Time In"}</td>
                          <td>{log.details?.ip || "-"}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="4" className="lp-empty">
                          No blocked attempts.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )
      )}
    </div>
  );
};

export default ShopNetwork;
