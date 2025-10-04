// __tests__/AccountCreationTests.test.tsx
/**
 * What:
 *   Tests for AccountCreationScreen (via AccountForm).
 *
 * Why:
 *   - Validate client-side guards (empty fields, mismatch, weak password)
 *   - Verify happy path calls createUser with the right payload
 *   - Confirm we navigate away on success
 */

import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";

import AccountCreationScreen from "../src/features/account/screens/AccountCreationScreen";

// If AccountForm or screen ever uses AsyncStorage, keep this mock (harmless otherwise).
jest.mock(
  "@react-native-async-storage/async-storage",
  () => require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

// Mock API used by the form/screen
jest.mock("../src/lib/api", () => ({
  __esModule: true,
  createUser: jest.fn(),
}));
import { createUser } from "../src/lib/api";

const makeNav = () => ({ goBack: jest.fn(), navigate: jest.fn() });

/** Helper to render with minimal navigation prop */
const renderScreen = (nav = makeNav()) => ({
  ...render(<AccountCreationScreen navigation={nav as any} />),
  nav,
});

/** Robust helper: find the "Create Account" CTA, not the header text */
function getCreateAccountButton() {
  // Best: use role=button with accessible name
  const byRole = screen.queryByRole?.("button", { name: /create account/i });
  if (byRole) return byRole;

  // Fallback: disambiguate among multiple "Create Account" nodes
  const candidates = screen.getAllByText(/create account/i);
  // Prefer a node that has an onPress prop itself…
  const directPressable = candidates.find((inst: any) => inst?.props?.onPress);
  if (directPressable) return directPressable;

  // …or whose parent is the pressable (common with Text inside TouchableOpacity)
  const parentPressable = candidates.find((inst: any) => inst?.parent?.props?.onPress);
  if (parentPressable) return parentPressable.parent;

  // Last resort: return the first one
  return candidates[0];
}

describe("AccountCreationScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows validation when fields are empty", async () => {
    const { nav } = renderScreen();

    const createBtn = getCreateAccountButton();
    fireEvent.press(createBtn);

    expect(
      await screen.findByText(/fill out all fields|required/i)
    ).toBeTruthy();

    expect(nav.goBack).not.toHaveBeenCalled();
    expect(createUser).not.toHaveBeenCalled();
  });

  it("shows validation when passwords do not match", async () => {
    renderScreen();

    fireEvent.changeText(screen.getByPlaceholderText(/username/i), "demo");
    fireEvent.changeText(screen.getByPlaceholderText(/email/i), "demo@example.com");
    fireEvent.changeText(screen.getByPlaceholderText(/^password$/i), "Passw0rd!");
    fireEvent.changeText(screen.getByPlaceholderText(/confirm password/i), "Mismatch!");

    const createBtn = getCreateAccountButton();
    fireEvent.press(createBtn);

    expect(await screen.findByText(/do not match|match/i)).toBeTruthy();
    expect(createUser).not.toHaveBeenCalled();
  });

  it("shows validation for weak password", async () => {
    renderScreen();

    fireEvent.changeText(screen.getByPlaceholderText(/username/i), "demo");
    fireEvent.changeText(screen.getByPlaceholderText(/email/i), "demo@example.com");
    fireEvent.changeText(screen.getByPlaceholderText(/^password$/i), "weak");
    fireEvent.changeText(screen.getByPlaceholderText(/confirm password/i), "weak");

    const createBtn = getCreateAccountButton();
    fireEvent.press(createBtn);

    expect(await screen.findByText(/password.*(uppercase|symbol|8)/i)).toBeTruthy();
    expect(createUser).not.toHaveBeenCalled();
  });

  it("submits successfully and navigates back", async () => {
    (createUser as jest.Mock).mockResolvedValueOnce({ ok: true, user: { id: 1 } });

    const { nav } = renderScreen();

    fireEvent.changeText(screen.getByPlaceholderText(/username/i), "demo");
    fireEvent.changeText(screen.getByPlaceholderText(/email/i), "demo@example.com");
    fireEvent.changeText(screen.getByPlaceholderText(/^password$/i), "Passw0rd!");
    fireEvent.changeText(screen.getByPlaceholderText(/confirm password/i), "Passw0rd!");

    const createBtn = getCreateAccountButton();
    fireEvent.press(createBtn);

    await waitFor(() => {
      expect(createUser).toHaveBeenCalledWith({
        username: "demo",
        email: "demo@example.com",
        password: "Passw0rd!",
      });
      expect(nav.goBack).toHaveBeenCalled();
    });
  });

  it("surfaces server errors if the API rejects", async () => {
    (createUser as jest.Mock).mockRejectedValueOnce(new Error("Server error."));

    const { nav } = renderScreen();

    fireEvent.changeText(screen.getByPlaceholderText(/username/i), "demo");
    fireEvent.changeText(screen.getByPlaceholderText(/email/i), "demo@example.com");
    fireEvent.changeText(screen.getByPlaceholderText(/^password$/i), "Passw0rd!");
    fireEvent.changeText(screen.getByPlaceholderText(/confirm password/i), "Passw0rd!");

    const createBtn = getCreateAccountButton();
    fireEvent.press(createBtn);

    const inlineErr = await screen.findByText(/error|failed|server/i);
    expect(inlineErr).toBeTruthy();
    expect(nav.goBack).not.toHaveBeenCalled();
  });
});
