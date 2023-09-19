export declare type WebhooksConfig =
  & (Deno.ServeOptions | Deno.ServeTlsOptions)
  & {
    secret: string;
  };

export declare class ApiConfig {
  auth: string | undefined;
  baseUrl: string | undefined;
}

export declare class Repo {
  owner: string;
  repo: string;
}

export declare class Config {
  webhooks: WebhooksConfig;
  api: ApiConfig;
  repos: Repo[] | undefined;
}
