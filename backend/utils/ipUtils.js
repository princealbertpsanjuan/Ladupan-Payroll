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

// Expand an IPv6 address to 8 numbers (handles "::"). null if invalid.
const ipv6ToGroups = (ip) => {
  const value = String(ip).toLowerCase().split("%")[0];
  if (!/^[0-9a-f:]+$/.test(value) || !value.includes(":")) return null;

  const halves = value.split("::");
  if (halves.length > 2) return null;

  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missing = 8 - head.length - tail.length;

  if (halves.length === 1 && head.length !== 8) return null;
  if (halves.length === 2 && missing < 1) return null;

  const groups = [...head, ...Array(halves.length === 2 ? missing : 0).fill("0"), ...tail];
  if (groups.length !== 8 || groups.some((g) => !/^[0-9a-f]{1,4}$/.test(g))) return null;

  return groups.map((g) => parseInt(g, 16));
};

const isValidIpv6 = (ip) => ipv6ToGroups(ip) !== null;

// Same first `prefix` bits?
const ipv6InRange = (ip, base, prefix) => {
  const a = ipv6ToGroups(ip);
  const b = ipv6ToGroups(base);
  if (!a || !b) return false;

  for (let bit = 0; bit < prefix; bit += 16) {
    const index = bit / 16;
    const bits = Math.min(16, prefix - bit);
    const mask = (0xffff << (16 - bits)) & 0xffff;
    if ((a[index] & mask) !== (b[index] & mask)) return false;
  }

  return true;
};

// The network to save for a device's address:
// - IPv4: the exact address (the shop's public IP, or a local address)
// - IPv6: the /64 network, because devices use temporary IPv6 addresses
//   that change daily, but they share the shop's /64 prefix
const suggestNetworkFor = (ip) => {
  const address = normalizeIp(ip);
  const groups = ipv6ToGroups(address);
  if (!groups || address.includes(".")) return address;

  const prefix = groups.slice(0, 4).map((g) => g.toString(16)).join(":");
  return `${prefix}::/64`;
};

// Accepts "203.0.113.5", "192.168.1.0/24", or an IPv6 address
const isValidNetwork = (value) => {
  const input = normalizeIp(value);
  if (!input) return false;

  if (input.includes("/")) {
    const [base, bits] = input.split("/");
    const prefix = Number(bits);
    if (!/^\d{1,3}$/.test(bits)) return false;
    if (isValidIpv4(base)) return prefix >= 8 && prefix <= 32;
    if (isValidIpv6(base)) return prefix >= 32 && prefix <= 128;
    return false;
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

  if (isValidIpv6(base)) {
    return ipv6InRange(address, base, prefix);
  }

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
  suggestNetworkFor,
};
