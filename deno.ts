import { EmitterWebhookEventName, octokit, webhooks } from "./api.ts";
import config from "./config.js";
import * as lgtm from "./lgtm.ts";

const {
  data: { login },
} = await octokit.rest.users.getAuthenticated();
console.log("Hello, %s", login);

const repos = config.repos || [];
webhooks.on(
  [
    "pull_request.opened",
    "pull_request.synchronize",
    "pull_request.review_requested",
    "pull_request.review_request_removed",
    "pull_request_review",
  ],
  ({ payload }) => {
    if (
      repos.some(
        (repo) =>
          repo.owner == payload.repository.owner.login &&
          repo.repo == payload.repository.name,
      )
    ) {
      lgtm.setPrStatusAndLabel(payload.pull_request);
    }
  },
);

for (const repo of repos) {
  try {
    const prs = await octokit.rest.pulls.list({
      owner: repo.owner,
      repo: repo.repo,
      state: "open",
    });
    for (const pr of prs.data) {
      lgtm.setPrStatusAndLabel(pr);
    }
  } catch (e) {
    console.error(`[${repo.owner}/${repo.repo}] Failed to label pr.`, e);
  }
}

Deno.serve({ port: 3001 }, async (req: Request) => {
  if (req.url.endsWith("/webhooks") && req.method === "POST") {
    const requestBody = await req.text();
    const signature = req.headers.get("x-hub-signature-256");
    if (!signature) {
      return Response.json({ message: "Missing signature" }, { status: 400 });
    }
    const verified = await webhooks.verify(requestBody, signature);
    if (!verified) {
      return Response.json({ message: "Invalid signature" }, { status: 400 });
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

    await webhooks.verifyAndReceive({
      id,
      name,
      payload: requestBody,
      signature: signature,
    });

    return Response.json({ message: "Webhook received" });
  } else {
    return Response.json({ message: "Bad path" }, { status: 400 });
  }
});
