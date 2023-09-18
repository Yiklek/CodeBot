type WebhooksConfig = (Deno.ServeOptions | Deno.ServeTlsOptions) & {
  secret: string;
};

export class ApiConfig {
  auth: string | undefined;
  baseUrl: string | undefined;
}

export class Repo {
  owner: string;
  repo: string;
  constructor(owner: string, repo: string) {
    this.owner = owner;
    this.repo = repo;
  }
}

export class Config {
  webhooks: WebhooksConfig;
  api: ApiConfig;
  repos: Repo[] | undefined;
  constructor(webhooks: WebhooksConfig, api: ApiConfig, repos: Repo[]) {
    this.webhooks = webhooks;
    this.api = api;
    this.repos = repos;
  }
}
