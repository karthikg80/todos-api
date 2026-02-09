import { isValidEmail } from "./authValidation";

describe("Auth validation", () => {
  describe("isValidEmail", () => {
    it("accepts common valid email formats", () => {
      expect(isValidEmail("user@example.com")).toBe(true);
      expect(isValidEmail("user.name+tag@example.co.uk")).toBe(true);
      expect(isValidEmail("u_ser-1@sub.example.io")).toBe(true);
    });

    it("rejects malformed addresses", () => {
      expect(isValidEmail("plainaddress")).toBe(false);
      expect(isValidEmail("@example.com")).toBe(false);
      expect(isValidEmail("user@")).toBe(false);
      expect(isValidEmail("user..dots@example.com")).toBe(false);
      expect(isValidEmail("user@-example.com")).toBe(false);
      expect(isValidEmail("user@example-.com")).toBe(false);
      expect(isValidEmail("user@example.c")).toBe(false);
      expect(isValidEmail("user@exa_mple.com")).toBe(false);
    });
  });
});
