# Auto Approve PR's

Automatically approves pull requests where **every commit is authored by allowed bots**.

This is a GitHub Action intended for cases where bots (like `shopify[bot]`, `dependabot[bot]`, etc.) open routine PRs that you’re comfortable auto-approving once they are confirmed to be bot-only.

---

## Features

- Approves PRs when **all commits are from allowed bots**
- Optional guard to require the **PR author** to be an allowed bot
- Skips draft PRs and PRs from forks (configurable)
- Implemented in **TypeScript**, bundled with **Bun**
- Designed for use with the GitHub Actions **`node20`** runtime (Bun is only used to build)

---

## Inputs

| Input                      | Required | Default        | Description                                                                       |
| -------------------------- | -------- | -------------- | --------------------------------------------------------------------------------- |

| `allowed-bot-logins`       | No       | `shopify[bot]` | Comma-separated list of GitHub logins that are allowed as bot authors.            |
| `require-pr-author-is-bot` | No       | `true`         | If `true`, only auto-approve when the PR author login is in `allowed-bot-logins`. |
| `skip-drafts`              | No       | `true`         | If `true`, skip draft PRs.                                                        |
| `skip-forks`               | No       | `true`         | If `true`, skip PRs from forked repositories.                                     |

---

## Basic usage

In a consumer repository, create a workflow like:

```yaml
name: Auto-approve bot-only PRs

on:
  pull_request:
    branches: [main]
    types: [opened, reopened, synchronize, ready_for_review]

jobs:
  auto-approve:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write

    steps:
      - name: Auto-approve bot-only PRs
        uses: your-org/bot-only-pr-approver@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
```
