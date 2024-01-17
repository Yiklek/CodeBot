# CodeBot

## config

Bot will read from `config.toml`.

Example:

```toml
[webhooks]
secret = "xxx"
port = 3001
hostname = "hostname"


[api]
auth = "Your token"
baseUrl = "Your base url. undefined for github"


[[repos]]
owner = "user or org"
repo = "repo"
```
