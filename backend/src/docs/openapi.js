const bearer = [{ bearerAuth: [] }];
const ok = { description: "Success", content: { "application/json": { example: { message: "Success" } } } };
const error = { description: "Error response", content: { "application/json": { schema: { type: "object", properties: { error: { type: "string", example: "Invalid request" } } } } } };
const secured = (summary, method, path, body = null) => {
  const operation = { summary, security: bearer, responses: { 200: ok, 400: error, 401: error, 403: error, 404: error, 429: error } };
  if (method === "POST") operation.responses[201] = ok;
  if (body) operation.requestBody = { required: true, content: { "application/json": { schema: { type: "object", example: body } } } };
  return [path, { [method.toLowerCase()]: operation }];
};
const paths = Object.fromEntries([
 ["POST", "/api/auth/register", { name: "Engineer", email: "engineer@example.com", password: "Example1" }], ["POST", "/api/auth/login", { email: "admin@substationai.com", password: "••••••••" }], ["GET", "/api/auth/me"], ["PATCH", "/api/auth/password", { currentPassword: "old", newPassword: "newpass" }],
 ["GET", "/api/equipment"], ["GET", "/api/equipment/{id}"], ["GET", "/api/equipment/{id}/tests"], ["POST", "/api/equipment", { name: "Transformer" }], ["PUT", "/api/equipment/{id}", { name: "Transformer" }], ["DELETE", "/api/equipment/{id}"],
 ["GET", "/api/tests"], ["GET", "/api/tests/{id}"], ["POST", "/api/tests", { equipmentId: "uuid", name: "IR Test" }], ["PUT", "/api/tests/{id}", { name: "IR Test" }], ["DELETE", "/api/tests/{id}"],
 ["GET", "/api/documents"], ["GET", "/api/documents/{id}"], ["POST", "/api/documents"], ["DELETE", "/api/documents/{id}"], ["POST", "/api/documents/{id}/reingest"],
 ["POST", "/api/chat/sessions", { title: "New Chat" }], ["GET", "/api/chat/sessions"], ["GET", "/api/chat/sessions/{id}"], ["PATCH", "/api/chat/sessions/{id}", { title: "Inspection" }], ["DELETE", "/api/chat/sessions/{id}"], ["POST", "/api/chat", { question: "How do I test a transformer?", useCache: true }], ["POST", "/api/chat/stream", { question: "How do I test a transformer?", useCache: true }],
 ["GET", "/api/admin/stats"], ["GET", "/api/admin/users"], ["PATCH", "/api/admin/users/{id}/role", { role: "ENGINEER" }], ["DELETE", "/api/admin/users/{id}"],
].map(([method, path, body]) => secured(`${method} ${path}`, method, path, body)));
paths["/api/health"] = { get: { summary: "Health check", responses: { 200: { description: "API and database health" }, 503: error } } };
paths["/api/chat/stream"].post.responses = {
  200: {
    description: "Server-sent events: meta, token, sources, done; error on failure",
    content: { "text/event-stream": { example: `event: meta\ndata: {"sessionId":"uuid"}\n\nevent: token\ndata: {"text":"Answer text"}\n\nevent: sources\ndata: {"sources":[],"intent":"general","messageId":"uuid"}\n\nevent: done\ndata: {}\n\n` } },
  },
  400: error, 401: error, 403: error, 429: error,
};
export const openapi = { openapi: "3.0.3", info: { title: "SubstationAI Backend API", version: "1.0.0" }, servers: [{ url: "http://localhost:4000" }], components: { securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" } } }, paths };
