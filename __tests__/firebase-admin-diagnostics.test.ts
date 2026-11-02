import { getSafeFirestoreDiagnostic, logFirestoreFallback } from "@/lib/firebase/admin";

describe("safe Firestore diagnostics", () => {
  it("retains code, message and stack while redacting identifiers and credentials", () => {
    const error = Object.assign(
      new Error("5 NOT_FOUND: users/uid-private user@example.test token=sample-secret rzp_test_samplekey +1 555 111 2222"),
      { code: 5 }
    );
    error.stack = `${error.message}\n    at readUser (C:\\Users\\srinidhi\\ANX-CLUB-main\\src\\services\\userService.ts:4:2)`;

    const diagnostic = getSafeFirestoreDiagnostic(error);
    const serialized = JSON.stringify(diagnostic);

    expect(diagnostic.code).toBe(5);
    expect(diagnostic.message).toContain("5 NOT_FOUND");
    expect(diagnostic.message).toContain("users/[redacted-id]");
    expect(diagnostic.stack).toContain("C:\\Users\\[redacted]");
    expect(serialized).not.toContain("uid-private");
    expect(serialized).not.toContain("user@example.test");
    expect(serialized).not.toContain("sample-secret");
    expect(serialized).not.toContain("rzp_test_samplekey");
    expect(serialized).not.toContain("555 111 2222");
    expect(serialized).not.toContain("srinidhi");
  });

  it("includes sanitized error details for code-5 fallback warnings", () => {
    const error = Object.assign(new Error("5 NOT_FOUND: database missing"), { code: 5 });
    const warning = jest.spyOn(console, "warn").mockImplementation(() => undefined);

    logFirestoreFallback("Membership service", error);

    expect(warning).toHaveBeenCalledWith(
      "Membership service: Firestore returned NOT_FOUND (code 5); using mock fallback.",
      expect.objectContaining({ code: 5, message: expect.stringContaining("NOT_FOUND") })
    );
    warning.mockRestore();
  });

  it("redacts PEM blocks from Firebase initialization diagnostics", () => {
    const error = new Error("Invalid credential -----BEGIN PRIVATE KEY-----\nnot-a-real-key\n-----END PRIVATE KEY-----");

    const diagnostic = getSafeFirestoreDiagnostic(error);

    expect(diagnostic.message).toContain("[redacted-private-key]");
    expect(JSON.stringify(diagnostic)).not.toContain("not-a-real-key");
  });
});
