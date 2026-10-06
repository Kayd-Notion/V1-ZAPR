import "server-only";

// Message auth lives in auth-core (pure, unit-tested); server code imports it from here.
export * from "./auth-core";
