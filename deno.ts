import { EmitterWebhookEventName, octokit, webhooks } from "./api.ts";
import { Config } from "./Config.ts";
import * as lgtm from "./lgtm.ts";
import config from "./config.js";
const c = config as Config;

const {
  data: { login },
} = await octokit.rest.users.getAuthenticated();
console.log("Hello, %s", login);

const repos = c.repos || [];
webhooks.on(
  [
    "pull_request",
    "pull_request.opened",
    "pull_request.synchronize",
    // "pull_request.synchronized", // gitea
    "pull_request.review_requested",
    "pull_request.review_request_removed",
    "pull_request_review",
  ],
  ({ id, name, payload }) => {
    if (
      repos.some(
        (repo) =>
          repo.owner == payload.repository.owner.login &&
          repo.repo == payload.repository.name,
      )
    ) {
      console.info(`Trigger pr status and label  by ${id} ${name}`);
      lgtm.setPrStatusAndLabel(payload.pull_request);
    }
  },
);

for (const repo of repos) {
  try {
    const it = octokit.paginate.iterator(octokit.rest.pulls.list, {
      owner: repo.owner,
      repo: repo.repo,
      state: "open",
      per_page: 100,
    });
    for await (const { data: prs } of it) {
      for (const pr of prs) {
        lgtm.setPrStatusAndLabel(pr);
      }
    }
  } catch (e) {
    console.error(`[${repo.owner}/${repo.repo}] Failed to label pr.`, e);
  }
}

Deno.serve(c.webhooks, async (req: Request) => {
  if (req.url.endsWith("/webhooks") && req.method === "POST") {
    const requestBody = await req.text();
    const signature = req.headers.get("x-hub-signature-256");
    if (!signature) {
      return Response.json({ message: "Missing signature" }, { status: 400 });
    }

    // parse webhook
    const id = req.headers.get("x-github-delivery");
    const name = req.headers.get("x-github-event") as EmitterWebhookEventName;
    if (!id || !name) {
      return Response.json(
        { message: "Invalid GitHub webhook" },
        {
          status: 400,
        },
      );
    }
    try {
      await webhooks.verifyAndReceive({
        id,
        name,
        payload: requestBody,
        signature: signature,
      });
    } catch (error) {
      return Response.json(
        { message: error.message.trim().split("\n")[0] },
        { status: 400 },
      );
    }

    return Response.json({ message: "Webhook received" });
  } else {
    return Response.json({ message: "Bad path" }, { status: 400 });
  }
});
