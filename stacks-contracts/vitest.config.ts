import { defineConfig } from "vitest/config";
import {
  getClarinetVitestsArgv,
  vitestSetupFilePath,
} from "@stacks/clarinet-sdk/vitest";

export default defineConfig({
  test: {
    environment: "clarinet",
    pool: "forks",
    isolate: false,
    fileParallelism: false,
    maxWorkers: 1,
    singleFork: true,
    setupFiles: [vitestSetupFilePath],
    environmentOptions: {
      clarinet: {
        ...getClarinetVitestsArgv(),
      },
    },
  },
});
