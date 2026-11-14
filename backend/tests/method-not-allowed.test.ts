import assert from "node:assert/strict";
import express from "express";
import { describe, it } from "node:test";

import {
  methodNotAllowed,
} from "../src/middlewares/methodNotAllowed";

describe("Middleware methodNotAllowed", () => {

  it("deve retornar 405 para métodos não permitidos", async () => {
    const app = express();

    app.all(
      "/resource",
      methodNotAllowed(["GET", "HEAD", "OPTIONS"])
    );

    const server = app.listen(0, "127.0.0.1");

    try {
      await new Promise<void>((resolve, reject) => {
        server.once("listening", resolve);
        server.once("error", reject);
      });

      const address = server.address();

      assert.ok(address && typeof address !== "string");

      const response = await fetch(
        `http://127.0.0.1:${address.port}/resource`,
        { method: "POST" }
      );

      const body = await response.json() as {
        erro: string;
        metodo: string;
        metodosPermitidos: string[];
      };

      assert.equal(response.status, 405);

      assert.equal(
        response.headers.get("allow"),
        "GET, HEAD, OPTIONS"
      );

      assert.equal(
        body.erro,
        "Método HTTP não permitido"
      );

      assert.equal(body.metodo, "POST");

      assert.deepEqual(
        body.metodosPermitidos,
        ["GET", "HEAD", "OPTIONS"]
      );

    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) =>
          error ? reject(error) : resolve()
        );
      });
    }
  });

  it("deve responder 204 para OPTIONS", async () => {
    const app = express();

    app.all(
      "/resource",
      methodNotAllowed(["GET", "OPTIONS"])
    );

    const server = app.listen(0, "127.0.0.1");

    try {
      await new Promise<void>((resolve, reject) => {
        server.once("listening", resolve);
        server.once("error", reject);
      });

      const address = server.address();

      assert.ok(address && typeof address !== "string");

      const response = await fetch(
        `http://127.0.0.1:${address.port}/resource`,
        { method: "OPTIONS" }
      );

      assert.equal(response.status, 204);

      assert.equal(
        response.headers.get("allow"),
        "GET, OPTIONS"
      );

    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) =>
          error ? reject(error) : resolve()
        );
      });
    }
  });

});