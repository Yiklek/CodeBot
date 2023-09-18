# CodeBot

## config

Bot will import `config.js`.

Example:

```js
export default {
  webhooks: {
    secret: "Your webhook secret",
    port: 3001,
    hostname: undefined,
  },
  api: {
    auth: "Your token",
    baseUrl: "Your base url. undefined for github",
  },
  repos: [{ owner: "user or org", repo: "repo" }],
};
```
