// Logged out, only the auth faces have routes. Logged in, each side has its own URL.
export function routeToFace(pathname, loggedIn) {
  if (!loggedIn) {
    return pathname === "/signup" ? "right" : "front";
  }
  if (pathname === "/profile") return "back";
  if (pathname === "/inbox") return "right";
  if (pathname === "/players") return "left";
  return "front";
}

export function faceToRoute(face, loggedIn) {
  if (!loggedIn) {
    return face === "right" ? "/signup" : "/login";
  }
  if (face === "back") return "/profile";
  if (face === "right") return "/inbox";
  if (face === "left") return "/players";
  return "/browse";
}
