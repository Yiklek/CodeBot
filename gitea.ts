import { octokit } from "./api.ts";

export const getPrReviewers = async (req: {
  owner: string;
  repo: string;
  pr: number;
  requested_reviewers: ({ login: string } | { name: string })[];
}) => {
  // load all reviews
  const reviews: {
    state:
      | "APPROVED"
      | "CHANGES_REQUESTED"
      | "REQUEST_CHANGES" // gitea
      | "COMMENTED"
      | "DISMISSED"
      | "PENDING";
    user: { login: string };
    id: number;
    dismissed: boolean;
  }[] = [];

  const iterator = octokit.paginate.iterator(octokit.rest.pulls.listReviews, {
    owner: req.owner,
    repo: req.repo,
    pull_number: req.pr,
    per_page: 100,
  });

  // iterate through each response
  for await (const { data: results } of iterator) {
    reviews.push(...results);
  }

  // count approvers and blockers by replaying all reviews (they are already sorted)
  const approvers = new Set<string>();
  const blockers = new Set<string>();
  for (const review of reviews) {
    switch (review.state) {
      case "APPROVED":
        approvers.add(review.user.login);
        blockers.delete(review.user.login);
        break;
      case "DISMISSED":
        approvers.delete(review.user.login);
        blockers.delete(review.user.login);
        break;
      case "CHANGES_REQUESTED":
      case "REQUEST_CHANGES":
        approvers.delete(review.user.login);
        blockers.add(review.user.login);
        break;
      default:
        break;
    }
    if (review.dismissed) {
      approvers.delete(review.user.login);
      blockers.delete(review.user.login);
    }
  }
  for (const requestedReviewer of req.requested_reviewers) {
    const user = requestedReviewer as { login: string };
    if (user.login) {
      approvers.delete(user.login);
    }
    const team = requestedReviewer as { name: string };
    if (team.name) {
      approvers.delete(team.name);
    }
  }
  return { approvers, blockers };
};

export const removeLabel = async (req: {
  owner: string;
  repo: string;
  issue_number: number;
  name: string;
}) => {
  const labels = await octokit.rest.issues.listLabelsForRepo({
    owner: req.owner,
    repo: req.repo,
  });
  const label_ids = new Map<string, number>();
  for (const l of labels.data) {
    label_ids.set(l.name, l.id);
  }
  await octokit.rest.issues.removeLabel({
    owner: req.owner,
    repo: req.repo,
    issue_number: req.issue_number,
    name: label_ids.get(req.name),
  });
};

export const addLabels = async (req: {
  owner: string;
  repo: string;
  issue_number: number;
  labels: string[];
}) => {
  const labels = await octokit.rest.issues.listLabelsForRepo({
    owner: req.owner,
    repo: req.repo,
  });
  const label_ids = new Map<string, number>();
  for (const l of labels.data) {
    label_ids.set(l.name, l.id);
  }
  await octokit.rest.issues.addLabels({
    owner: req.owner,
    repo: req.repo,
    issue_number: req.issue_number,
    labels: req.labels.map((s) => label_ids.get(s)),
  });
};
