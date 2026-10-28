// Calls the Flask API. Vite forwards /api, and credentials sends the session cookie.
let onUnauthorized = () => {};

export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler;
}

export async function api(path, method = "GET", body, signal) {
  const options = {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    method,
    signal,
  };
  if (body !== undefined) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(path, options);
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  // A wrong password on account delete is also 401. Only a missing session
  // should clear the logged-in user, so the form can show the password error.
  const wrongAccountPassword = path === "/api/account"
    && method === "DELETE"
    && data?.error === "Password is incorrect.";
  if (response.status === 401 && !wrongAccountPassword) {
    onUnauthorized();
  }

  if (!response.ok) {
    throw new Error(data?.error || "Something went wrong.");
  }

  return data;
}

export async function run(setError, action) {
  setError("");
  try {
    return await action();
  } catch (err) {
    setError(err.message);
    return null;
  }
}
