import assert from "node:assert/strict";
import test from "node:test";
import { clientAddress } from "./rate-limit.js";

function withProxyTrust(value, callback) {
  const previous = process.env.TRUST_PROXY;
  if (value === undefined) delete process.env.TRUST_PROXY;
  else process.env.TRUST_PROXY = value;
  try {
    callback();
  } finally {
    if (previous === undefined) delete process.env.TRUST_PROXY;
    else process.env.TRUST_PROXY = previous;
  }
}

test("does not trust forwarded addresses unless the ingress is configured", () => {
  withProxyTrust(undefined, () => {
    const request = new Request("http://localhost", {
      headers: { "x-forwarded-for": "203.0.113.10" },
    });
    assert.equal(clientAddress(request), "unknown");
    assert.equal(clientAddress(request, "account-123"), "account-123");
  });
});

test("uses only the first forwarded address when proxy trust is enabled", () => {
  withProxyTrust("true", () => {
    const request = new Request("http://localhost", {
      headers: { "x-forwarded-for": " 203.0.113.10 , 10.0.0.2" },
    });
    assert.equal(clientAddress(request), "203.0.113.10");
  });
});

test("uses the account fallback when a trusted proxy omits the address", () => {
  withProxyTrust("true", () => {
    const request = new Request("http://localhost");
    assert.equal(clientAddress(request, "account-123"), "account-123");
  });
});
