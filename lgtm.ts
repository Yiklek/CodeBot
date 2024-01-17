import { octokit } from "./api.ts";
import { addLabels, getPrReviewers } from "./gitea.ts";
import { default as pack } from "./package.json" assert { type: "json" };

export const setPrStatusAndLabel = async (pr: {
  labels: { id: number; name: string }[];
  head: { sha: string };
  base: { repo: { owner: { login: string }; name: string } };
  title: string;
  number: number;
  requested_reviewers: ({ login: string } | { name: string })[] | undefined;
}) => {
  let reviewers;
  const repo = `${pr.base.repo.owner.login}/${pr.base.repo.name}`;
  try {
    reviewers = await getPrReviewers({
      owner: pr.base.repo.owner.login,
      repo: pr.base.repo.name,
      pr: pr.number,
      requested_reviewers: pr.requested_reviewers || [],
    });
  } catch (error) {
    console.error(error);
    return;
  }

  const { state, message, desiredLabel } = getPrStatusAndLabel(reviewers);
  const currentLgtmLabels = pr.labels.filter((l) => l.name.startsWith("lgtm/"));

  console.info(
    `[${repo}] "${pr.title}" (#${pr.number}) state: ${state}, message: ${message}, target_label: ${desiredLabel}, current_labels: %s`,
    currentLgtmLabels.map((l) => l.name),
  );
  currentLgtmLabels
    .filter((l) => l.name !== desiredLabel)
    .forEach(async (label) => {
      try {
        await octokit.rest.issues.removeLabel({
          owner: pr.base.repo.owner.login,
          repo: pr.base.repo.name,
          issue_number: pr.number,
          name: String(label.id),
        });
        console.info(
          `[${repo}] Removed ${label.name} from "${pr.title}" (#${pr.number})`,
        );
      } catch (e) {
        console.error(
          `[${repo}] Failed to remove ${label.name} from "${pr.title}" (#${pr.number})`,
        );
        console.error(e);
      }
    });

  try {
    if (!currentLgtmLabels.some((label) => label.name === desiredLabel)) {
      await addLabels({
        owner: pr.base.repo.owner.login,
        repo: pr.base.repo.name,
        issue_number: pr.number,
        labels: [desiredLabel],
      });
      console.info(
        `[${repo}] Add label: ${desiredLabel} in "${pr.title}" (#${pr.number})`,
      );
    }
  } catch (e) {
    console.error(
      `[${repo}] Failed to add label: ${desiredLabel} in  "${pr.title}" (#${pr.number})`,
    );
    console.error(e);
  }
  try {
    await octokit.rest.repos.createCommitStatus({
      owner: pr.base.repo.owner.login,
      repo: pr.base.repo.name,
      sha: pr.head.sha,
      state: state,
      description: message,
      context: `${pack.name}/lgtm`,
    });

    console.info(
      `[${repo}] Set commit status in "${pr.title}" (#${pr.number})`,
    );
  } catch (e) {
    console.error(
      `[${repo}] Failed to set commit status in  "${pr.title}" (#${pr.number})`,
    );
    console.error(e);
  }
};

// returns the status, message, and label for a given number of approvals
export const getPrStatusAndLabel = (reviewers: {
  approvers: Set<string>;
  blockers: Set<string>;
}) => {
  let desiredLabel = "lgtm/need 2";
  let message = "Needs two more approvals";
  let state: "pending" | "success" | "failure" = "pending";

  if (reviewers.blockers.size > 0) {
    desiredLabel = "lgtm/blocked";
    message = "Blocked by " + Array.from(reviewers.blockers).join(", ");
    state = "failure";
    return { state, message, desiredLabel };
  }

  if (reviewers.approvers.size === 1) {
    desiredLabel = "lgtm/need 1";
    message = "Needs one more approval";
  }

  if (reviewers.approvers.size >= 2) {
    desiredLabel = "lgtm/done";
    message = `Approved by ${reviewers.approvers.size} people`;
    state = "success";
  }

  return { state, message, desiredLabel };
};
