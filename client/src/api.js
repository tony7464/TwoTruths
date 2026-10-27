// Calls the Flask API. Vite forwards /api, and credentials sends the session cookie.
let onUnauthorized = () => {};

export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler;
}

export async function api(path, method = "GET", body) {
  const options = {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    method,
  };
  if (body !== undefined) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(path, options);
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (response.status === 401) {
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
