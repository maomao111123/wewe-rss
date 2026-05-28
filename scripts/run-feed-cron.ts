import { refreshAllMpArticlesAndUpdateFeed } from "../src/lib/services/platform-service";

async function main() {
  await refreshAllMpArticlesAndUpdateFeed();
}

main()
  .then(() => {
    console.log("feed cron completed");
  })
  .catch((error) => {
    console.error("feed cron failed", error);
    process.exit(1);
  });
