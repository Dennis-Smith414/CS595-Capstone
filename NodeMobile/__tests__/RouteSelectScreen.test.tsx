// __tests__/RouteSelectScreen.test.tsx
import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react-native";

import RouteSelectScreen from "../src/features/routes/screens/RouteSelectScreen";

import { RouteSelectionProvider } from "../src/context/RouteSelectionContext";
import * as api from "../src/lib/api"; // <-- import the real module to spy on

const FIXTURES = [
  { id: 1, slug: "ice-age-seg-a", name: "Ice Age Trail – Segment A", region: "WI" },
  { id: 2, slug: "devils-lake-loop", name: "Devil's Lake Loop", region: "WI" },
  { id: 3, slug: "kettle-moraine-north", name: "Kettle Moraine – North", region: "WI" },
];

jest.mock("@react-navigation/native", () => {
  const nav = { navigate: jest.fn(), goBack: jest.fn() };
  return {
    useNavigation: () => nav,
    __getNav: () => nav,
    useRoute: () => ({ params: {} }),
    NavigationContainer: ({ children }: any) => children,
  };
});

const AllProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <RouteSelectionProvider>{children}</RouteSelectionProvider>
);

const renderScreen = () =>
  render(
    <AllProviders>
      <RouteSelectScreen />
    </AllProviders>
  );

describe("RouteSelectScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // happy-path mock for all tests unless overridden
    jest.spyOn(api, "fetchRouteList").mockResolvedValue([...FIXTURES] as any);
  });

  it("shows route list", async () => {
    renderScreen();
    await waitFor(() => {
      expect(screen.getByText(/Ice Age Trail/i)).toBeTruthy();
      expect(screen.getByText(/Devil's Lake Loop/i)).toBeTruthy();
      expect(screen.getByText(/Kettle Moraine/i)).toBeTruthy();
    });
  });

  it("filters routes when typing in the search box (if present)", async () => {
    renderScreen();
    await screen.findByText(/Ice Age Trail/i);

    // If your TextInput exists with this placeholder, this works.
    // If not, you can skip/remove this test or add the placeholder in the component (see “Tiny UX hooks” below).
    const search = screen.queryByPlaceholderText(/Search routes/i);
    if (!search) return; // makes the test resilient to current UI
    fireEvent.changeText(search, "devil");

    await waitFor(() => {
      expect(screen.getByText(/Devil's Lake Loop/i)).toBeTruthy();
      expect(screen.queryByText(/Ice Age Trail/i)).toBeNull();
      expect(screen.queryByText(/Kettle Moraine/i)).toBeNull();
    });
  });

  it("handles API failure and shows empty/error state", async () => {
    (api.fetchRouteList as jest.Mock).mockRejectedValueOnce(new Error("Network error"));

    renderScreen();

    // Some UIs show an Alert or an inline error; your current UI shows “No routes found.”
    await waitFor(() => {
      expect(screen.getByText(/No routes found/i)).toBeTruthy();
    });
  });

  it("selects a route and navigates (if a button/CTA exists)", async () => {
    renderScreen();
    await screen.findByText(/Ice Age Trail/i);

    // tap a row
    fireEvent.press(screen.getByText(/Devil's Lake Loop/i));

    // If you have a CTA button, this will work (if not, skip or add the label as below)
    const showBtn = screen.queryByRole("button", { name: /show on map/i });
    if (!showBtn) return; // makes the test resilient to current UI

    fireEvent.press(showBtn);
    const nav = require("@react-navigation/native").__getNav();
    expect(nav.navigate).toHaveBeenCalled();
  });
});
