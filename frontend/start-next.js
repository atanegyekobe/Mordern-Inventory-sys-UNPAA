const http = require("http");
const next = require("next");

const port = Number(process.env.FRONTEND_PORT || 3000);
const hostname = process.env.HOSTNAME || "127.0.0.1";

const app = next({
  dev: false,
  dir: __dirname,
});

const handle = app.getRequestHandler();

app
  .prepare()
  .then(() => {
    const server = http.createServer((req, res) => {
      handle(req, res);
    });

    server.listen(port, hostname, () => {
      // eslint-disable-next-line no-console
      console.log(`Embedded Next server running at http://${hostname}:${port}`);
    });
  })
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error("Failed to start embedded Next server", error);
    process.exit(1);
  });
