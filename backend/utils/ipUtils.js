// IP helpers for the shop network restriction.
// Supports exact addresses (IPv4 or IPv6) and IPv4 ranges in CIDR form
// (e.g. 192.168.1.0/24 for every device on a typical shop router).

const normalizeIp = (ip) => {
  if (!ip) return "";
  let value = String(ip).trim();

  // IPv4 mapped into IPv6 (::ffff:203.0.113.5)
  if (value.toLowerCase().startsWith("::ffff:") && value.includes(".")) {
    value = value.slice(7);
  }

  // Local machine
  if (value === "::1") return "127.0.0.1";

  return value.toLowerCase();
};

// The address the request came from. Uses Express's req.ip, which only
// trusts X-Forwarded-For when "trust proxy" is configured (see server.js),
// so employees cannot fake the shop's address with a header.
const getClientIp = (req) => normalizeIp(req.ip || req.socket?.remoteAddress || "");

const ipv4ToNumber = (ip) => {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;

  let result = 0;

  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const number = Number(part);
    if (number > 255) return null;
    result = result * 256 + number;
  }

  return result;
};

const isValidIpv4 = (ip) => ipv4ToNumber(ip) !== null;

const isValidIpv6 = (ip) => /^[0-9a-f:]+$/i.test(ip) && ip.includes(":") && ip.length <= 39;

// Accepts "203.0.113.5", "192.168.1.0/24", or an IPv6 address
const isValidNetwork = (value) => {
  const input = normalizeIp(value);
  if (!input) return false;

  if (input.includes("/")) {
    const [base, bits] = input.split("/");
    const prefix = Number(bits);
    return isValidIpv4(base) && /^\d{1,2}$/.test(bits) && prefix >= 8 && prefix <= 32;
  }

  return isValidIpv4(input) || isValidIpv6(input);
};

const ipMatches = (ip, network) => {
  const address = normalizeIp(ip);
  const rule = normalizeIp(network);
  if (!address || !rule) return false;

  if (!rule.includes("/")) {
    return address === rule;
  }

  const [base, bits] = rule.split("/");
  const prefix = Number(bits);
  const addressNumber = ipv4ToNumber(address);
  const baseNumber = ipv4ToNumber(base);

  if (addressNumber === null || baseNumber === null) return false;

  const blockSize = 2 ** (32 - prefix);
  return Math.floor(addressNumber / blockSize) === Math.floor(baseNumber / blockSize);
};

const isAllowedIp = (ip, networks = []) =>
  networks.some((network) => ipMatches(ip, network.address || network));

module.exports = {
  normalizeIp,
  getClientIp,
  isValidNetwork,
  ipMatches,
  isAllowedIp,
};
