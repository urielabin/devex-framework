import { WORK_ID_REGEX, BRANCH_NAME_REGEX, COMMIT_MSG_REGEX } from "../src/conventions";

describe("WORK_ID_REGEX", () => {
  it("matches FIN-123", () => {
    expect(WORK_ID_REGEX.test("FIN-123")).toBe(true);
  });

  it("matches PLAT-9", () => {
    expect(WORK_ID_REGEX.test("PLAT-9")).toBe(true);
  });

  it("matches multi-char prefix ABC-1000", () => {
    expect(WORK_ID_REGEX.test("ABC-1000")).toBe(true);
  });

  it("rejects lowercase prefix fin-123", () => {
    expect(WORK_ID_REGEX.test("fin-123")).toBe(false);
  });

  it("rejects no number FIN", () => {
    expect(WORK_ID_REGEX.test("FIN")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(WORK_ID_REGEX.test("")).toBe(false);
  });
});

describe("BRANCH_NAME_REGEX", () => {
  it("matches feat/FIN-123-add-feature", () => {
    expect(BRANCH_NAME_REGEX.test("feat/FIN-123-add-feature")).toBe(true);
  });

  it("matches fix/PLAT-99-bugfix-auth", () => {
    expect(BRANCH_NAME_REGEX.test("fix/PLAT-99-bugfix-auth")).toBe(true);
  });

  it("matches chore/FIN-1-update-deps", () => {
    expect(BRANCH_NAME_REGEX.test("chore/FIN-1-update-deps")).toBe(true);
  });

  it("rejects main", () => {
    expect(BRANCH_NAME_REGEX.test("main")).toBe(false);
  });

  it("rejects branch without work id", () => {
    expect(BRANCH_NAME_REGEX.test("feat/my-feature")).toBe(false);
  });

  it("rejects invalid type", () => {
    expect(BRANCH_NAME_REGEX.test("feature/FIN-123-test")).toBe(false);
  });
});

describe("COMMIT_MSG_REGEX", () => {
  it("matches [FIN-123] in commit message", () => {
    expect(COMMIT_MSG_REGEX.test("[FIN-123] add payment endpoint")).toBe(true);
  });

  it("matches bare FIN-123 in commit message", () => {
    expect(COMMIT_MSG_REGEX.test("FIN-123: add payment endpoint")).toBe(true);
  });

  it("does not match message with no work id", () => {
    expect(COMMIT_MSG_REGEX.test("fix typo in readme")).toBe(false);
  });
});
