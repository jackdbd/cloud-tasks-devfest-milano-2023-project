import { fastify } from "fastify";
import { FastifySSEPlugin } from "fastify-sse-v2";

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const event_source = async function* source() {
  for (let i = 0; i < 10; i++) {
    await sleep(2000);
    yield { id: String(i), data: "Some message" };
  }
};

export const app = async () => {
  const server = fastify({ logger: true });
  server.register(FastifySSEPlugin);

  server.get("/", (_req, reply) => {
    reply.header("Access-Control-Allow-Origin", "*");
    reply.header("Access-Control-Allow-Methods", "GET");

    reply.send({ hello: "world" });
  });

  server.get("/sse", function (_req, reply) {
    reply.header("Access-Control-Allow-Origin", "*");
    reply.header("Access-Control-Allow-Methods", "GET");

    reply.sse(event_source());
  });

  return { server };
};
