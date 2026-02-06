export function parseJsonBody(event) {
  if (!event?.body) return {};
  try {
    return typeof event.body === "string" ? JSON.parse(event.body) : event.body;
  } catch {
    return null;
  }
}

export function parseJson(event) {
  if (!event?.body) return null;

  try {
    return typeof event.body === "string" ? JSON.parse(event.body) : event.body;
  } catch {
    const err = new Error("Invalid JSON body");
    err.statusCode = 400;
    throw err;
  }
}