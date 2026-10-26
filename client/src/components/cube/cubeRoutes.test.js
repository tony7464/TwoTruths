import { expect, test } from "vitest";
import { faceToRoute, routeToFace } from "./cubeRoutes";

test("routes open the matching face", () => {
  expect(routeToFace("/login", false)).toBe("front");
  expect(routeToFace("/signup", false)).toBe("right");
  expect(routeToFace("/browse", false)).toBe("front");
  expect(routeToFace("/profile", false)).toBe("front");

  expect(routeToFace("/browse", true)).toBe("front");
  expect(routeToFace("/login", true)).toBe("front");
  expect(routeToFace("/profile", true)).toBe("back");
  expect(routeToFace("/inbox", true)).toBe("right");
  expect(routeToFace("/players", true)).toBe("left");
  expect(routeToFace("/", true)).toBe("front");
});

test("faces write the matching route", () => {
  expect(faceToRoute("front", false)).toBe("/login");
  expect(faceToRoute("right", false)).toBe("/signup");
  expect(faceToRoute("left", false)).toBe("/login");

  expect(faceToRoute("front", true)).toBe("/browse");
  expect(faceToRoute("back", true)).toBe("/profile");
  expect(faceToRoute("right", true)).toBe("/inbox");
  expect(faceToRoute("left", true)).toBe("/players");
});
