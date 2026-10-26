// Startup file for shared Node.js hosting (cPanel / Passenger / Hostinger "Node.js app").
// The app itself is an ES module, so load it with dynamic import. The host supplies PORT.
import("./.output/server/index.mjs").catch((err) => {
  console.error(err);
  process.exit(1);
});
