import { Webhooks } from "@octokit/webhooks";
export type { EmitterWebhookEventName } from "@octokit/webhooks";
import { Octokit } from "octokit";
import config from "./config.js";

export const octokit = new Octokit(config.api);

export const webhooks = new Webhooks(config.webhooks);
