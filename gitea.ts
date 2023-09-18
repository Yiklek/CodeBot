import { octokit } from "./api.ts";

export const listReviews = async (req: {
  owner: string;
  repo: string;
  pr_number: number;
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
    pull_number: req.pr_number,
    per_page: 100,
  });

  // iterate through each response
  for await (const { data: results } of iterator) {
    reviews.push(...results);
  }
  return reviews;
};

export const getPrReviewers = async (req: {
  owner: string;
  repo: string;
  pr: number;
  requested_reviewers: ({ login: string } | { name: string })[];
}) => {
  const reviews = await listReviews({
    owner: req.owner,
    repo: req.repo,
    pr_number: req.pr,
  });
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
export const listLabelsForRepo = async (req: {
  owner: string;
  repo: string;
}) => {
  const it = octokit.paginate.iterator(octokit.rest.issues.listLabelsForRepo, {
    owner: req.owner,
    repo: req.repo,
    per_page: 100,
  });
  const label_ids = new Map<string, number>();
  const labels_ret = [];
  for await (const { data: labels } of it) {
    labels_ret.push(...labels);
    for (const l of labels) {
      label_ids.set(l.name, l.id);
    }
  }
  return { labels: labels_ret, label_ids };
};
export const removeLabel = async (req: {
  owner: string;
  repo: string;
  issue_number: number;
  name: string;
}) => {
  const { label_ids } = await listLabelsForRepo({
    owner: req.owner,
    repo: req.repo,
  });
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
  const { label_ids } = await listLabelsForRepo({
    owner: req.owner,
    repo: req.repo,
  });
  await octokit.rest.issues.addLabels({
    owner: req.owner,
    repo: req.repo,
    issue_number: req.issue_number,
    labels: req.labels.map((s) => label_ids.get(s)),
  });
};
