export function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "Content-Type,Authorization",
      "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS",
    },
    body: JSON.stringify(body),
  };
}

export const ok = (body) => json(200, body);
export const created = (body) => json(201, body);
export const bad = (message) => json(400, { message });
export const unauthorized = (message) => json(401, { message });
export const conflict = (message) => json(409, { message });
export const notFound = (message) => json(404, { message });