import { connect } from "./db.js";
import { createApp } from "./app.js";

const PORT = Number(process.env.PORT ?? 3000);

connect().then(() => {
  createApp().listen(PORT, () => {
    console.log(`▶ API Teloquent sur http://localhost:${PORT}`);
    console.log("  Base non initialisée ? Lancez : npm run fresh");
  });
});
